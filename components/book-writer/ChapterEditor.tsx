"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Undo2, Redo2, Wand2, PenLine, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChapterEditorProps {
  content: string
  onContentChange: (html: string, wordCount: number) => void
  onAIDraft: () => void
  generating: boolean
  saving: boolean
  readOnly?: boolean
  chapterStatus: string
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

export default function ChapterEditor({
  content,
  onContentChange,
  onAIDraft,
  generating,
  saving,
  chapterStatus,
}: ChapterEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef(content)
  // Tracks user's intent to write manually, overrides the empty-state UI
  // so the editor surface gets mounted and can receive focus/keystrokes.
  const [manualOverride, setManualOverride] = useState(false)

  // Reset override when chapter content changes externally (e.g., AI draft loaded)
  useEffect(() => {
    if (content && content !== "<p></p>") setManualOverride(false)
  }, [content])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing or use AI to generate a draft...",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[400px] px-8 py-6",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      const wc = countWords(html)

      // Debounced autosave
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (html !== lastSavedContent.current) {
          lastSavedContent.current = html
          onContentChange(html, wc)
        }
      }, 10000)
    },
  })

  // Sync external content changes (e.g., AI draft loaded)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
      lastSavedContent.current = content
    }
  }, [content, editor])

  // Save immediately on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (editor) {
        const html = editor.getHTML()
        if (html !== lastSavedContent.current) {
          onContentChange(html, countWords(html))
        }
      }
    }
  }, [editor, onContentChange])

  const forceSave = useCallback(() => {
    if (!editor) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const html = editor.getHTML()
    const wc = countWords(html)
    lastSavedContent.current = html
    onContentChange(html, wc)
  }, [editor, onContentChange])

  if (!editor) return null

  const isEmpty = !content || content === "<p></p>"
  const isNotStarted = chapterStatus === "not_started" && isEmpty && !manualOverride

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
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

        <div className="flex-1" />

        <button onClick={forceSave} className="text-xs text-gray-400 hover:text-purple-600 transition-colors px-2">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Empty state / AI prompt */}
      {isNotStarted && !generating ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto">
              <PenLine className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "var(--font-playfair)" }}>
                Ready to write this chapter?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Let AI generate a first draft based on your outline, or start writing from scratch.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={onAIDraft}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-300/30"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Write Draft
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setManualOverride(true)
                  // Focus after the editor surface mounts on next tick
                  setTimeout(() => editor.commands.focus(), 0)
                }}
                className="border-purple-200 hover:bg-purple-50"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Write Manually
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto relative">
          {/* Generating overlay */}
          {generating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 text-purple-500 animate-spin mx-auto" />
                <div>
                  <p className="font-semibold text-gray-900">Writing chapter...</p>
                  <p className="text-sm text-gray-500 mt-1">This may take 30-60 seconds</p>
                </div>
              </div>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-purple-100 bg-gray-50/50 text-xs text-gray-400 flex-shrink-0">
        <span>{countWords(editor.getHTML())} words</span>
        <span>
          {saving ? "Saving..." : "Auto-saves after 10s of inactivity"}
        </span>
      </div>
    </div>
  )
}
