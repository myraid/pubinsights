"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText, PenLine, Palette, History, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Section, StyleProfile } from "@/app/types/firebase"

interface ContextPanelProps {
  section: (Section & { id: string }) | null
  styleProfile: StyleProfile | null
  onAuthorNotesChange: (notes: string) => void
  onDeleteComment: (commentId: string) => void
  onScrollToComment: (commentId: string) => void
  onStyleReextract: () => void
  onRestoreVersion: (content: string) => void
  saving: boolean
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3.5 w-3.5 text-purple-500" />
        {title}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

export default function ContextPanel({
  section,
  styleProfile,
  onAuthorNotesChange,
  onDeleteComment,
  onScrollToComment,
  onStyleReextract,
  onRestoreVersion,
  saving,
}: ContextPanelProps) {
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localNotes, setLocalNotes] = useState(section?.authorNotes || "")

  useEffect(() => {
    setLocalNotes(section?.authorNotes || "")
  }, [section?.id, section?.authorNotes])

  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      onAuthorNotesChange(value)
    }, 10000)
  }, [onAuthorNotesChange])

  if (!section) {
    return (
      <div className="w-[280px] border-l border-gray-200 bg-gray-50/50 flex items-center justify-center">
        <p className="text-xs text-gray-400 px-4 text-center">Select a section to see context</p>
      </div>
    )
  }

  const pendingComments = (section.comments || []).filter(c => c.status === "pending")

  return (
    <div className="w-[280px] border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
      <CollapsibleSection title="Outline Context" icon={FileText} defaultOpen={true}>
        <p className="text-xs text-gray-600 leading-relaxed">
          {section.outlineContext || "No outline context provided."}
        </p>
        {section.estimatedWords > 0 && (
          <p className="text-xs text-gray-400 mt-2">Target: ~{section.estimatedWords} words</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Author Notes" icon={PenLine} defaultOpen={true}>
        <textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add direction for AI generation..."
          className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 min-h-[80px]"
        />
        <p className="text-xs text-gray-400 mt-1">
          {saving ? "Saving..." : "Auto-saves after 10s"}
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Style Profile" icon={Palette} defaultOpen={false}>
        {styleProfile ? (
          <div className="space-y-2">
            {(["tone", "vocabulary", "sentenceStructure", "narrativeApproach", "pointOfView"] as const).map(field => (
              <div key={field}>
                <span className="text-xs font-medium text-gray-500 capitalize">{field.replace(/([A-Z])/g, " $1")}:</span>
                <p className="text-xs text-gray-700">{styleProfile[field]}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={onStyleReextract} className="text-xs h-6 text-purple-600">
              Re-extract
            </Button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Not yet extracted. Available after 3 sections are approved.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={`Revision History (${section.revisionHistory?.length || 0})`} icon={History} defaultOpen={false}>
        {(section.revisionHistory || []).length === 0 ? (
          <p className="text-xs text-gray-400">No revisions yet.</p>
        ) : (
          <div className="space-y-2">
            {[...section.revisionHistory].reverse().map((rev) => (
              <div key={rev.version} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Version {rev.version}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestoreVersion(rev.content)}
                  className="text-xs h-5 text-purple-600"
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {section.status === "review" && (
        <CollapsibleSection title={`Comments (${pendingComments.length})`} icon={MessageSquare} defaultOpen={true}>
          {pendingComments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments. Highlight text and click the comment button to add feedback.</p>
          ) : (
            <div className="space-y-2">
              {pendingComments.map((c) => (
                <div
                  key={c.id}
                  className="bg-yellow-50 rounded p-2 cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => onScrollToComment(c.id)}
                >
                  <p className="text-xs text-gray-500 italic line-clamp-1">&ldquo;{c.selectedText}&rdquo;</p>
                  <p className="text-xs text-gray-700 mt-1">{c.authorFeedback}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteComment(c.id) }}
                    className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}
    </div>
  )
}
