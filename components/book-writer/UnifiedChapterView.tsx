"use client"

import { useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { FileText } from "lucide-react"
import type { Section, ChapterDocument, StyleProfile } from "@/app/types/firebase"

const SectionBlock = dynamic(() => import("@/components/book-writer/SectionBlock"), { ssr: false })

interface UnifiedChapterViewProps {
  chapter: (ChapterDocument & { id: string }) | null
  sections: (Section & { id: string })[]
  focusedSectionId: string | null
  onFocusSection: (sectionId: string) => void
  onGenerateDraft: (sectionId: string, authorNotes?: string) => void
  onSaveContent: (sectionId: string, html: string, wordCount: number) => void
  onApprove: (sectionId: string) => void
  onApplyRevisions: (sectionId: string) => void
  onValidate: (sectionId: string) => void
  validatingSectionId: string | null
  validationResults: Record<string, { valid: boolean; issues: Array<{ location: string; message: string }>; suggestions: string[] }>
  onMakeChanges: (sectionId: string) => void
  onAddComment: (sectionId: string, comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onDeleteComment: (sectionId: string, commentId: string) => void
  onAuthorNotesChange: (sectionId: string, notes: string) => void
  onRestoreVersion: (sectionId: string, content: string) => void
  styleProfile: StyleProfile | null
  generatingSectionId: string | null
  revisingSectionId: string | null
  savingSectionId: string | null
}

export default function UnifiedChapterView({
  chapter,
  sections,
  focusedSectionId,
  onFocusSection,
  onGenerateDraft,
  onSaveContent,
  onApprove,
  onApplyRevisions,
  onValidate,
  validatingSectionId,
  validationResults,
  onMakeChanges,
  onAddComment,
  onDeleteComment,
  onAuthorNotesChange,
  onRestoreVersion,
  styleProfile,
  generatingSectionId,
  revisingSectionId,
  savingSectionId,
}: UnifiedChapterViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll focused section into view
  useEffect(() => {
    if (!focusedSectionId || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-section-id="${focusedSectionId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusedSectionId])

  if (!chapter) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto">
            <FileText className="h-8 w-8 text-purple-300" />
          </div>
          <p className="text-sm text-gray-500">Select a chapter from the sidebar to start writing</p>
        </div>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto">
            <FileText className="h-8 w-8 text-purple-300" />
          </div>
          <div>
            <p className="text-base font-medium text-gray-700" style={{ fontFamily: "var(--font-playfair)" }}>
              No sections planned yet
            </p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Use &ldquo;Plan Sections&rdquo; in the sidebar to break this chapter into writing sections.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/20" ref={scrollRef}>
      <div className="px-6 lg:px-12 py-10 space-y-6">
        {/* Chapter heading */}
        <div className="mb-8 pb-6 border-b border-purple-100">
          <p className="text-xs font-semibold text-purple-500 uppercase tracking-widest mb-2">
            Chapter {chapter.chapterNumber}
          </p>
          <h2
            className="text-3xl font-bold text-gray-900"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {chapter.title}
          </h2>
          {chapter.outlineContext?.summary && (
            <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-3xl">{chapter.outlineContext.summary}</p>
          )}
        </div>

        {/* Section blocks */}
        {sections.map((sec, idx) => {
          const isLocked = idx > 0 && sections[idx - 1].status !== "approved"

          return (
            <div key={sec.id} data-section-id={sec.id}>
              <SectionBlock
                section={sec}
                isFocused={sec.id === focusedSectionId}
                isLocked={isLocked}
                onFocus={onFocusSection}
                onGenerateDraft={onGenerateDraft}
                onSaveContent={onSaveContent}
                onApprove={onApprove}
                onApplyRevisions={onApplyRevisions}
                onValidate={onValidate}
                validating={validatingSectionId === sec.id}
                validationResult={validationResults[sec.id] || null}
                onMakeChanges={onMakeChanges}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onAuthorNotesChange={onAuthorNotesChange}
                onRestoreVersion={onRestoreVersion}
                styleProfile={styleProfile}
                generating={generatingSectionId === sec.id}
                revising={revisingSectionId === sec.id}
                saving={savingSectionId === sec.id}
              />
            </div>
          )
        })}

        {/* Bottom spacer */}
        <div className="h-40" />
      </div>
    </div>
  )
}
