"use client"

import { useState, useEffect } from "react"
import { FileText, ChevronDown, BookOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, addOutlineToProject, saveOutlineHistory } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import { toast } from "sonner"

// ─── Brand palette ────────────────────────────────────────────────────────────

const BRAND = {
  deep:    "#8400B8",
  primary: "#9900CC",
  bg:      "#F5EEFF",
  gray:    "#6E6E6E",
  accent:  "#AA00DD",
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  Title: string;
  Content: string[];
  Chapter: number;
}

interface OutlineData {
  Title: string;
  Chapters: Chapter[];
}

interface OutlineResponse {
  outline: OutlineData;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-100 ${className ?? ""}`} />
  )
}

const renderOutlineValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return <p style={{ color: BRAND.gray }}>No details available.</p>
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : ""))
      .filter(Boolean)

    if (!items.length) {
      return <p style={{ color: BRAND.gray }}>No details available.</p>
    }

    return (
      <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: BRAND.gray }}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    )
  }

  if (typeof value === "object") {
    return (
      <pre
        className="whitespace-pre-wrap text-sm rounded-lg p-3 border border-slate-100"
        style={{ background: BRAND.bg, color: BRAND.gray }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <p className="text-sm" style={{ color: BRAND.gray }}>{String(value)}</p>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookOutline({ title: initialTitle }: { title?: string }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(initialTitle ?? "")
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectOutline, setProjectOutline] = useState<Project[]>([])

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        console.log('No user found, skipping project fetch');
        return;
      }

      try {
        if (!user.uid) {
          throw new Error('User ID is undefined');
        }

        const userProjects = await getUserProjects(user.uid);

        if (!Array.isArray(userProjects)) {
          throw new Error('Fetched projects is not an array');
        }

        setProjectOutline(userProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        if (error instanceof Error) {
          toast(`Failed to load projects: ${error.message}`);
        } else {
          toast('Failed to load projects. Please try refreshing the page.');
        }
      }
    };

    fetchProjects();
  }, [user]);

  useEffect(() => {
    setTitle(initialTitle ?? "")
  }, [initialTitle])

  const generateOutline = async () => {
    if (!title.trim()) return

    setLoading(true)
    setError(null)
    setOutline(null)

    try {
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, userId: user?.uid })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate outline')
      }

      setOutline(data)
      setTitle('')

      // Save to outline history if user is logged in
      if (user?.uid) {
        await saveOutlineHistory(user.uid, {
          title,
          outline: data.outline
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string) => {
    toast(message, {
      style: {
        background: BRAND.bg,
        color: BRAND.deep,
        border: `1px solid ${BRAND.primary}40`,
      },
    });
  };

  const handleAddOutlineToProject = async (projectId: string) => {
    if (!user) {
      showToast('Please sign in to add outline to a project');
      return;
    }

    try {
      if (!outline?.outline.Chapters.length) {
        showToast('No outline available to add to project');
        return;
      }

      // Check if the project already has an outline
      const project = projectOutline.find((p) => p.id === projectId);
      const outlines = (project as { outlines?: unknown[] } | undefined)?.outlines;
      if (project && Array.isArray(outlines) && outlines.length > 0) {
        const confirmReplace = window.confirm('This project already has an outline. Adding a new outline will override the existing one. Do you want to continue?');
        if (!confirmReplace) return;
      }

      await addOutlineToProject(projectId, title, outline as unknown as { outline?: { Title?: string; Chapters?: Array<Record<string, unknown> | { Chapter: number; Title: string }> } });
      showToast(`Outline added to project: ${project?.name}`);
    } catch (error) {
      console.error("Error adding outline to project:", error);
      showToast('Failed to add outline to project. Please try again.');
    }
  };

  const hasOutline = !loading && !!outline?.outline

  return (
    <div
      className="min-h-full p-4 sm:p-6"
      style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="[font-family:var(--font-playfair,Georgia,serif)] text-2xl font-black text-slate-900 sm:text-3xl"
          >
            Book Outline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate a structured chapter outline for any book title.
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
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleAddOutlineToProject(project.id)}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generateOutline();
                }}
                className="h-11 w-full rounded-lg border border-purple-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <Button
              onClick={generateOutline}
              disabled={loading}
              className="h-11 px-6 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: BRAND.primary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deep)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.primary)}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              ) : "Generate Outline"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      )}

      {/* ── Result card ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">

        {/* Card header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: BRAND.bg }}
          >
            <FileText className="h-4 w-4" style={{ color: BRAND.deep }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: BRAND.deep }}
            >
              {loading
                ? "Generating outline..."
                : outline
                ? "Generated Outline"
                : "Enter a title to generate an outline"}
            </p>
          </div>
        </div>

        {/* Card body */}
        <div className="px-6 py-5 min-h-[320px]">

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-7 w-2/3" />
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
          )}

          {/* Outline content */}
          {!loading && outline?.outline && (
            <div>
              {/* Book title */}
              <h2
                className="[font-family:var(--font-playfair,Georgia,serif)] text-2xl font-bold mb-6"
                style={{ color: BRAND.deep }}
              >
                {outline.outline.Title}
              </h2>

              {outline.outline.Chapters && outline.outline.Chapters.length > 0 ? (
                <div className="space-y-6">
                  {outline.outline.Chapters.map((chapter) => (
                    <div
                      key={chapter.Chapter}
                      className="rounded-xl border border-slate-100 p-5"
                      style={{ borderLeft: `3px solid ${BRAND.primary}` }}
                    >
                      {/* Chapter heading */}
                      <h3
                        className="[font-family:var(--font-playfair,Georgia,serif)] text-lg font-bold mb-3"
                        style={{ color: BRAND.deep }}
                      >
                        Chapter {chapter.Chapter}: {chapter.Title}
                      </h3>

                      {/* Chapter fields */}
                      <div className="space-y-3 ml-1">
                        {Object.entries(chapter)
                          .filter(([key]) => !['Chapter', 'Title'].includes(key))
                          .map(([key, value]) => (
                            <div key={key}>
                              <h4
                                className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                                style={{ color: BRAND.gray }}
                              >
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </h4>
                              {renderOutlineValue(value)}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: BRAND.gray }}>
                  No chapters available in this outline.
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !outline && (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: BRAND.bg }}
              >
                <BookOpen className="h-6 w-6" style={{ color: BRAND.deep }} />
              </div>
              <p className="text-sm" style={{ color: BRAND.gray }}>
                Enter a book title above and click &quot;Generate Outline&quot; to get started
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
