"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CommentPopoverProps {
  position: { top: number; left: number }
  selectedText: string
  onSubmit: (feedback: string) => void
  onClose: () => void
}

export default function CommentPopover({ position, selectedText, onSubmit, onClose }: CommentPopoverProps) {
  const [feedback, setFeedback] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!feedback.trim()) return
    onSubmit(feedback.trim())
    setFeedback("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <div
      className="absolute z-50 w-72 bg-white rounded-lg shadow-xl border border-purple-200 p-3"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
          <MessageSquare className="h-3.5 w-3.5" />
          Add Comment
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-xs text-gray-500 bg-yellow-50 rounded px-2 py-1 mb-2 line-clamp-2 italic">
        &ldquo;{selectedText}&rdquo;
      </div>
      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What should change? e.g., 'Add more data here'"
        className="w-full text-sm border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
        rows={3}
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!feedback.trim()}
          className="text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white"
        >
          Add Comment
        </Button>
      </div>
    </div>
  )
}
