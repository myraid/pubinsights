"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Undo2, Redo2, Loader2, PenLine, Wand2, MessageSquare,
  Check, Save, ChevronDown, ChevronRight, FileText,
  Palette, History, Trash2, Sparkles, Quote, Highlighter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import CommentPopover from "@/components/book-writer/CommentPopover"
import type { Section, StyleProfile } from "@/app/types/firebase"
import { applyCommentHighlights, htmlToPreviewText, stripHighlightMarks } from "@/app/lib/html-marks"
import { typeHtmlInto, type TypewriterHandle } from "@/app/lib/typewriter"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

function CollapsedBodyPreview({ html, title }: { html?: string; title: string }) {
  const preview = htmlToPreviewText(html || "", title)
  if (!preview) return null
  return (
    <p className="line-clamp-3 px-8 py-4 text-sm leading-relaxed text-gray-600">
      {preview}
    </p>
  )
}

interface SectionBlockProps {
  section: Section & { id: string }
  isFocused: boolean
  isLocked: boolean
  onFocus: (sectionId: string) => void
  onGenerateDraft: (sectionId: string, authorNotes?: string) => void
  onSaveContent: (sectionId: string, html: string, wordCount: number) => void
  onApprove: (sectionId: string) => void
  onApplyRevisions: (sectionId: string, content?: string) => void
  onMakeChanges: (sectionId: string) => void
  onAddComment: (sectionId: string, comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onDeleteComment: (sectionId: string, commentId: string) => void
  onAuthorNotesChange: (sectionId: string, notes: string) => void
  onRestoreVersion: (sectionId: string, content: string) => void
  styleProfile: StyleProfile | null
  generating: boolean
  revising: boolean
  saving: boolean
  lastChangesApplied?: string[] | null
  onDismissChanges?: () => void
}

export default function SectionBlock({
  section,
  isFocused,
  isLocked,
  onFocus,
  onGenerateDraft,
  onSaveContent,
  onApprove,
  onApplyRevisions,
  onMakeChanges,
  onAddComment,
  onDeleteComment,
  onAuthorNotesChange,
  onRestoreVersion,
  styleProfile,
  generating,
  revising,
  saving,
  lastChangesApplied,
  onDismissChanges,
}: SectionBlockProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef(stripHighlightMarks(section.content || ""))
  const skipHighlightSave = useRef(false)
  const typewriter = useRef<TypewriterHandle | null>(null)
  const animateNextContent = useRef(false)
  const wasBusy = useRef(false)
  const [manualOverride, setManualOverride] = useState(false)
  const [preGenNotes, setPreGenNotes] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [commentPopover, setCommentPopover] = useState<{
    position: { top: number; left: number }
    selectedText: string
    startOffset: number
    endOffset: number
  } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localNotes, setLocalNotes] = useState(section.authorNotes || "")

  const status = section.status
  const isEditable = isFocused && (status === "review" || manualOverride)
  const pendingComments = (section.comments || []).filter(c => c.status === "pending")
  const pendingHighlightKey = pendingComments.map(c => `${c.id}:${c.selectedText}`).join("|")

  useEffect(() => {
    typewriter.current?.cancel()
    typewriter.current = null
    setManualOverride(false)
    setPreGenNotes("")
    setCommentPopover(null)
    setHasSelection(false)
    setLocalNotes(section.authorNotes || "")
  }, [section.id, section.authorNotes])

  useEffect(() => {
    const busy = generating || revising
    if (busy) wasBusy.current = true
    else if (wasBusy.current) {
      wasBusy.current = false
      animateNextContent.current = true
    }
  }, [generating, revising])

