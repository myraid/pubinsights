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
  Palette, History, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import CommentPopover from "@/components/book-writer/CommentPopover"
import type { Section, StyleProfile } from "@/app/types/firebase"

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

interface SectionBlockProps {
  section: Section & { id: string }
  isFocused: boolean
  isLocked: boolean
  onFocus: (sectionId: string) => void
  onGenerateDraft: (sectionId: string, authorNotes?: string) => void
  onSaveContent: (sectionId: string, html: string, wordCount: number) => void
  onApprove: (sectionId: string) => void
  onApplyRevisions: (sectionId: string) => void
  onValidate: (sectionId: string) => void
  validating: boolean
  validationResult: { valid: boolean; issues: Array<{ location: string; message: string }>; suggestions: string[] } | null
  onMakeChanges: (sectionId: string) => void
  onAddComment: (sectionId: string, comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onDeleteComment: (sectionId: string, commentId: string) => void
  onAuthorNotesChange: (sectionId: string, notes: string) => void
  onRestoreVersion: (sectionId: string, content: string) => void
  styleProfile: StyleProfile | null
  generating: boolean
  revising: boolean
  saving: boolean
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
  onValidate,
  validating,
  validationResult,
  onMakeChanges,
  onAddComment,
  onDeleteComment,
  onAuthorNotesChange,
  onRestoreVersion,
  styleProfile,
  generating,
  revising,
  saving,
}: SectionBlockProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef(section.content || "")
  const [manualOverride, setManualOverride] = useState(false)
  const [preGenNotes, setPreGenNotes] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  // Reset manual override and notes when focus changes
  useEffect(() => {
    setManualOverride(false)
    setPreGenNotes("")
    setCommentPopover(null)
    setLocalNotes(section.authorNotes || "")
  }, [section.id, section.authorNotes])

