"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquarePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

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
      className="absolute z-50 w-80 rounded-xl border bg-white p-3.5 shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        borderColor: "rgba(153,0,204,0.22)",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: BRAND.primary }}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Comment for AI
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close comment">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className="mb-2.5 line-clamp-3 rounded-md px-2.5 py-1.5 text-xs italic"
        style={{ background: "#FFF8E8", color: "#92400E", borderLeft: "3px solid #F59E0B" }}
      >
        &ldquo;{selectedText}&rdquo;
      </div>
      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tell the AI what to change in this passage…"
        className="w-full resize-none rounded-md border border-gray-200 p-2 text-sm focus:outline-none focus:ring-1"
        style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
        rows={3}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.gray }}>
          Enter to add
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!feedback.trim()}
            className="h-7 text-xs text-white"
            style={{ background: BRAND.primary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.deep }}
            onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.primary }}
          >
            Add Comment
          </Button>
        </div>
      </div>
    </div>
  )
}
