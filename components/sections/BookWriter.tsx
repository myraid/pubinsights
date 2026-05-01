"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  BookOpen, ChevronDown, Loader2, Plus,
  ArrowLeft, BookText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/app/context/AuthContext"
import {
  getUserProjects,
  createManuscript,
  getProjectManuscripts,
  getAllChapters,
  saveChapter,
  updateManuscriptProgress,
} from "@/app/lib/firebase/services"
import type { Project, ProjectOutline, Manuscript, ChapterDocument } from "@/app/types/firebase"
import { toast } from "sonner"
import ChapterSidebar from "@/components/book-writer/ChapterSidebar"
import dynamic from "next/dynamic"

const ChapterEditor = dynamic(() => import("@/components/book-writer/ChapterEditor"), { ssr: false })

type ChapterWithId = ChapterDocument & { id: string }
type ManuscriptWithId = Manuscript & { id: string }

export default function BookWriter() {
  const { user } = useAuth()

  // Project & outline selection
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedOutline, setSelectedOutline] = useState<ProjectOutline | null>(null)

  // Manuscript state
  const [manuscripts, setManuscripts] = useState<ManuscriptWithId[]>([])
  const [activeManuscript, setActiveManuscript] = useState<ManuscriptWithId | null>(null)
  const [chapters, setChapters] = useState<ChapterWithId[]>([])
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [creatingManuscript, setCreatingManuscript] = useState(false)

  // Editor state
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const activeChapter = chapters.find(c => c.id === activeChapterId) || null

  // Load projects
  useEffect(() => {
    if (!user) return
    setLoadingProjects(true)
    getUserProjects(user.uid)
      .then(p => setProjects(p as Project[]))
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoadingProjects(false))
  }, [user])

  // Load manuscripts when project selected
  useEffect(() => {
    if (!selectedProject) { setManuscripts([]); setActiveManuscript(null); return }
    getProjectManuscripts(selectedProject.id)
      .then(ms => setManuscripts(ms as ManuscriptWithId[]))
      .catch(() => toast.error("Failed to load manuscripts"))
  }, [selectedProject])

  // Load chapters when manuscript selected
  useEffect(() => {
    if (!selectedProject || !activeManuscript) { setChapters([]); setActiveChapterId(null); return }
    getAllChapters(selectedProject.id, activeManuscript.id)
      .then(chs => {
        const typed = chs as ChapterWithId[]
        setChapters(typed)
        if (typed.length > 0) setActiveChapterId(typed[0].id)
      })
      .catch(() => toast.error("Failed to load chapters"))
  }, [selectedProject, activeManuscript])

  // Filter projects that have outlines
  const projectsWithOutlines = projects.filter(
    p => Array.isArray((p as Project & { outlines?: ProjectOutline[] }).outlines) &&
      ((p as Project & { outlines?: ProjectOutline[] }).outlines!).length > 0
  )

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setSelectedOutline(null)
    setActiveManuscript(null)
    const outlines = (project as Project & { outlines?: ProjectOutline[] }).outlines || []
    if (outlines.length === 1) setSelectedOutline(outlines[0])
  }

  const handleCreateManuscript = async () => {
    if (!user || !selectedProject || !selectedOutline) return
    setCreatingManuscript(true)
    try {
      const outlineSnapshot = {
        Title: selectedOutline.outline.Title,
        Chapters: selectedOutline.outline.Chapters.map(ch => {
          // Outline agent emits `Summary` (string) and `KeyTopics` (string[]).
          // Tolerate legacy/alternate keys ("Key Points", "Topics") as fallbacks.
          const rawSummary = ch["Summary"]
          const summary = Array.isArray(rawSummary)
            ? (rawSummary as string[]).join(". ")
            : typeof rawSummary === "string"
              ? rawSummary
              : ""

          const rawTopics =
            (ch["KeyTopics"] as unknown) ??
            (ch["Key Points"] as unknown) ??
            (ch["Topics"] as unknown)
          const keyTopics = Array.isArray(rawTopics)
            ? (rawTopics as unknown[]).filter(t => typeof t === "string") as string[]
            : []

          return {
            Chapter: ch.Chapter,
            Title: ch.Title,
            Summary: summary,
            KeyTopics: keyTopics,
          }
        }),
      }

      const msId = await createManuscript(selectedProject.id, user.uid, selectedOutline.title, outlineSnapshot)
      toast.success("Manuscript created! Start writing your chapters.")

      // Reload manuscripts
      const ms = await getProjectManuscripts(selectedProject.id)
      setManuscripts(ms as ManuscriptWithId[])
      const newMs = (ms as ManuscriptWithId[]).find(m => m.id === msId)
      if (newMs) setActiveManuscript(newMs)
    } catch (e) {
      toast.error("Failed to create manuscript")
      console.error(e)
    } finally {
      setCreatingManuscript(false)
    }
  }

  const handleContentChange = useCallback(async (html: string, wordCount: number) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    setSaving(true)
    try {
      const status = wordCount > 0 ? "writing" : "not_started"
      await saveChapter(selectedProject.id, activeManuscript.id, activeChapterId, {
        content: html, wordCount, status,
      })

      // Update local state
      setChapters(prev => prev.map(c =>
        c.id === activeChapterId ? { ...c, content: html, wordCount, status: status as ChapterDocument["status"] } : c
      ))

      // Update manuscript progress
      const allChs = await getAllChapters(selectedProject.id, activeManuscript.id) as ChapterWithId[]
      const totalWords = allChs.reduce((sum, c) => sum + (c.wordCount || 0), 0)
      const completed = allChs.filter(c => c.status === "complete").length
      await updateManuscriptProgress(selectedProject.id, activeManuscript.id, completed, totalWords)
      setActiveManuscript(prev => prev ? { ...prev, totalWordCount: totalWords, completedChapters: completed } : prev)
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }, [selectedProject, activeManuscript, activeChapterId])

  const handleAIDraft = useCallback(async () => {
    if (!selectedProject || !activeManuscript || !activeChapter) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    try {
      // Get previous chapter summary for continuity
      const prevChapter = chapters.find(c => c.chapterNumber === activeChapter.chapterNumber - 1)

      const res = await fetch("/api/write-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          bookTitle: activeManuscript.outlineSnapshot.Title,
          chapterNumber: activeChapter.chapterNumber,
          chapterTitle: activeChapter.title,
          summary: activeChapter.outlineContext.summary,
          keyTopics: activeChapter.outlineContext.keyTopics,
          previousChapterSummary: prevChapter?.content
            ? prevChapter.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
            : undefined,
          totalChapters: activeManuscript.totalChapters,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId: activeChapter.id,
          userId: user!.uid,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.details || errBody.error || `Request failed (${res.status})`)
      }
      const data = await res.json()

      // Update local state with the generated content
      setChapters(prev => prev.map(c =>
        c.id === activeChapter.id
          ? { ...c, content: data.content, wordCount: data.wordCount, status: "writing" as const, aiGenerated: true }
          : c
      ))

      // Refresh manuscript progress
      const allChs = await getAllChapters(selectedProject.id, activeManuscript.id) as ChapterWithId[]
      const totalWords = allChs.reduce((sum, c) => sum + (c.wordCount || 0), 0)
      const completed = allChs.filter(c => c.status === "complete").length
      setActiveManuscript(prev => prev ? { ...prev, totalWordCount: totalWords, completedChapters: completed } : prev)

      toast.success(`Chapter ${activeChapter.chapterNumber} draft generated!`)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return
      const msg = e instanceof Error ? e.message : "Failed to generate chapter draft"
      toast.error(msg)
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }, [selectedProject, activeManuscript, activeChapter, chapters, user])

  // ── No project/outline selected: show setup screen ──
  if (!activeManuscript) {
    return (
      <div className="p-6 md:p-10 min-h-[600px]">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <BookText className="h-8 w-8 text-purple-500" />
            </div>
            <h2
              className="text-2xl font-bold text-gray-900"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Book Writer
            </h2>
            <p className="text-gray-500 mt-2">
              Turn your outline into a full manuscript with AI-assisted chapter writing.
            </p>
          </div>

          {/* Step 1: Select project */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. Select a project with an outline
              </label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
                </div>
              ) : projectsWithOutlines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/50 p-6 text-center">
                  <BookOpen className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    No projects with outlines found. Generate an outline in the Book Outline tab first.
                  </p>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between border-purple-200 hover:bg-purple-50">
                      {selectedProject ? selectedProject.name : "Choose a project..."}
                      <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                    {projectsWithOutlines.map(p => (
                      <DropdownMenuItem key={p.id} onClick={() => handleSelectProject(p)}>
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Step 2: Select outline (if project has multiple) */}
            {selectedProject && (() => {
              const outlines = (selectedProject as Project & { outlines?: ProjectOutline[] }).outlines || []
              if (outlines.length <= 1) return null
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Select an outline
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between border-purple-200 hover:bg-purple-50">
                        {selectedOutline ? selectedOutline.title : "Choose an outline..."}
                        <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      {outlines.map((o, i) => (
                        <DropdownMenuItem key={i} onClick={() => setSelectedOutline(o)}>
                          {o.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })()}

            {/* Outline preview + create manuscript */}
            {selectedOutline && (
              <div className="space-y-4">
                <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4">
                  <h3
                    className="font-semibold text-gray-900 mb-3"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {selectedOutline.outline.Title}
                  </h3>
                  <div className="space-y-1.5">
                    {selectedOutline.outline.Chapters.map(ch => (
                      <div key={ch.Chapter} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-xs font-mono text-purple-400 w-6">{ch.Chapter}.</span>
                        {ch.Title}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    {selectedOutline.outline.Chapters.length} chapters
                  </p>
                </div>

                {/* Existing manuscripts for this project */}
                {manuscripts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Existing manuscripts
                    </label>
                    <div className="space-y-2">
                      {manuscripts.map(ms => (
                        <button
                          key={ms.id}
                          onClick={() => setActiveManuscript(ms)}
                          className="w-full text-left rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 p-3 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-gray-800">{ms.title}</span>
                            <span className="text-xs text-gray-400">
                              {ms.completedChapters}/{ms.totalChapters} chapters
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {ms.totalWordCount?.toLocaleString() || 0} words
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCreateManuscript}
                  disabled={creatingManuscript}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-300/30"
                >
                  {creatingManuscript ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating manuscript...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" /> Start New Manuscript</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Active manuscript: two-panel layout ──
  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-100 bg-white/80">
        <button
          onClick={() => setActiveManuscript(null)}
          className="text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold text-gray-900 truncate"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {activeManuscript.title}
          </h3>
          <p className="text-xs text-gray-400">
            {activeManuscript.totalWordCount?.toLocaleString() || 0} words
            {" \u00B7 "}
            {activeManuscript.completedChapters}/{activeManuscript.totalChapters} chapters
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 hidden md:block">
          <ChapterSidebar
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={setActiveChapterId}
            totalWordCount={activeManuscript.totalWordCount || 0}
            completedCount={activeManuscript.completedChapters || 0}
          />
        </div>

        {/* Mobile chapter selector */}
        <div className="md:hidden border-b border-purple-100 px-4 py-2 bg-white flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                {activeChapter ? `Ch. ${activeChapter.chapterNumber}: ${activeChapter.title}` : "Select chapter"}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
              {chapters.map(ch => (
                <DropdownMenuItem key={ch.id} onClick={() => setActiveChapterId(ch.id)}>
                  Ch. {ch.chapterNumber}: {ch.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {activeChapter ? (
            <ChapterEditor
              content={activeChapter.content}
              onContentChange={handleContentChange}
              onAIDraft={handleAIDraft}
              generating={generating}
              saving={saving}
              chapterStatus={activeChapter.status}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a chapter to start writing
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