  // Tiptap editor — only mounted when this section is focused and has content/is editable
  const shouldMountEditor = isFocused && (status === "review" || status === "approved" || manualOverride || generating)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Highlight.configure({ multicolor: false }),
    ],
    content: section.content || "",
    editable: isEditable,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[300px] px-8 py-6",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (html !== lastSavedContent.current) {
          lastSavedContent.current = html
          onSaveContent(section.id, html, countWords(html))
        }
      }, 10000)
    },
  })

  // Sync content when section data changes externally
  useEffect(() => {
    if (editor && section.content !== undefined && section.content !== editor.getHTML()) {
      editor.commands.setContent(section.content)
      lastSavedContent.current = section.content
    }
  }, [section.content, editor])

  // Sync editable state
  useEffect(() => {
    if (editor) editor.setEditable(isEditable)
  }, [isEditable, editor])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (editor) {
        const html = editor.getHTML()
        if (html !== lastSavedContent.current) {
          onSaveContent(section.id, html, countWords(html))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const forceSave = useCallback(() => {
    if (!editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const html = editor.getHTML()
    lastSavedContent.current = html
    onSaveContent(section.id, html, countWords(html))
  }, [editor, onSaveContent, section.id])

  const handleCommentClick = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return
    const selectedText = editor.state.doc.textBetween(from, to, " ")
    if (!selectedText.trim()) return
    const coords = editor.view.coordsAtPos(from)
    const containerRect = editorContainerRef.current?.getBoundingClientRect()
    const top = containerRect ? coords.top - containerRect.top + 30 : coords.top
    const left = containerRect ? coords.left - containerRect.left : coords.left
    setCommentPopover({ position: { top, left: Math.min(left, 300) }, selectedText, startOffset: from, endOffset: to })
  }, [editor])

  const handleCommentSubmit = useCallback((feedback: string) => {
    if (!commentPopover || !editor) return
    onAddComment(section.id, {
      selectedText: commentPopover.selectedText,
      startOffset: commentPopover.startOffset,
      endOffset: commentPopover.endOffset,
      authorFeedback: feedback,
    })
    editor.chain().focus()
      .setTextSelection({ from: commentPopover.startOffset, to: commentPopover.endOffset })
      .toggleHighlight().run()
    setCommentPopover(null)
  }, [commentPopover, editor, onAddComment, section.id])

  const handleNotesChange = (value: string) => {
    setLocalNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      onAuthorNotesChange(section.id, value)
    }, 5000)
  }

  const pendingComments = (section.comments || []).filter(c => c.status === "pending")

  // Locked state
  if (isLocked) {
    return (
      <div className="opacity-40 pointer-events-none">
        <div className="border border-gray-200 rounded-xl bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{section.sectionNumber}</span>
            <span className="text-sm font-medium">{section.title}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Complete previous sections to unlock</p>
        </div>
      </div>
    )
  }

  // Not started — show generate prompt
  if (status === "not_started" && !manualOverride && !generating) {
    return (
      <div
        className={`border rounded-xl transition-all cursor-pointer ${
          isFocused ? "border-purple-300 bg-white shadow-sm ring-1 ring-purple-200" : "border-gray-200 bg-white hover:border-purple-200 hover:shadow-sm"
        }`}
        onClick={() => onFocus(section.id)}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{section.sectionNumber}</span>
            <h4 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>{section.title}</h4>
          </div>

          {section.outlineContext && (
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">{section.outlineContext}</p>
          )}

          {isFocused && (
            <div className="space-y-3 mt-4">
              <textarea
                value={preGenNotes}
                onChange={(e) => setPreGenNotes(e.target.value)}
                placeholder="Add direction before generating (optional)..."
                className="w-full text-sm border border-purple-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                rows={2}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); onGenerateDraft(section.id, preGenNotes || undefined) }}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-xs shadow-md shadow-purple-300/30"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  Generate AI Draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setManualOverride(true) }}
                  className="border-purple-200 hover:bg-purple-50 text-xs"
                >
                  <PenLine className="h-3.5 w-3.5 mr-1.5" />
                  Write Manually
                </Button>
              </div>
            </div>
          )}

          {!isFocused && section.estimatedWords > 0 && (
            <p className="text-xs text-gray-400 mt-2">Target: ~{section.estimatedWords} words</p>
          )}
        </div>
      </div>
    )
  }

  // Generating overlay
  if (generating || status === "generating") {
    return (
      <div className="border border-purple-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 px-6 py-3.5 border-b border-purple-50">
          <span className="text-xs font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{section.sectionNumber}</span>
          <h4 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>{section.title}</h4>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 text-purple-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-gray-700">Writing Section {section.sectionNumber}...</p>
            <p className="text-xs text-gray-400">This may take 30-60 seconds</p>
          </div>
        </div>
      </div>
    )
  }

  // Approved (read-only, click to edit)
  if (status === "approved" && !manualOverride && !isFocused) {
    return (
      <div
        className="border border-purple-100 rounded-xl bg-purple-50/20 hover:shadow-sm transition-all cursor-pointer"
        onClick={() => onFocus(section.id)}
      >
        <div className="flex items-center gap-2 px-6 py-3.5 border-b border-purple-50">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="h-3 w-3" /> Approved
          </span>
          <span className="text-xs font-mono text-green-600">{section.sectionNumber}</span>
          <h4 className="text-sm font-medium text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>{section.title}</h4>
          <span className="text-xs text-gray-400 ml-auto">{section.wordCount.toLocaleString()} words</span>
        </div>
        {section.content && (
          <div
            className="prose prose-sm max-w-none px-8 py-4 text-gray-600 line-clamp-3"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
      </div>
    )
  }

  // Review (unfocused) — collapsed preview
  if ((status === "review" || status === "approved") && !isFocused) {
    return (
      <div
        className="border border-gray-200 rounded-xl bg-white hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer"
        onClick={() => onFocus(section.id)}
      >
        <div className="flex items-center gap-2 px-6 py-3.5 border-b border-gray-100">
          <span className="text-xs font-mono bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{section.sectionNumber}</span>
          <h4 className="text-sm font-medium text-gray-800" style={{ fontFamily: "var(--font-playfair)" }}>{section.title}</h4>
          {pendingComments.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <MessageSquare className="h-2.5 w-2.5" /> {pendingComments.length}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{section.wordCount.toLocaleString()} words</span>
        </div>
        {section.content && (
          <div
            className="prose prose-sm max-w-none px-8 py-4 text-gray-600 line-clamp-3"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
      </div>
    )
  }

  // Focused active editing (review, approved+makeChanges, or manualOverride)
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

  return (
    <div className="border border-purple-300 rounded-xl bg-white shadow-md ring-1 ring-purple-200">
      {/* Section header */}
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-purple-100 bg-purple-50/30 rounded-t-xl">
        <span className="text-xs font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{section.sectionNumber}</span>
        <h4 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>{section.title}</h4>
        {status === "approved" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="h-3 w-3" /> Approved
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1 transition-colors"
        >
          {drawerOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Details
        </button>
      </div>

      {/* Inline metadata drawer */}
      {drawerOpen && (
        <div className="px-5 py-3 bg-gray-50/80 border-b border-purple-100 space-y-3">
          {/* Outline context */}
          {section.outlineContext && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                <FileText className="h-3 w-3 text-purple-400" /> Outline Context
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{section.outlineContext}</p>
            </div>
          )}

          {/* Author notes */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <PenLine className="h-3 w-3 text-purple-400" /> Author Notes
            </div>
            <textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add direction for AI generation..."
              className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 min-h-[60px] bg-white"
            />
          </div>

          {/* Style profile */}
          {styleProfile && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                <Palette className="h-3 w-3 text-purple-400" /> Style Profile
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["tone", "vocabulary", "sentenceStructure", "narrativeApproach", "pointOfView"] as const).map(field => (
                  <div key={field}>
                    <span className="text-xs text-gray-400 capitalize">{field.replace(/([A-Z])/g, " $1")}:</span>
                    <p className="text-xs text-gray-600">{styleProfile[field]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revision history */}
          {(section.revisionHistory || []).length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                <History className="h-3 w-3 text-purple-400" /> Revisions ({section.revisionHistory.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[...section.revisionHistory].reverse().map((rev) => (
                  <Button
                    key={rev.version}
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestoreVersion(section.id, rev.content)}
                    className="text-xs h-6 text-purple-600 hover:bg-purple-50"
                  >
                    v{rev.version}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Comments list */}
          {pendingComments.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                <MessageSquare className="h-3 w-3 text-purple-400" /> Comments ({pendingComments.length})
              </div>
              <div className="space-y-1.5">
                {pendingComments.map(c => (
                  <div key={c.id} className="bg-purple-50 rounded p-2 text-xs">
                    <p className="text-gray-500 italic line-clamp-1">&ldquo;{c.selectedText}&rdquo;</p>
                    <p className="text-gray-700 mt-0.5">{c.authorFeedback}</p>
                    <button
                      onClick={() => onDeleteComment(section.id, c.id)}
                      className="text-gray-400 hover:text-red-500 mt-0.5 flex items-center gap-0.5 text-xs"
                    >
                      <Trash2 className="h-2.5 w-2.5" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      {isEditable && editor && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-purple-100 bg-white">
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <ToolBtn onClick={handleCommentClick} title="Add Comment (Cmd+Shift+M)">
            <MessageSquare className="h-3.5 w-3.5" />
          </ToolBtn>
          <div className="flex-1" />
          <button onClick={forceSave} className="text-xs text-gray-400 hover:text-purple-600 px-1.5 flex items-center gap-1">
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* Editor area or revising overlay */}
      <div className="relative" ref={editorContainerRef}>
        {revising && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-gray-700">Applying revisions...</p>
            </div>
          </div>
        )}

        {shouldMountEditor && editor ? (
          <EditorContent editor={editor} />
        ) : (
          section.content && (
            <div
              className="prose prose-lg max-w-none px-8 py-6"
              dangerouslySetInnerHTML={{ __html: section.content }}
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

      {/* Validation result display */}
      {validationResult && isFocused && (
        <div className={`mx-4 mb-0 mt-2 rounded-lg p-3 text-xs ${validationResult.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            {validationResult.valid ? (
              <><Check className="h-3.5 w-3.5 text-emerald-600" /> Flow looks good</>
            ) : (
              <><MessageSquare className="h-3.5 w-3.5 text-amber-600" /> {validationResult.issues.length} issue{validationResult.issues.length !== 1 ? 's' : ''} found</>
            )}
          </div>
          {validationResult.issues.map((issue, i) => (
            <div key={i} className="mt-1.5 pl-5">
              <p className="text-gray-500 italic">&ldquo;{issue.location}&rdquo;</p>
              <p className="text-gray-700 mt-0.5">{issue.message}</p>
            </div>
          ))}
          {validationResult.suggestions.length > 0 && (
            <div className="mt-2 pl-5 text-gray-600">
              {validationResult.suggestions.map((s, i) => (
                <p key={i} className="mt-0.5">{s}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      {isFocused && isEditable && !generating && !revising && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-purple-100 bg-purple-50/30 rounded-b-xl">
          <Button
            onClick={() => onApplyRevisions(section.id)}
            disabled={pendingComments.length === 0}
            variant="outline"
            size="sm"
            className="border-purple-200 hover:bg-purple-100 text-purple-700 text-xs"
          >
            Revise with AI
            {pendingComments.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] font-bold">
                {pendingComments.length}
              </span>
            )}
          </Button>
          <Button
            onClick={() => onApprove(section.id)}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            onClick={() => onValidate(section.id)}
            disabled={validating}
            variant="outline"
            size="sm"
            className="border-purple-200 hover:bg-purple-50 text-purple-600 text-xs"
          >
            {validating ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Validating...</>
            ) : (
              <><Check className="h-3 w-3 mr-1" /> Validate</>
            )}
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400">
            {editor ? countWords(editor.getHTML()) : section.wordCount} words
            {" \u00B7 "}
            {saving ? "Saving..." : "Auto-saves"}
          </span>
        </div>
      )}

      {/* Approved focused — show make changes button */}
      {isFocused && status === "approved" && !manualOverride && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-purple-100 bg-purple-50/30 rounded-b-xl">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMakeChanges(section.id)}
            className="border-purple-200 hover:bg-purple-50 text-xs"
          >
            Make Changes
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400">{section.wordCount.toLocaleString()} words</span>
        </div>
      )}
    </div>
  )
}
