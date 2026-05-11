"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText, ChevronDown, BookOpen, Loader2, Plus,
  Trash2, RotateCcw, Check, X, Wand2,
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  MessageSquarePlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, addOutlineToProject, saveOutlineHistory } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import { toast } from "sonner"

const BRAND = {
  deep:    "#8400B8",
  primary: "#9900CC",
  bg:      "#F5EEFF",
  gray:    "#6E6E6E",
  accent:  "#AA00DD",
} as const

interface Subsection {
  title: string;
  description: string;
}

interface Chapter {
  Title: string;
  Content: string[];
  Chapter: number;
  Subsections?: Subsection[];
  [key: string]: unknown;
}

interface OutlineData {
  Title: string;
  Chapters: Chapter[];
}

interface OutlineResponse {
  outline: OutlineData;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className ?? ""}`} />
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getSummary(ch: Chapter): string {
  if (typeof ch.Summary === "string") return ch.Summary
  if (Array.isArray(ch.Summary)) return (ch.Summary as string[]).join(". ")
  return ""
}

function getTopics(ch: Chapter): string[] {
  return Array.isArray(ch.KeyTopics) ? (ch.KeyTopics as string[]) : []
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BookOutline({ title: initialTitle }: { title?: string }) {
  const { user } = useAuth()

  const [title, setTitle] = useState(initialTitle ?? "")
  const [context, setContext] = useState("")
  const [ageGroup, setAgeGroup] = useState<"" | "Kids" | "Teens" | "Adults">("")
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectOutline, setProjectOutline] = useState<Project[]>([])

  // Per-chapter comments for regeneration
  const [comments, setComments] = useState<Record<number, string>>({})
  const [commentOpen, setCommentOpen] = useState<number | null>(null)

  // Tracks whether the outline has been manually edited since last generation
  const [dirty, setDirty] = useState(false)

  // Validation state
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<{
    valid: boolean
    score: number
    feedback: string
    issues: Array<{ chapter: number | null; type: string; message: string }>
    suggestions: string[]
    revisedOutline?: { Title: string; Chapters: Chapter[] }
  } | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return
      try {
        if (!user.uid) throw new Error('User ID is undefined')
        const userProjects = await getUserProjects(user.uid)
        if (!Array.isArray(userProjects)) throw new Error('Fetched projects is not an array')
        setProjectOutline(userProjects)
      } catch (error) {
        console.error("Error fetching projects:", error)
        toast(error instanceof Error ? `Failed to load projects: ${error.message}` : 'Failed to load projects.')
      }
    }
    fetchProjects()
  }, [user])

  useEffect(() => { setTitle(initialTitle ?? "") }, [initialTitle])

  // ── Generation ──

  const generateOutline = async (regeneratePrompt?: string) => {
    const bookTitle = outline?.outline?.Title || title
    if (!bookTitle.trim()) return

    setLoading(true)
    setError(null)
    setValidation(null)
    if (!regeneratePrompt) setOutline(null)

    try {
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bookTitle,
          ageGroup: ageGroup || undefined,
          userId: user?.uid,
          ...(context.trim() && !regeneratePrompt ? { context: context.trim() } : {}),
          ...(regeneratePrompt ? { regeneratePrompt } : {}),
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to generate outline')

      setOutline(data)
      setComments({})
      setDirty(false)
      if (!regeneratePrompt) setTitle('')

      if (user?.uid) {
        await saveOutlineHistory(user.uid, { title: bookTitle, outline: data.outline })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Regenerate with collected comments ──

  const activeComments = Object.entries(comments).filter(([, v]) => v.trim())

  const handleRegenerateWithComments = () => {
    if (!outline) return
    // Build a prompt from all chapter comments
    const parts: string[] = []
    for (const [chNum, text] of activeComments) {
      const ch = outline.outline.Chapters.find(c => c.Chapter === Number(chNum))
      parts.push(`Chapter ${chNum} ("${ch?.Title || ''}"): ${text.trim()}`)
    }
    const prompt = parts.length > 0
      ? `Revise the outline based on these comments:\n${parts.join("\n")}`
      : undefined
    generateOutline(prompt)
  }

  // ── Validate ──

  const handleValidate = async () => {
    if (!outline || !user?.uid) return
    setValidating(true)
    setValidation(null)
    try {
      const response = await fetch('/api/validate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, outline: outline.outline }),
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        if (data.error === 'usage_limit_exceeded') {
          toast.error(`Monthly outline limit reached (${data.current}/${data.limit})`)
        } else {
          throw new Error(data.error || 'Validation failed')
        }
        return
      }
      setValidation(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const applyRevisedOutline = () => {
    if (!validation?.revisedOutline || !outline) return
    setOutline({
      ...outline,
      outline: {
        Title: validation.revisedOutline.Title,
        Chapters: validation.revisedOutline.Chapters,
      },
    })
    setValidation(null)
    setComments({})
    setDirty(false)
    toast.success('Revised outline applied')
  }

  // ── Save to project ──

  const handleAddOutlineToProject = async (projectId: string) => {
    if (!user) { toast('Please sign in'); return }
    try {
      if (!outline?.outline.Chapters.length) { toast('No outline available'); return }

      const project = projectOutline.find((p) => p.id === projectId)
      const outlines = (project as { outlines?: unknown[] } | undefined)?.outlines
      if (project && Array.isArray(outlines) && outlines.length > 0) {
        const confirmReplace = window.confirm('This project already has an outline. Adding a new outline will override the existing one. Do you want to continue?')
        if (!confirmReplace) return
      }

      await addOutlineToProject(projectId, outline.outline.Title || title, outline as unknown as { outline?: { Title?: string; Chapters?: Array<Record<string, unknown> | { Chapter: number; Title: string }> } })
      toast(`Outline added to project: ${project?.name}`)
    } catch (error) {
      console.error("Error adding outline to project:", error)
      toast('Failed to add outline to project.')
    }
  }

  // ── Inline chapter mutations ──

  const updateField = useCallback((chapterNum: number, field: string, value: unknown) => {
    if (!outline) return
    setDirty(true)
    setOutline(prev => {
      if (!prev) return prev
      return {
        ...prev,
        outline: {
          ...prev.outline,
          Chapters: prev.outline.Chapters.map(ch =>
            ch.Chapter === chapterNum ? { ...ch, [field]: value } : ch
          ),
        },
      }
    })
  }, [outline])

  const deleteChapter = useCallback((chapterNum: number) => {
    if (!outline) return
    setDirty(true)
    const filtered = outline.outline.Chapters.filter(ch => ch.Chapter !== chapterNum)
    const renumbered = filtered.map((ch, idx) => ({ ...ch, Chapter: idx + 1 }))
    setOutline({ ...outline, outline: { ...outline.outline, Chapters: renumbered } })
    // Clean up comments for deleted chapter
    setComments(prev => {
      const next = { ...prev }
      delete next[chapterNum]
      return next
    })
  }, [outline])

  const addChapter = useCallback(() => {
    if (!outline) return
    setDirty(true)
    const nextNum = outline.outline.Chapters.length + 1
    setOutline({
      ...outline,
      outline: {
        ...outline.outline,
        Chapters: [
          ...outline.outline.Chapters,
          { Chapter: nextNum, Title: "", Content: [], Summary: "", KeyTopics: [], Subsections: [{ title: '', description: '' }, { title: '', description: '' }, { title: '', description: '' }] },
        ],
      },
    })
  }, [outline])

  const updateBookTitle = (newTitle: string) => {
    if (!outline) return
    setDirty(true)
    setOutline({ ...outline, outline: { ...outline.outline, Title: newTitle } })
  }

  const hasOutline = !loading && !!outline?.outline

  return (
    <div
      className="min-h-full p-4 sm:p-8"
      style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="[font-family:var(--font-playfair,Georgia,serif)] text-2xl font-black text-slate-900 sm:text-3xl">
            Book Outline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate, edit, and refine your book outline with AI assistance.
          </p>
        </div>

        {hasOutline && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 hover:opacity-80"
                style={{ borderColor: `${BRAND.primary}50`, color: BRAND.primary }}
              >
                <FileText className="h-4 w-4" />
                Save to Project
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {projectOutline.length === 0 ? (
                <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
              ) : (
                projectOutline.map((project) => (
                  <DropdownMenuItem key={project.id} onClick={() => handleAddOutlineToProject(project.id)}>
                    {project.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      {!hasOutline && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <BookOpen className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter your book title..."
                  value={title}
                  disabled={loading}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) generateOutline() }}
                  className="h-11 w-full rounded-lg border border-purple-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <Button
                onClick={() => generateOutline()}
                disabled={loading || !title.trim()}
                className="h-11 px-6 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: BRAND.primary }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deep)}
                onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.primary)}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </span>
                ) : "Generate Outline"}
              </Button>
            </div>

            {/* Context textarea */}
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional: Describe the book's focus, audience, or any specific direction for the AI..."
              rows={2}
              disabled={loading}
              className="mt-3 w-full text-sm border border-purple-100 rounded-lg px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 placeholder-slate-400 disabled:opacity-60"
            />

            {/* Age group filter */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Age group:</span>
              {(["Kids", "Teens", "Adults"] as const).map(ag => (
                <button
                  key={ag}
                  onClick={() => setAgeGroup(ageGroup === ag ? "" : ag)}
                  disabled={loading}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: ageGroup === ag ? BRAND.primary : BRAND.bg,
                    color: ageGroup === ag ? "#fff" : BRAND.primary,
                    border: `1px solid ${BRAND.primary}40`,
                  }}
                  onMouseEnter={e => { if (ageGroup !== ag) { e.currentTarget.style.background = BRAND.primary; e.currentTarget.style.color = "#fff" } }}
                  onMouseLeave={e => { if (ageGroup !== ag) { e.currentTarget.style.background = BRAND.bg; e.currentTarget.style.color = BRAND.primary } }}
                >
                  {ag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <div className="space-y-3 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Full outline document view ──────────────────────────────────── */}
      {hasOutline && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {/* Book title — always editable */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <input
              value={outline!.outline.Title}
              onChange={(e) => updateBookTitle(e.target.value)}
              className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
              style={{ color: BRAND.deep, fontFamily: "var(--font-playfair, Georgia, serif)" }}
              placeholder="Book title..."
            />
            <p className="text-xs text-gray-400 mt-2">
              {outline!.outline.Chapters.length} chapters
              {activeComments.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-purple-500 font-medium">
                  <MessageSquarePlus className="h-3 w-3" />
                  {activeComments.length} comment{activeComments.length !== 1 ? 's' : ''} for regeneration
                </span>
              )}
            </p>
          </div>

          {/* Chapters — all visible, all editable */}
          <div className="divide-y divide-slate-100">
            {outline!.outline.Chapters.map((ch) => {
              const summary = getSummary(ch)
              const topics = getTopics(ch)
              const hasComment = (comments[ch.Chapter] || '').trim().length > 0
              const isCommentOpen = commentOpen === ch.Chapter

              return (
                <div key={ch.Chapter} className="px-6 py-5 group">
                  <div className="flex items-start gap-4">
                    {/* Chapter number */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold mt-0.5"
                      style={{ background: BRAND.bg, color: BRAND.primary }}
                    >
                      {ch.Chapter}
                    </div>

                    {/* Chapter content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Title */}
                      <input
                        value={ch.Title}
                        onChange={(e) => updateField(ch.Chapter, 'Title', e.target.value)}
                        className="w-full text-base font-semibold bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
                        style={{ color: BRAND.deep, fontFamily: "var(--font-playfair, Georgia, serif)" }}
                        placeholder="Chapter title..."
                      />

                      {/* Summary */}
                      <textarea
                        value={summary}
                        onChange={(e) => updateField(ch.Chapter, 'Summary', e.target.value)}
                        placeholder="Chapter summary..."
                        rows={2}
                        className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder-slate-300 focus:ring-0 leading-relaxed"
                        style={{ color: BRAND.gray }}
                      />

                      {/* Key topics */}
                      <div>
                        <input
                          value={topics.join(", ")}
                          onChange={(e) =>
                            updateField(ch.Chapter, 'KeyTopics', e.target.value.split(",").map(t => t.trim()).filter(Boolean))
                          }
                          placeholder="Key topics (comma-separated)..."
                          className="w-full text-xs bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
                          style={{ color: BRAND.primary }}
                        />
                      </div>

                      {/* Subsections */}
                      {(ch.Subsections && ch.Subsections.length > 0) && (
                        <div className="mt-1 pl-4 border-l-2 space-y-1.5" style={{ borderColor: `${BRAND.primary}30` }}>
                          {ch.Subsections.map((sub, si) => (
                            <div key={si} className="flex items-start gap-2 group/sub">
                              <span className="text-xs font-mono mt-0.5 flex-shrink-0" style={{ color: `${BRAND.primary}80` }}>
                                {ch.Chapter}.{si + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <input
                                  value={sub.title}
                                  onChange={(e) => {
                                    const updated = [...(ch.Subsections || [])]
                                    updated[si] = { ...updated[si], title: e.target.value }
                                    updateField(ch.Chapter, 'Subsections', updated)
                                  }}
                                  placeholder="Subsection title..."
                                  className="w-full text-sm font-medium bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
                                  style={{ color: BRAND.deep }}
                                />
                                <input
                                  value={sub.description}
                                  onChange={(e) => {
                                    const updated = [...(ch.Subsections || [])]
                                    updated[si] = { ...updated[si], description: e.target.value }
                                    updateField(ch.Chapter, 'Subsections', updated)
                                  }}
                                  placeholder="Brief description..."
                                  className="w-full text-xs bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
                                  style={{ color: BRAND.gray }}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const updated = (ch.Subsections || []).filter((_, i) => i !== si)
                                  updateField(ch.Chapter, 'Subsections', updated)
                                }}
                                className="p-1 rounded text-gray-200 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-opacity flex-shrink-0"
                                title="Remove subsection"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const updated = [...(ch.Subsections || []), { title: '', description: '' }]
                              updateField(ch.Chapter, 'Subsections', updated)
                            }}
                            className="text-xs flex items-center gap-1 py-0.5 hover:text-purple-600 transition-colors"
                            style={{ color: `${BRAND.primary}80` }}
                          >
                            <Plus className="h-3 w-3" /> Add subsection
                          </button>
                        </div>
                      )}

                      {/* Add subsections if none exist */}
                      {(!ch.Subsections || ch.Subsections.length === 0) && (
                        <button
                          onClick={() => {
                            updateField(ch.Chapter, 'Subsections', [
                              { title: '', description: '' },
                              { title: '', description: '' },
                              { title: '', description: '' },
                            ])
                          }}
                          className="text-xs flex items-center gap-1 py-0.5 hover:text-purple-600 transition-colors"
                          style={{ color: `${BRAND.primary}60` }}
                        >
                          <Plus className="h-3 w-3" /> Add subsections
                        </button>
                      )}

                      {/* Comment for regeneration */}
                      {(isCommentOpen || hasComment) && (
                        <div className="mt-2 flex items-start gap-2">
                          <MessageSquarePlus className="h-3.5 w-3.5 text-purple-400 mt-1.5 flex-shrink-0" />
                          <textarea
                            value={comments[ch.Chapter] || ''}
                            onChange={(e) => setComments(prev => ({ ...prev, [ch.Chapter]: e.target.value }))}
                            placeholder="What should change in this chapter?..."
                            rows={2}
                            className="flex-1 text-xs border border-purple-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 placeholder-slate-400"
                            style={{ background: `${BRAND.bg}80` }}
                            autoFocus={isCommentOpen && !hasComment}
                          />
                          {!hasComment && (
                            <button
                              onClick={() => setCommentOpen(null)}
                              className="text-gray-300 hover:text-gray-500 mt-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isCommentOpen && !hasComment && (
                        <button
                          onClick={() => setCommentOpen(ch.Chapter)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                          title="Add comment for regeneration"
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                        </button>
                      )}
                      {outline!.outline.Chapters.length > 1 && (
                        <button
                          onClick={() => deleteChapter(ch.Chapter)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove chapter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add chapter */}
          <button
            onClick={addChapter}
            className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm text-purple-500 hover:bg-purple-50 transition-colors border-t border-slate-100"
          >
            <Plus className="h-4 w-4" /> Add Chapter
          </button>
        </div>
      )}

      {/* ── Action bar ──────────────────────────────────────────────────── */}
      {hasOutline && (
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleRegenerateWithComments}
            disabled={loading || activeComments.length === 0}
            className="text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: activeComments.length > 0 ? BRAND.primary : undefined }}
            onMouseEnter={(e) => { if (activeComments.length > 0) e.currentTarget.style.background = BRAND.deep }}
            onMouseLeave={(e) => { if (activeComments.length > 0) e.currentTarget.style.background = BRAND.primary }}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Regenerating...</>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                {activeComments.length > 0
                  ? `Regenerate with ${activeComments.length} Comment${activeComments.length !== 1 ? 's' : ''}`
                  : 'Add comments to regenerate'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={validating || loading || !dirty}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
          >
            {validating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
            ) : (
              <><ShieldCheck className="h-4 w-4 mr-2" /> Validate with AI</>
            )}
          </Button>
        </div>
      )}

      {/* ── Validation results ──────────────────────────────────────────── */}
      {validation && (
        <div className="mt-4 rounded-2xl border bg-white shadow-sm overflow-hidden"
          style={{ borderColor: validation.valid ? '#d1fae5' : '#fde68a' }}
        >
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: validation.valid ? '#ecfdf5' : '#fffbeb' }}
          >
            <div className="flex items-center gap-3">
              {validation.valid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  AI Validation {validation.valid ? 'Passed' : 'Needs Improvement'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{validation.feedback}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold text-white"
                style={{ background: validation.score >= 7 ? '#059669' : validation.score >= 5 ? '#d97706' : '#dc2626' }}
              >
                {validation.score}
              </div>
              <button onClick={() => setValidation(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            {validation.issues.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Issues Found</h4>
                <div className="space-y-2">
                  {validation.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <XCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full mr-2"
                          style={{ background: `${BRAND.primary}10`, color: BRAND.primary }}
                        >
                          {issue.type}{issue.chapter ? ` · Ch.${issue.chapter}` : ''}
                        </span>
                        <span className="text-gray-700">{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validation.suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Suggestions</h4>
                <ul className="space-y-1.5">
                  {validation.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <Wand2 className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.revisedOutline && (
              <div className="pt-2 border-t border-slate-100">
                <Button
                  onClick={applyRevisedOutline}
                  className="text-sm font-semibold text-white"
                  style={{ background: BRAND.primary }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deep)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.primary)}
                >
                  <Check className="h-4 w-4 mr-2" /> Apply AI Improvements
                </Button>
                <span className="text-xs text-gray-400 ml-3">Replaces current outline with AI-revised version</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && !outline && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
              <FileText className="h-4 w-4" style={{ color: BRAND.deep }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: BRAND.deep }}>
              Enter a title to generate an outline
            </p>
          </div>
          <div className="px-6 py-5 min-h-[320px]">
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: BRAND.bg }}>
                <BookOpen className="h-6 w-6" style={{ color: BRAND.deep }} />
              </div>
              <p className="text-sm" style={{ color: BRAND.gray }}>
                Enter a book title above and click &quot;Generate Outline&quot; to get started
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
