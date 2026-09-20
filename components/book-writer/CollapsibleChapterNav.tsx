"use client"

import { useState } from "react"
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle,
  PenLine, FileText, Lock, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ChapterDocument, Section } from "@/app/types/firebase"

interface CollapsibleChapterNavProps {
  chapters: (ChapterDocument & { id: string })[]
  activeChapterId: string | null
  sections: (Section & { id: string })[]
  focusedSectionId: string | null
  onSelectChapter: (id: string) => void
  onSelectSection: (id: string) => void
  onPlanSections: (chapterId: string) => void
  totalWordCount: number
  completedCount: number
  planningChapterId: string | null
  maxAllowedChapter?: number // chapters above this are locked (undefined = unlimited)
}

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

const chapterStatusIcon: Record<string, { icon: typeof Circle; color: string }> = {
  not_started: { icon: Circle, color: "text-gray-400" },
  planning: { icon: FileText, color: "text-[#9900CC]" },
  writing: { icon: PenLine, color: "text-amber-500" },
  complete: { icon: CheckCircle2, color: "text-green-600" },
}

const sectionStatusIcon: Record<string, { icon: typeof Circle; color: string }> = {
  locked: { icon: Lock, color: "text-gray-300" },
  not_started: { icon: Circle, color: "text-gray-400" },
  generating: { icon: Loader2, color: "text-[#9900CC]" },
  review: { icon: PenLine, color: "text-amber-500" },
  approved: { icon: CheckCircle2, color: "text-green-600" },
}

export default function CollapsibleChapterNav({
  chapters,
  activeChapterId,
  sections,
  focusedSectionId,
  onSelectChapter,
  onSelectSection,
  onPlanSections,
  totalWordCount,
  completedCount,
  planningChapterId,
  maxAllowedChapter,
}: CollapsibleChapterNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const totalChapters = chapters.length
  const progress = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0

  // Collapsed rail
  if (collapsed) {
    return (
      <div className="w-14 flex flex-col items-center py-3 gap-1 flex-shrink-0" style={{ background: "#fff", borderRight: "1px solid rgba(153,0,204,0.12)" }}>
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-purple-50 text-gray-400 hover:text-purple-600 mb-2"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {chapters.map((ch) => {
          const isActive = ch.id === activeChapterId
          const isChapterLocked = maxAllowedChapter !== undefined && ch.chapterNumber > maxAllowedChapter
          const cfg = chapterStatusIcon[ch.status] || chapterStatusIcon.not_started
          const Icon = cfg.icon

          return (
            <button
              key={ch.id}
              onClick={() => !isChapterLocked && onSelectChapter(ch.id)}
              disabled={isChapterLocked}
              title={isChapterLocked ? `Ch. ${ch.chapterNumber}: Locked — upgrade to unlock` : `Ch. ${ch.chapterNumber}: ${ch.title}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                isChapterLocked
                  ? "opacity-40 cursor-not-allowed"
                  : isActive
                    ? "bg-[#F5EEFF] text-[#8400B8] ring-1 ring-[#9900CC]/30"
                    : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {isChapterLocked ? (
                <Lock className="h-3.5 w-3.5 text-gray-400" />
              ) : ch.status === "complete" ? (
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              ) : (
                ch.chapterNumber
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Expanded sidebar
  return (
    <div className="w-64 flex flex-col flex-shrink-0" style={{ background: "#fff", borderRight: "1px solid rgba(153,0,204,0.12)", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(153,0,204,0.12)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>Chapters</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-3 py-2.5 border-b border-purple-50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Progress</span>
          <span className="text-xs text-gray-400">{completedCount}/{totalChapters}</span>
        </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: BRAND.bg }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: BRAND.primary }}
            />
          </div>
        <p className="text-xs text-gray-400 mt-1">{totalWordCount.toLocaleString()} words</p>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((ch) => {
          const isActive = ch.id === activeChapterId
          const isChapterLocked = maxAllowedChapter !== undefined && ch.chapterNumber > maxAllowedChapter
          const cfg = chapterStatusIcon[ch.status] || chapterStatusIcon.not_started
          const Icon = cfg.icon
          const showPlanBtn = isActive && !isChapterLocked && ((ch.sectionPlan?.length ?? 0) === 0 || ch.totalSections === 0)
          const isPlanning = planningChapterId === ch.id

          return (
            <div key={ch.id}>
              <button
                onClick={() => !isChapterLocked && onSelectChapter(ch.id)}
                disabled={isChapterLocked}
                className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                  isChapterLocked
                    ? "opacity-50 cursor-not-allowed border-l-transparent"
                    : isActive
                      ? "bg-[#F5EEFF]/80"
                      : "border-l-transparent hover:bg-gray-50"
                }`}
                style={isChapterLocked ? undefined : isActive ? { borderLeftColor: BRAND.primary } : undefined}
              >
                <div className="flex items-center gap-2">
                  {isChapterLocked ? (
                    <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  ) : (
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.color}`} />
                  )}
                  <span className={`text-xs font-medium truncate ${isChapterLocked ? "text-gray-400" : isActive ? "text-[#8400B8]" : "text-gray-700"}`}>
                    {ch.chapterNumber}. {ch.title}
                  </span>
                </div>
                {ch.totalSections > 0 && (
                  <div className="ml-6 mt-1.5">
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ch.totalSections > 0 ? Math.round((ch.completedSections / ch.totalSections) * 100) : 0}%`, background: BRAND.primary }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{ch.completedSections}/{ch.totalSections} sections</span>
                  </div>
                )}
              </button>

              {/* Plan button */}
              {showPlanBtn && (
                <div className="px-3 py-1.5" style={{ background: "rgba(245,238,255,0.7)" }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7"
                    style={{ borderColor: "rgba(153,0,204,0.35)", color: BRAND.deep }}
                    onClick={() => onPlanSections(ch.id)}
                    disabled={isPlanning}
                  >
                    {isPlanning ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Planning&hellip;</>
                    ) : (
                      "Plan Sections"
                    )}
                  </Button>
                </div>
              )}

              {/* Section list for active chapter */}
              {isActive && sections.length > 0 && (
                <div className="bg-gray-50/50">
                  {sections.map((sec, idx) => {
                    const isLocked = idx > 0 && sections[idx - 1].status !== "approved"
                    const isFocused = sec.id === focusedSectionId
                    const statusKey = isLocked ? "locked" : sec.status
                    const sCfg = sectionStatusIcon[statusKey] || sectionStatusIcon.not_started
                    const SIcon = sCfg.icon

                    const pending = (sec.comments || []).filter(c => c.status === "pending").length
                    return (
                      <button
                        key={sec.id}
                        onClick={() => !isLocked && onSelectSection(sec.id)}
                        disabled={isLocked}
                        className={`w-full text-left pl-7 pr-3 py-2 transition-colors border-l-2 ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed border-l-transparent"
                            : isFocused
                              ? "bg-[#F5EEFF]/80"
                              : "border-l-transparent hover:bg-gray-100"
                        }`}
                        style={!isLocked && isFocused ? { borderLeftColor: BRAND.primary } : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          <SIcon className={`h-3 w-3 flex-shrink-0 ${sCfg.color} ${sec.status === "generating" && !isLocked ? "animate-spin" : ""}`} />
                          <span className={`text-xs truncate ${isFocused ? "font-medium text-[#8400B8]" : "text-gray-600"}`}>
                            {sec.sectionNumber}. {sec.title}
                          </span>
                          {pending > 0 && !isLocked && (
                            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: "#D97706" }}>
                              {pending}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
