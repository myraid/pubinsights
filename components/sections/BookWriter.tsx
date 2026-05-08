"use client"

import { useState, useEffect } from "react"
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
  getAllSections,
  saveSection,
} from "@/app/lib/firebase/services"
import type { Project, ProjectOutline, Manuscript, ChapterDocument, Section, StyleProfile } from "@/app/types/firebase"
import { toast } from "sonner"
import CollapsibleChapterNav from "@/components/book-writer/CollapsibleChapterNav"
import dynamic from "next/dynamic"

const UnifiedChapterView = dynamic(() => import("@/components/book-writer/UnifiedChapterView"), { ssr: false })

type ChapterWithId = ChapterDocument & { id: string }
type ManuscriptWithId = Manuscript & { id: string }
type SectionWithId = Section & { id: string }

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
  const [manuscriptAIContext, setManuscriptAIContext] = useState("")

  // Section state
  const [sections, setSections] = useState<SectionWithId[]>([])
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null)
  const [planningChapterId, setPlanningChapterId] = useState<string | null>(null)
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null)

  // Per-section operation tracking
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null)
  const [revisingSectionId, setRevisingSectionId] = useState<string | null>(null)
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null)

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
    if (!selectedProject || !activeManuscript) { setChapters([]); setActiveChapterId(null); setSections([]); setFocusedSectionId(null); return }
    getAllChapters(selectedProject.id, activeManuscript.id)
      .then(chs => {
        const typed = chs as ChapterWithId[]
        setChapters(typed)
        if (typed.length > 0) handleSelectChapter(typed[0].id)
      })
      .catch(() => toast.error("Failed to load chapters"))
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const msId = await createManuscript(
        selectedProject.id,
        user.uid,
        selectedOutline.title,
        outlineSnapshot,
        { aiContext: manuscriptAIContext }
      )
      toast.success("Manuscript created! Start writing your chapters.")

      const ms = await getProjectManuscripts(selectedProject.id)
      setManuscripts(ms as ManuscriptWithId[])
      const newMs = (ms as ManuscriptWithId[]).find(m => m.id === msId)
      if (newMs) setActiveManuscript(newMs)
      setManuscriptAIContext("")
    } catch (e) {
      toast.error("Failed to create manuscript")
      console.error(e)
    } finally {
      setCreatingManuscript(false)
    }
  }

  // ── Section-level handlers ──

  const handleSelectChapter = async (chapterId: string) => {
    if (!selectedProject || !activeManuscript) return
    setActiveChapterId(chapterId)

    const loadSections = async (retries = 1): Promise<SectionWithId[]> => {
      try {
        return await getAllSections(selectedProject.id, activeManuscript.id, chapterId) as SectionWithId[]
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 500))
          return loadSections(retries - 1)
        }
        throw err
      }
    }

    try {
      const secs = await loadSections()

      // Check for stale generating sections (older than 3 minutes)
      const now = Math.floor(Date.now() / 1000)
      const staleThreshold = 3 * 60
      let hasStale = false
      const cleanedSecs = secs.map(s => {
        if (s.status === 'generating' && s.updatedAt && (now - s.updatedAt.seconds) > staleThreshold) {
          hasStale = true
          return { ...s, status: 'not_started' as const }
        }
        return s
      })
      if (hasStale) {
        toast.warning('Some sections had stale generation status and were reset.')
      }

      setSections(cleanedSecs)
      const firstNonApproved = cleanedSecs.find(s => s.status !== 'approved')
      setFocusedSectionId(firstNonApproved ? firstNonApproved.id : (cleanedSecs.length > 0 ? cleanedSecs[0].id : null))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msAny = activeManuscript as any
      if (msAny.styleProfile) {
        setStyleProfile(msAny.styleProfile as StyleProfile)
      }
    } catch (err) {
      console.error("Failed to load sections:", err)
      toast.error("Failed to load sections")
      setSections([])
      setFocusedSectionId(null)
    }
  }

  const handlePlanSections = async (chapterId: string) => {
    if (!user || !selectedProject || !activeManuscript) return
    setPlanningChapterId(chapterId)
    try {
      const res = await fetch('/api/plan-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const data = await res.json()

      const apiSections = (data.sections || []) as SectionWithId[]
      setSections(apiSections)
      if (apiSections.length > 0) setFocusedSectionId(apiSections[0].id)

      const chs = await getAllChapters(selectedProject.id, activeManuscript.id)
      setChapters(chs as ChapterWithId[])

      toast.success('Section plan created!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to plan sections')
    } finally {
      setPlanningChapterId(null)
    }
  }

  const handleGenerateDraft = async (sectionId: string, authorNotes?: string) => {
    if (!user || !selectedProject || !activeManuscript || !activeChapterId) return
    setGeneratingSectionId(sectionId)
    try {
      const res = await fetch('/api/write-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId: activeChapterId,
          sectionId,
          authorNotes,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const data = await res.json()
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, content: data.content, wordCount: data.wordCount, status: 'review' as const, aiGenerated: true }
          : s
      ))
      if (data.warning) toast.warning(data.warning)
      else toast.success('Draft generated!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate draft')
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, status: 'not_started' as const } : s
      ))
    } finally {
      setGeneratingSectionId(null)
    }
  }

  const handleApproveSection = async (sectionId: string) => {
    if (!user || !selectedProject || !activeManuscript || !activeChapterId) return
    try {
      const res = await fetch('/api/approve-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId: activeChapterId,
          sectionId,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const data = await res.json()

      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, status: 'approved' as const, approvedSummary: data.summary } : s
      ))

      // Auto-advance focus to next section
      const currentIdx = sections.findIndex(s => s.id === sectionId)
      if (currentIdx < sections.length - 1) {
        setFocusedSectionId(sections[currentIdx + 1].id)
      }

      if (data.chapterComplete) {
        const chs = await getAllChapters(selectedProject.id, activeManuscript.id)
        setChapters(chs as ChapterWithId[])
        toast.success('Chapter complete!')
      } else {
        toast.success('Section approved!')
      }

      if (data.shouldExtractStyle) {
        handleStyleExtraction()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve section')
    }
  }

  const handleApplyRevisions = async (sectionId: string) => {
    if (!user || !selectedProject || !activeManuscript || !activeChapterId) return
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    const pendingComments = (section.comments || []).filter(c => c.status === 'pending')
    if (pendingComments.length === 0) return

    setRevisingSectionId(sectionId)
    try {
      const res = await fetch('/api/revise-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId: activeChapterId,
          sectionId,
          comments: pendingComments,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const data = await res.json()

      setSections(prev => prev.map(s => {
        if (s.id !== sectionId) return s
        return {
          ...s,
          content: data.content,
          wordCount: data.wordCount,
          revisionCount: (s.revisionCount || 0) + 1,
          comments: s.comments.map(c =>
            pendingComments.some(pc => pc.id === c.id) ? { ...c, status: 'resolved' as const } : c
          ),
        }
      }))

      toast.success(`${data.changesApplied.length} revision(s) applied`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply revisions')
    } finally {
      setRevisingSectionId(null)
    }
  }

  const handleRegenerate = async (sectionId: string) => {
    if (!user || !selectedProject || !activeManuscript || !activeChapterId) return
    setGeneratingSectionId(sectionId)
    try {
      const res = await fetch('/api/write-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          chapterId: activeChapterId,
          sectionId,
          regenerate: true,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const data = await res.json()
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, content: data.content, wordCount: data.wordCount, status: 'review' as const, aiGenerated: true }
          : s
      ))
      if (data.warning) toast.warning(data.warning)
      else toast.success('Draft regenerated!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to regenerate draft')
    } finally {
      setGeneratingSectionId(null)
    }
  }

  const handleMakeChanges = async (sectionId: string) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { status: 'review' })
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, status: 'review' as const } : s
    ))
  }

  const handleAddComment = async (sectionId: string, comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    const newComment = {
      id: crypto.randomUUID(),
      ...comment,
      status: 'pending' as const,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    }
    const updatedComments = [...(section.comments || []), newComment]
    await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { comments: updatedComments })
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, comments: updatedComments } : s
    ))
  }

  const handleDeleteComment = async (sectionId: string, commentId: string) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    const updatedComments = (section.comments || []).filter(c => c.id !== commentId)
    await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { comments: updatedComments })
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, comments: updatedComments } : s
    ))
  }

  const handleSaveSectionContent = async (sectionId: string, html: string, wordCount: number) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    setSavingSectionId(sectionId)
    try {
      await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { content: html, wordCount })
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, content: html, wordCount } : s
      ))
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingSectionId(null)
    }
  }

  const handleAuthorNotesChange = async (sectionId: string, notes: string) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { authorNotes: notes })
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, authorNotes: notes } : s
    ))
  }

  const handleStyleExtraction = async () => {
    if (!user || !selectedProject || !activeManuscript) return
    try {
      const approvedIds = sections.filter(s => s.status === 'approved').map(s => s.id)
      if (approvedIds.length < 2) return
      const res = await fetch('/api/extract-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          sectionIds: approvedIds.slice(-5),
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setStyleProfile(data.styleProfile)
      toast.success('Style profile updated')
    } catch {
      /* non-fatal */
    }
  }

  const handleRestoreVersion = async (sectionId: string, content: string) => {
    if (!selectedProject || !activeManuscript || !activeChapterId) return
    await saveSection(selectedProject.id, activeManuscript.id, activeChapterId, sectionId, { content, status: 'review' })
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, content, status: 'review' as const } : s
    ))
    toast.success('Version restored')
  }

  const handleExportDocx = async () => {
    if (!user || !selectedProject || !activeManuscript) return
    try {
      const res = await fetch('/api/export-manuscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          projectId: selectedProject.id,
          manuscriptId: activeManuscript.id,
          draft: activeManuscript.status !== 'complete',
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeManuscript.title}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Manuscript exported!')
    } catch {
      toast.error('Failed to export manuscript')
    }
  }

  // ── Setup screen ──
  if (!activeManuscript) {
    return (
      <div className="p-6 md:p-10 min-h-[600px]">
        <div className="max-w-2xl mx-auto">
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

                <div>
                  <label
                    htmlFor="manuscript-ai-context"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    AI context <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="manuscript-ai-context"
                    value={manuscriptAIContext}
                    onChange={(e) => setManuscriptAIContext(e.target.value)}
                    placeholder="e.g. Write in second-person, conversational tone. Aim for ~5000 words per chapter. Audience: first-time entrepreneurs."
                    rows={4}
                    className="w-full text-sm border border-purple-200 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Baseline: ~2,500 words per chapter, scaled by the AI to the substance of each chapter (lighter for intros and conclusions, fuller for the meat of the book). Add direction here to shift voice, audience, or overall length.
                  </p>
                </div>

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

  // ── Active manuscript: full-screen writing view ──
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-purple-100 bg-white flex-shrink-0">
        <button
          onClick={() => setActiveManuscript(null)}
          className="text-gray-400 hover:text-purple-600 transition-colors"
          aria-label="Back to project selection"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-semibold text-gray-900 truncate"
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
        <Button variant="outline" size="sm" onClick={handleExportDocx} className="text-xs border-purple-200 hover:bg-purple-50 text-purple-700">
          Export DOCX
        </Button>
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
              <DropdownMenuItem key={ch.id} onClick={() => handleSelectChapter(ch.id)}>
                Ch. {ch.chapterNumber}: {ch.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Two-zone layout: sidebar + unified chapter view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Collapsible chapter nav */}
        <div className="hidden md:flex">
          <CollapsibleChapterNav
            chapters={chapters}
            activeChapterId={activeChapterId}
            sections={sections}
            focusedSectionId={focusedSectionId}
            onSelectChapter={handleSelectChapter}
            onSelectSection={setFocusedSectionId}
            onPlanSections={handlePlanSections}
            totalWordCount={activeManuscript.totalWordCount || 0}
            completedCount={activeManuscript.completedChapters || 0}
            planningChapterId={planningChapterId}
          />
        </div>

        {/* Center: Unified chapter view with all sections */}
        <UnifiedChapterView
          chapter={activeChapter}
          sections={sections}
          focusedSectionId={focusedSectionId}
          onFocusSection={setFocusedSectionId}
          onGenerateDraft={handleGenerateDraft}
          onSaveContent={handleSaveSectionContent}
          onApprove={handleApproveSection}
          onApplyRevisions={handleApplyRevisions}
          onRegenerate={handleRegenerate}
          onMakeChanges={handleMakeChanges}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onAuthorNotesChange={handleAuthorNotesChange}
          onRestoreVersion={handleRestoreVersion}
          styleProfile={styleProfile}
          generatingSectionId={generatingSectionId}
          revisingSectionId={revisingSectionId}
          savingSectionId={savingSectionId}
        />
      </div>
    </div>
  )
}