  const shouldMountEditor = isFocused && (status === "review" || status === "approved" || manualOverride || generating)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing, or highlight a passage to leave a comment…" }),
      Highlight.configure({ multicolor: false }),
    ],
    content: section.content || "",
    editable: isEditable,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      if (skipHighlightSave.current) return
      const html = stripHighlightMarks(e.getHTML())
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (html !== lastSavedContent.current) {
          lastSavedContent.current = html
          onSaveContent(section.id, html, countWords(html))
        }
      }, 10000)
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { empty } = e.state.selection
      setHasSelection(!empty)
    },
  })

  useEffect(() => {
    if (!editor) return
    const raw = section.content || ""
    const incoming = stripHighlightMarks(raw)
    const current = stripHighlightMarks(editor.getHTML())
    const needles = pendingComments.map(c => c.selectedText)
    const hasMarks = /<mark\b/i.test(editor.getHTML())

    skipHighlightSave.current = true
    if (incoming !== current || incoming !== raw || (needles.length === 0 && hasMarks)) {
      if (animateNextContent.current && incoming.trim()) {
        // Freshly written by the AI — reveal it as if it were being typed.
        animateNextContent.current = false
        typewriter.current?.cancel()
        // Editability is owned by the isEditable effect below. Touching it here races
        // that effect: this runs first in the same commit, so any value captured now is
        // the pre-generation one, and restoring it later leaves the editor read-only.
        typewriter.current = typeHtmlInto(editor, incoming, {
          onDone: () => {
            typewriter.current = null
            lastSavedContent.current = incoming
            applyCommentHighlights(editor, needles)
            skipHighlightSave.current = false
          },
        })
        return // highlights and the save guard are handled in onDone
      }
      editor.commands.setContent(incoming)
      lastSavedContent.current = incoming
    }
    applyCommentHighlights(editor, needles)
    skipHighlightSave.current = false
    // pendingComments is represented by pendingHighlightKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, section.content, pendingHighlightKey])

  useEffect(() => {
    const raw = section.content || ""
    const incoming = stripHighlightMarks(raw)
    if (incoming === raw) return
    lastSavedContent.current = incoming
    onSaveContent(section.id, incoming, countWords(incoming))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, section.content])

  useEffect(() => {
    if (editor) editor.setEditable(isEditable)
  }, [isEditable, editor])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      // Snap to the final content before the flush below reads it, or unmounting
      // mid-animation would persist a half-typed section.
      typewriter.current?.cancel()
      typewriter.current = null
      if (editor) {
        const html = stripHighlightMarks(editor.getHTML())
        if (html !== lastSavedContent.current) {
          onSaveContent(section.id, html, countWords(html))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const handleCommentClick = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const selectedText = editor.state.doc.textBetween(from, to, " ")
    if (!selectedText.trim()) return
    const coords = editor.view.coordsAtPos(from)
    const containerRect = editorContainerRef.current?.getBoundingClientRect()
    const top = containerRect ? coords.top - containerRect.top + 28 : coords.top
    const left = containerRect ? coords.left - containerRect.left : coords.left
    setCommentPopover({ position: { top, left: Math.min(left, 280) }, selectedText, startOffset: from, endOffset: to })
  }, [editor])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!editor) return
    if (editor.state.selection.empty) return   // nothing selected: leave the native menu
    e.preventDefault()
    handleCommentClick()
  }, [editor, handleCommentClick])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault()
        handleCommentClick()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [handleCommentClick])

  const forceSave = useCallback(() => {
    if (!editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const html = stripHighlightMarks(editor.getHTML())
    lastSavedContent.current = html
    onSaveContent(section.id, html, countWords(html))
  }, [editor, onSaveContent, section.id])

  const handleCommentSubmit = useCallback((feedback: string) => {
    if (!commentPopover || !editor) return
    onAddComment(section.id, {
      selectedText: commentPopover.selectedText,
      startOffset: commentPopover.startOffset,
      endOffset: commentPopover.endOffset,
      authorFeedback: feedback,
    })
    setCommentPopover(null)
    setHasSelection(false)
  }, [commentPopover, editor, onAddComment, section.id])

  const handleNotesChange = (value: string) => {
    setLocalNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      onAuthorNotesChange(section.id, value)
    }, 5000)
  }

  const showChanges = lastChangesApplied != null && pendingComments.length === 0

  useEffect(() => {
    if (!showChanges || !isFocused) return
    document.getElementById(`revision-summary-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [showChanges, isFocused, section.id, lastChangesApplied])

  const bodyFont = { fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" } as const
  const displayFont = { fontFamily: "var(--font-playfair, Georgia, serif)" } as const

  if (isLocked) {
    return (
      <div className="pointer-events-none opacity-45" style={bodyFont}>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-5">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
              {String(section.sectionNumber).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium">{section.title}</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Approve the previous section to unlock this one.</p>
        </div>
      </div>
    )
  }

  if (status === "not_started" && !manualOverride && !generating) {
    return (
      <div
        className="cursor-pointer rounded-2xl border bg-white transition-all"
        style={{
          ...bodyFont,
          borderColor: isFocused ? "rgba(153,0,204,0.35)" : "rgba(153,0,204,0.12)",
          boxShadow: isFocused ? "0 10px 30px -18px rgba(132,0,184,0.45)" : undefined,
        }}
        onClick={() => onFocus(section.id)}
      >
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white"
              style={{ background: BRAND.primary }}
            >
              {String(section.sectionNumber).padStart(2, "0")}
            </span>
            <h4 className="text-base font-semibold" style={{ ...displayFont, color: BRAND.deep }}>{section.title}</h4>
          </div>

          {section.outlineContext && (
            <p className="mb-3 text-sm leading-relaxed" style={{ color: BRAND.gray }}>{section.outlineContext}</p>
          )}

          {isFocused && (
            <div className="mt-4 space-y-3">
              <textarea
                value={preGenNotes}
                onChange={(e) => setPreGenNotes(e.target.value)}
                placeholder="Optional direction before generating…"
                className="w-full resize-none rounded-xl border bg-white p-3 text-sm"
                style={{ borderColor: "rgba(153,0,204,0.25)" }}
                rows={2}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); onGenerateDraft(section.id, preGenNotes || undefined) }}
                  size="sm"
                  className="text-xs text-white"
                  style={{ background: BRAND.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.deep }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.primary }}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Generate AI Draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setManualOverride(true) }}
                  className="text-xs"
                  style={{ borderColor: "rgba(153,0,204,0.3)", color: BRAND.deep }}
                >
                  <PenLine className="mr-1.5 h-3.5 w-3.5" />
                  Write Manually
                </Button>
              </div>
            </div>
          )}

          {!isFocused && section.estimatedWords > 0 && (
            <p className="mt-2 text-xs" style={{ color: BRAND.gray }}>Target: ~{section.estimatedWords} words</p>
          )}
        </div>
      </div>
    )
  }

  if (generating || status === "generating") {
    return (
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ ...bodyFont, borderColor: "rgba(153,0,204,0.25)" }}>
        <div className="flex items-center gap-2 border-b px-6 py-3.5" style={{ borderColor: "rgba(153,0,204,0.1)", background: BRAND.bg }}>
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white" style={{ background: BRAND.primary }}>
            {String(section.sectionNumber).padStart(2, "0")}
          </span>
          <h4 className="text-sm font-semibold" style={displayFont}>{section.title}</h4>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: BRAND.primary }} />
            <p className="text-sm font-medium text-gray-800">Writing section {section.sectionNumber}…</p>
            <p className="text-xs" style={{ color: BRAND.gray }}>This usually takes 30–60 seconds</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "approved" && !manualOverride && !isFocused) {
    return (
      <div
        className="cursor-pointer rounded-2xl border bg-white/90 transition-all hover:shadow-sm"
        style={{ ...bodyFont, borderColor: "rgba(5,150,105,0.25)" }}
        onClick={() => onFocus(section.id)}
      >
        <div className="flex items-center gap-2 border-b border-emerald-50 px-6 py-3.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <Check className="h-3 w-3" /> Approved
          </span>
          <span className="text-xs font-mono text-emerald-700">{String(section.sectionNumber).padStart(2, "0")}</span>
          <h4 className="text-sm font-medium text-gray-800" style={displayFont}>{section.title}</h4>
          <span className="ml-auto text-xs text-gray-400">{section.wordCount.toLocaleString()} words</span>
        </div>
        <CollapsedBodyPreview html={section.content} title={section.title} />
      </div>
    )
  }

  if ((status === "review" || status === "approved") && !isFocused) {
    return (
      <div
        className="cursor-pointer rounded-2xl border bg-white transition-all hover:shadow-sm"
        style={{ ...bodyFont, borderColor: pendingComments.length ? "rgba(245,158,11,0.45)" : "rgba(153,0,204,0.14)" }}
        onClick={() => onFocus(section.id)}
      >
        <div className="flex items-center gap-2 border-b px-6 py-3.5" style={{ borderColor: "rgba(153,0,204,0.08)" }}>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
            style={{ background: "#FFF7ED", color: "#B45309" }}
          >
            {String(section.sectionNumber).padStart(2, "0")}
          </span>
          <h4 className="text-sm font-medium text-gray-800" style={displayFont}>{section.title}</h4>
          {pendingComments.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800" style={{ background: "#FEF3C7" }}>
              <MessageSquare className="h-2.5 w-2.5" />
              {pendingComments.length} comment{pendingComments.length === 1 ? "" : "s"}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">{section.wordCount.toLocaleString()} words</span>
        </div>
        <CollapsedBodyPreview html={section.content} title={section.title} />
      </div>
    )
  }

  const ToolBtn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string
  }) => (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 transition-colors"
      style={active
        ? { background: BRAND.bg, color: BRAND.deep }
        : { color: "#6B7280" }
      }
    >
      {children}
    </button>
  )

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-[0_18px_40px_-28px_rgba(132,0,184,0.55)]"
      style={{ ...bodyFont, borderColor: "rgba(153,0,204,0.28)" }}
    >
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: BRAND.bg, borderBottom: "1px solid rgba(153,0,204,0.12)" }}>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white" style={{ background: BRAND.primary }}>
          {String(section.sectionNumber).padStart(2, "0")}
        </span>
        <h4 className="text-sm font-semibold" style={{ ...displayFont, color: BRAND.deep }}>{section.title}</h4>
        {status === "approved" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <Check className="h-3 w-3" /> Approved
          </span>
        )}
        {status === "review" && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: "rgba(153,0,204,0.12)", color: BRAND.deep }}>
            In review
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: BRAND.gray }}
        >
          {drawerOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Details
        </button>
      </div>

      {drawerOpen && (
        <div className="space-y-3 border-b px-5 py-3" style={{ background: "#FAFAFE", borderColor: "rgba(153,0,204,0.1)" }}>
          {section.outlineContext && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                <FileText className="h-3 w-3" style={{ color: BRAND.primary }} /> Outline
              </div>
              <p className="text-xs leading-relaxed text-gray-600">{section.outlineContext}</p>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
              <PenLine className="h-3 w-3" style={{ color: BRAND.primary }} /> Author notes
            </div>
            <textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Direction for AI generation or revision…"
              className="min-h-[60px] w-full resize-none rounded-md border border-gray-200 bg-white p-2 text-xs"
            />
          </div>
          {styleProfile && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                <Palette className="h-3 w-3" style={{ color: BRAND.primary }} /> Style
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["tone", "vocabulary", "sentenceStructure", "narrativeApproach", "pointOfView"] as const).map(field => (
                  <div key={field}>
                    <span className="text-[10px] capitalize text-gray-400">{field.replace(/([A-Z])/g, " $1")}:</span>
                    <p className="text-xs text-gray-600">{styleProfile[field]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(section.revisionHistory || []).length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                <History className="h-3 w-3" style={{ color: BRAND.primary }} /> Revisions ({section.revisionHistory.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...section.revisionHistory].reverse().map((rev) => (
                  <Button
                    key={rev.version}
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestoreVersion(section.id, rev.content)}
                    className="h-6 text-xs"
                    style={{ color: BRAND.primary }}
                  >
                    v{rev.version}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isEditable && editor && (
        <div className="flex items-center gap-0.5 border-b bg-white px-3 py-1.5" style={{ borderColor: "rgba(153,0,204,0.1)" }}>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-gray-200" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-gray-200" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-gray-200" />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-gray-200" />
          <button
            onClick={handleCommentClick}
            disabled={!hasSelection}
            title={hasSelection ? "Add comment on selection (Cmd+Shift+M)" : "Select text first, then comment"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all"
            style={hasSelection
              ? { background: BRAND.primary, color: "#fff", animation: "comment-glow 1.6s ease-in-out infinite" }
              : { color: "#9CA3AF" }
            }
          >
            <Highlighter className="h-3.5 w-3.5" />
            Comment
          </button>
          <div className="flex-1" />
          <button onClick={forceSave} className="flex items-center gap-1 px-1.5 text-xs" style={{ color: BRAND.gray }}>
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {isEditable && !generating && !revising && (
        <div id={`revision-summary-${section.id}`}>
        <CommentsPanel
          pendingComments={pendingComments}
          showChanges={showChanges}
          lastChangesApplied={lastChangesApplied}
          onDeleteComment={(id) => onDeleteComment(section.id, id)}
          onDismissChanges={onDismissChanges}
          hasSelection={hasSelection}
        />
        </div>
      )}

      <div
        className="relative manuscript-editor"
        ref={editorContainerRef}
        onContextMenu={handleContextMenu}
        style={{ background: "#FFFCFA" }}
      >
        {revising && (
          <ReviseOverlay comments={pendingComments} sectionTitle={section.title} />
        )}

        {shouldMountEditor && editor ? (
          <EditorContent editor={editor} />
        ) : (
          section.content && (
            <div
              className="px-8 py-6 text-[1.0625rem] leading-[1.85] text-[#2a2438]"
              dangerouslySetInnerHTML={{ __html: stripHighlightMarks(section.content) }}
            />
          )
        )}

        {commentPopover && (
          <CommentPopover
            position={commentPopover.position}
            selectedText={commentPopover.selectedText}
            onSubmit={handleCommentSubmit}
            onClose={() => setCommentPopover(null)}
          />
        )}
      </div>

      {isFocused && isEditable && !generating && !revising && (
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: BRAND.bg, borderTop: "1px solid rgba(153,0,204,0.12)" }}>
          <Button
            onClick={() => {
              const html = editor
                ? stripHighlightMarks(editor.getHTML())
                : stripHighlightMarks(section.content || "")
              lastSavedContent.current = html
              onApplyRevisions(section.id, html)
            }}
            disabled={pendingComments.length === 0}
            size="sm"
            className="text-xs text-white shadow-sm"
            style={{
              background: pendingComments.length === 0 ? "#D4B3E8" : BRAND.primary,
            }}
            onMouseEnter={(e) => { if (pendingComments.length > 0) e.currentTarget.style.background = BRAND.deep }}
            onMouseLeave={(e) => { if (pendingComments.length > 0) e.currentTarget.style.background = BRAND.primary }}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {pendingComments.length === 0 ? "Revise with AI" : `Revise ${pendingComments.length} comment${pendingComments.length === 1 ? "" : "s"}`}
          </Button>
          <Button
            onClick={() => onApprove(section.id)}
            size="sm"
            variant="outline"
            className="text-xs"
            style={{ borderColor: "rgba(153,0,204,0.3)", color: BRAND.deep }}
          >
            <Check className="mr-1 h-3 w-3" />
            Approve
          </Button>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: BRAND.gray }}>
            {editor ? countWords(editor.getHTML()) : section.wordCount} words
            {" · "}
            {saving ? "Saving…" : "Auto-saves"}
          </span>
        </div>
      )}

      {isFocused && status === "approved" && !manualOverride && (
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: BRAND.bg, borderTop: "1px solid rgba(153,0,204,0.12)" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMakeChanges(section.id)}
            className="text-xs"
            style={{ borderColor: "rgba(153,0,204,0.3)", color: BRAND.deep }}
          >
            Make Changes
          </Button>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: BRAND.gray }}>{section.wordCount.toLocaleString()} words</span>
        </div>
      )}
    </div>
  )
}

function CommentsPanel({
  pendingComments,
  showChanges,
  lastChangesApplied,
  onDeleteComment,
  onDismissChanges,
  hasSelection,
}: {
  pendingComments: { id: string; selectedText: string; authorFeedback: string }[]
  showChanges: boolean
  lastChangesApplied?: string[] | null
  onDeleteComment: (id: string) => void
  onDismissChanges?: () => void
  hasSelection: boolean
}) {
  if (showChanges && lastChangesApplied) {
    const applied = lastChangesApplied.filter(c => !/^Skipped:/i.test(c))
    const skipped = lastChangesApplied.filter(c => /^Skipped:/i.test(c))
    return (
      <div className="sticky top-0 z-10 border-b px-4 py-3" style={{ background: applied.length ? "#F0FDF4" : "#FFF7ED", borderColor: applied.length ? "rgba(5,150,105,0.2)" : "rgba(245,158,11,0.28)" }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: applied.length ? "#065F46" : "#9A3412" }}>
            {applied.length > 0
              ? `Revision applied · ${applied.length} change${applied.length === 1 ? "" : "s"}`
              : "No wording changed"}
          </p>
          {onDismissChanges && (
            <button onClick={onDismissChanges} className="text-[10px] uppercase tracking-wider hover:underline" style={{ color: applied.length ? "#047857" : "#C2410C" }}>
              Dismiss
            </button>
          )}
        </div>
        {applied.length === 0 && skipped.length === 0 && (
          <p className="text-xs leading-relaxed text-amber-900">
            The AI did not rewrite any text. The commented passage may no longer match the manuscript.
          </p>
        )}
        {applied.length > 0 && (
          <ul className="space-y-1.5">
            {applied.map((change, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-emerald-900">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                {change}
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <ul className={`space-y-1 ${applied.length > 0 ? "mt-2" : ""}`}>
            {skipped.map((change, i) => (
              <li key={i} className="text-xs leading-relaxed text-amber-900/80">{change.replace(/^Skipped:\s*/i, "Skipped: ")}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-10 border-b px-4 py-3" style={{ background: "#FFFBF2", borderColor: "rgba(245,158,11,0.22)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-amber-700" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
            Comments {pendingComments.length > 0 ? `(${pendingComments.length})` : ""}
          </p>
        </div>
        <p className="text-[10px] text-amber-800/80">
          {hasSelection ? "Click Comment to annotate this passage" : "Highlight a passage, then click Comment"}
        </p>
      </div>

      {pendingComments.length === 0 ? (
        <p className="text-xs leading-relaxed text-amber-900/70">
          Highlighted comments tell the AI exactly what to rewrite. Uncommented text is left alone.
        </p>
      ) : (
        <div className="space-y-2">
          {pendingComments.map((c, i) => (
            <div key={c.id} className="rounded-lg border bg-white p-2.5" style={{ borderColor: "rgba(245,158,11,0.28)" }}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#D97706" }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-1 text-[11px] italic leading-snug text-amber-900/70">
                    <Quote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span className="line-clamp-2">&ldquo;{c.selectedText}&rdquo;</span>
                  </p>
                  <p className="mt-1 text-xs font-medium leading-snug text-gray-800">{c.authorFeedback}</p>
                </div>
                <button
                  onClick={() => onDeleteComment(c.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500"
                  aria-label="Remove comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviseOverlay({
  comments,
  sectionTitle,
}: {
  comments: { id: string; selectedText: string; authorFeedback: string }[]
  sectionTitle: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(245,238,255,0.82)", backdropFilter: "blur(8px)" }}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-white p-6 shadow-2xl" style={{ borderColor: "rgba(153,0,204,0.2)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden" style={{ background: BRAND.bg }}>
          <div className="h-full w-1/2" style={{ background: BRAND.primary, animation: "revise-shimmer 1.6s ease-in-out infinite" }} />
        </div>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: BRAND.primary }}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.primary }}>
              Revising
            </p>
            <h5 className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair, Georgia, serif)", color: BRAND.deep }}>
              Applying your comments
            </h5>
            <p className="mt-0.5 text-xs" style={{ color: BRAND.gray }}>{sectionTitle}</p>
          </div>
        </div>
        <div className="space-y-2">
          {comments.map((c, i) => (
            <div key={c.id} className="flex gap-2.5 rounded-xl px-3 py-2.5" style={{ background: BRAND.bg }}>
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: BRAND.primary }}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-1 text-[11px] italic" style={{ color: BRAND.gray }}>&ldquo;{c.selectedText}&rdquo;</p>
                <p className="mt-0.5 text-xs font-medium text-gray-800">{c.authorFeedback}</p>
              </div>
              <Loader2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin" style={{ color: BRAND.primary }} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px]" style={{ color: BRAND.gray }}>
          Only commented passages are rewritten. Everything else stays as you left it.
        </p>
      </div>
    </div>
  )
}
