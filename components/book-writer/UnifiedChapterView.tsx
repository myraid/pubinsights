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
  onApplyRevisions: (sectionId: string, content?: string) => void
  onMakeChanges: (sectionId: string) => void
  onAddComment: (sectionId: string, comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onDeleteComment: (sectionId: string, commentId: string) => void
  onAuthorNotesChange: (sectionId: string, notes: string) => void
  onRestoreVersion: (sectionId: string, content: string) => void
  styleProfile: StyleProfile | null
  generatingSectionId: string | null
  revisingSectionId: string | null
  savingSectionId: string | null
  lastRevision?: { sectionId: string; changes: string[] } | null
  onDismissChanges?: () => void
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
  onMakeChanges,
  onAddComment,
  onDeleteComment,
  onAuthorNotesChange,
  onRestoreVersion,
  styleProfile,
  generatingSectionId,
  revisingSectionId,
  savingSectionId,
  lastRevision,
  onDismissChanges,
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
        <div className="space-y-4 text-center" style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#F5EEFF" }}>
            <FileText className="h-8 w-8" style={{ color: "#9900CC" }} />
          </div>
          <p className="text-sm text-gray-500">Select a chapter from the sidebar to start writing</p>
        </div>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md" style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#F5EEFF" }}>
            <FileText className="h-8 w-8" style={{ color: "#9900CC" }} />
          </div>
          <div>
            <p className="text-base font-medium" style={{ fontFamily: "var(--font-playfair, Georgia, serif)", color: "#8400B8" }}>
              No sections planned yet
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6E6E6E" }}>
              Use &ldquo;Plan Sections&rdquo; in the sidebar to break this chapter into writing sections.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollRef} style={{ background: "linear-gradient(180deg, #F5EEFF 0%, #FFFCFA 180px)" }}>
      <div className="space-y-6 px-6 py-10 lg:px-12">
        <div className="mb-8 border-b pb-6" style={{ borderColor: "rgba(153,0,204,0.14)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "#9900CC", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
            Chapter {chapter.chapterNumber}
          </p>
          <h2
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-playfair, Georgia, serif)", color: "#8400B8" }}
          >
            {chapter.title}
          </h2>
          {chapter.outlineContext?.summary && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "#6E6E6E", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
              {chapter.outlineContext.summary}
            </p>
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
                onMakeChanges={onMakeChanges}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onAuthorNotesChange={onAuthorNotesChange}
                onRestoreVersion={onRestoreVersion}
                styleProfile={styleProfile}
                generating={generatingSectionId === sec.id}
                revising={revisingSectionId === sec.id}
                saving={savingSectionId === sec.id}
                lastChangesApplied={lastRevision?.sectionId === sec.id ? lastRevision.changes : null}
                onDismissChanges={onDismissChanges}
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
