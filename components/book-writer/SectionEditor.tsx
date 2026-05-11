"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Undo2, Redo2, Loader2, PenLine, Wand2, MessageSquare,
  Check, Lock, ChevronRight, Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import CommentPopover from "@/components/book-writer/CommentPopover"
import type { Section } from "@/app/types/firebase"

interface SectionEditorProps {
  section: (Section & { id: string }) | null
  chapterTitle: string
  chapterNumber: number
  totalSections: number
  sections: (Section & { id: string })[]
  onGenerateDraft: (authorNotes?: string) => void
  onSaveContent: (html: string, wordCount: number) => void
  onApprove: () => void
  onApplyRevisions: () => void
  onRegenerate: () => void
  onMakeChanges: () => void
  onAddComment: (comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onSelectSection: (sectionId: string) => void
  generating: boolean
  revising: boolean
  saving: boolean
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

export default function SectionEditor({
  section,
  chapterTitle,
  chapterNumber,
  totalSections,
  sections,
  onGenerateDraft,
  onSaveContent,
  onApprove,
  onApplyRevisions,
  onRegenerate,
  onMakeChanges,
  onAddComment,
  onSelectSection,
  generating,
  revising,
  saving,
}: SectionEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef(section?.content || "")
  const [manualOverride, setManualOverride] = useState(false)
  const [authorNotes, setAuthorNotes] = useState("")
  const [commentPopover, setCommentPopover] = useState<{
    position: { top: number; left: number }
    selectedText: string
    startOffset: number
    endOffset: number
  } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Reset manual override when section changes
  useEffect(() => {
    setManualOverride(false)
    setAuthorNotes("")
    setCommentPopover(null)
  }, [section?.id])

  // Update lastSavedContent ref when section changes
  useEffect(() => {
    lastSavedContent.current = section?.content || ""
  }, [section?.id, section?.content])

  const status = section?.status || "not_started"
  const isEditable = status === "review" || manualOverride

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Highlight.configure({
        multicolor: false,
      }),
    ],
    content: section?.content || "",
    editable: isEditable,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[400px] px-8 py-6",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()

      // Debounced autosave
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (html !== lastSavedContent.current) {
          lastSavedContent.current = html
          onSaveContent(html, countWords(html))
        }
      }, 10000)
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && section?.content !== undefined && section.content !== editor.getHTML()) {
      editor.commands.setContent(section.content)
      lastSavedContent.current = section.content
    }
  }, [section?.content, editor])

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable)
    }
  }, [isEditable, editor])

  // Save immediately on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (editor) {
        const html = editor.getHTML()
        if (html !== lastSavedContent.current) {
          onSaveContent(html, countWords(html))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Keyboard shortcut: Cmd+Shift+M for comment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "m") {
        e.preventDefault()
        handleCommentClick()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const forceSave = useCallback(() => {
    if (!editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const html = editor.getHTML()
    const wc = countWords(html)
    lastSavedContent.current = html
    onSaveContent(html, wc)
  }, [editor, onSaveContent])

  const handleCommentClick = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return

    const selectedText = editor.state.doc.textBetween(from, to, " ")
    if (!selectedText.trim()) return

    // Get position from the editor view coordinates
    const coords = editor.view.coordsAtPos(from)
    const containerRect = editorContainerRef.current?.getBoundingClientRect()

    const top = containerRect ? coords.top - containerRect.top + 30 : coords.top
    const left = containerRect ? coords.left - containerRect.left : coords.left

    setCommentPopover({
      position: { top, left: Math.min(left, 300) },
      selectedText,
      startOffset: from,
      endOffset: to,
    })
  }, [editor])

  const handleCommentSubmit = useCallback((feedback: string) => {
    if (!commentPopover || !editor) return

    onAddComment({
      selectedText: commentPopover.selectedText,
      startOffset: commentPopover.startOffset,
      endOffset: commentPopover.endOffset,
      authorFeedback: feedback,
    })

    // Highlight the selected text
    editor.chain()
      .focus()
      .setTextSelection({ from: commentPopover.startOffset, to: commentPopover.endOffset })
      .toggleHighlight()
      .run()

    setCommentPopover(null)
  }, [commentPopover, editor, onAddComment])

  // Pending comment count
  const pendingComments = section?.comments?.filter(c => c.status === "pending").length || 0

  // Section tab navigation helpers
  const isSectionClickable = (idx: number): boolean => {
    const sec = sections[idx]
    if (!sec) return false
    if (sec.id === section?.id) return true
    if (sec.status === "approved") return true
    // Next section after current is clickable if previous is approved
    if (idx > 0 && sections[idx - 1]?.status === "approved") return true
    return false
  }

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>{totalSections === 0 ? "Plan this chapter\u2019s sections to get started" : "Select a section to begin editing"}</p>
      </div>
    )
  }

  // Toolbar button helper
  const ToolBtn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  )

  // -- State A: not_started --
  if (status === "not_started" && !manualOverride && !generating) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto">
              <PenLine className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h3
                className="text-lg font-semibold text-gray-900"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {section.title}
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Section {section.sectionNumber} of Chapter {chapterNumber}: {chapterTitle}
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                value={authorNotes}
                onChange={(e) => setAuthorNotes(e.target.value)}
                placeholder="Add direction before generating (optional)..."
                className="w-full text-sm border border-purple-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                rows={3}
              />
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => onGenerateDraft(authorNotes || undefined)}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-300/30"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate AI Draft
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setManualOverride(true)
                  setTimeout(() => editor?.commands.focus(), 0)
                }}
                className="border-purple-200 hover:bg-purple-50"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Write Manually
              </Button>
            </div>
          </div>
        </div>

        {/* Section navigation tabs */}
        <SectionTabs
          sections={sections}
          currentSectionId={section.id}
          isSectionClickable={isSectionClickable}
          onSelectSection={onSelectSection}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-purple-100 bg-gray-50/50 text-xs text-gray-400 flex-shrink-0">
          <span>0 words</span>
          <span>Auto-saves after 10s</span>
        </div>
      </div>
    )
  }

  if (!editor) return null

  // -- State D: approved (read-only) --
  if (status === "approved" && !manualOverride) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with badge and button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-purple-100 bg-white/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <Check className="h-3 w-3" />
              Approved
            </span>
            <span className="text-sm text-gray-500" style={{ fontFamily: "var(--font-playfair)" }}>
              {section.title}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onMakeChanges}
            className="border-purple-200 hover:bg-purple-50 text-xs"
          >
            Make Changes
          </Button>
        </div>

        {/* Read-only editor */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Section navigation tabs */}
        <SectionTabs
          sections={sections}
          currentSectionId={section.id}
          isSectionClickable={isSectionClickable}
          onSelectSection={onSelectSection}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-purple-100 bg-gray-50/50 text-xs text-gray-400 flex-shrink-0">
          <span>{countWords(editor.getHTML())} words</span>
          <span>Read-only</span>
        </div>
      </div>
    )
  }

  // -- States B (generating), C (review/editing), and manualOverride --
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {isEditable && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-purple-100 bg-white/80 flex-shrink-0">
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
            <List className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo2 className="h-4 w-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={handleCommentClick} title="Add Comment (Cmd+Shift+M)">
            <MessageSquare className="h-4 w-4" />
          </ToolBtn>

          <div className="flex-1" />

          <button onClick={forceSave} className="text-xs text-gray-400 hover:text-purple-600 transition-colors px-2 flex items-center gap-1">
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto relative" ref={editorContainerRef}>
        {/* Generating overlay (State B) */}
        {(generating || status === "generating") && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-purple-500 animate-spin mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">
                  Writing Section {section.sectionNumber}...
                </p>
                <p className="text-sm text-gray-500 mt-1">This may take 30-60 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* Revising overlay */}
        {revising && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-purple-500 animate-spin mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">Applying revisions...</p>
                <p className="text-sm text-gray-500 mt-1">Incorporating your feedback</p>
              </div>
            </div>
          </div>
        )}

        <EditorContent editor={editor} />

        {/* Comment popover */}
        {commentPopover && (
          <CommentPopover
            position={commentPopover.position}
            selectedText={commentPopover.selectedText}
            onSubmit={handleCommentSubmit}
            onClose={() => setCommentPopover(null)}
          />
        )}
      </div>

      {/* Action bar (State C: review) */}
      {isEditable && !generating && !revising && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-purple-100 bg-purple-50/50 flex-shrink-0">
          <Button
            onClick={onApplyRevisions}
            disabled={pendingComments === 0}
            variant="outline"
            size="sm"
            className="border-purple-200 hover:bg-purple-100 text-purple-700 text-xs"
          >
            Apply AI Revisions
            {pendingComments > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                {pendingComments}
              </span>
            )}
          </Button>

          <Button
            onClick={onApprove}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white text-xs"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Approve & Next
          </Button>

          <Button
            onClick={onRegenerate}
            variant="outline"
            size="sm"
            className="border-gray-200 hover:bg-gray-100 text-gray-600 text-xs"
          >
            Regenerate
          </Button>

          <div className="flex-1" />

          <span className="text-xs text-gray-400">
            Section {section.sectionNumber} of {totalSections}
          </span>
        </div>
      )}

      {/* Section navigation tabs */}
      <SectionTabs
        sections={sections}
        currentSectionId={section.id}
        isSectionClickable={isSectionClickable}
        onSelectSection={onSelectSection}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-purple-100 bg-gray-50/50 text-xs text-gray-400 flex-shrink-0">
        <span>{countWords(editor.getHTML())} words</span>
        <span>
          {saving ? "Saving..." : "Auto-saves after 10s"}
        </span>
      </div>
    </div>
  )
}

// ----- Section Tabs sub-component -----

function SectionTabs({
  sections,
  currentSectionId,
  isSectionClickable,
  onSelectSection,
}: {
  sections: (Section & { id: string })[]
  currentSectionId: string
  isSectionClickable: (idx: number) => boolean
  onSelectSection: (sectionId: string) => void
}) {
  if (sections.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-t border-purple-100 bg-white overflow-x-auto flex-shrink-0">
      {sections.map((sec, idx) => {
        const isCurrent = sec.id === currentSectionId
        const isApproved = sec.status === "approved"
        const clickable = isSectionClickable(idx)

        return (
          <button
            key={sec.id}
            onClick={() => clickable && onSelectSection(sec.id)}
            disabled={!clickable}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
              ${isCurrent
                ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                : isApproved
                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                  : clickable
                    ? "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    : "bg-gray-50 text-gray-300 cursor-not-allowed"
              }
            `}
          >
            {isApproved ? (
              <Check className="h-3 w-3" />
            ) : isCurrent ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            <span>{"\u00A7"} {sec.sectionNumber}</span>
          </button>
        )
      })}
    </div>
  )
}
