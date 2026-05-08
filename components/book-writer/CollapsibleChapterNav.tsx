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
}

const chapterStatusIcon: Record<string, { icon: typeof Circle; color: string }> = {
  not_started: { icon: Circle, color: "text-gray-400" },
  planning: { icon: FileText, color: "text-purple-500" },
  writing: { icon: PenLine, color: "text-amber-500" },
  complete: { icon: CheckCircle2, color: "text-green-600" },
}

const sectionStatusIcon: Record<string, { icon: typeof Circle; color: string }> = {
  locked: { icon: Lock, color: "text-gray-300" },
  not_started: { icon: Circle, color: "text-gray-400" },
  generating: { icon: Loader2, color: "text-purple-500" },
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
}: CollapsibleChapterNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const totalChapters = chapters.length
  const progress = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0

  // Collapsed rail
  if (collapsed) {
    return (
      <div className="w-14 flex flex-col items-center bg-white border-r border-purple-100 py-3 gap-1 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-purple-50 text-gray-400 hover:text-purple-600 mb-2"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {chapters.map((ch) => {
          const isActive = ch.id === activeChapterId
          const cfg = chapterStatusIcon[ch.status] || chapterStatusIcon.not_started
          const Icon = cfg.icon

          return (
            <button
              key={ch.id}
              onClick={() => onSelectChapter(ch.id)}
              title={`Ch. ${ch.chapterNumber}: ${ch.title}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {ch.status === "complete" ? (
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
    <div className="w-64 flex flex-col bg-white border-r border-purple-100 flex-shrink-0">
      {/* Header with collapse */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-purple-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chapters</span>
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
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{totalWordCount.toLocaleString()} words</p>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((ch) => {
          const isActive = ch.id === activeChapterId
          const cfg = chapterStatusIcon[ch.status] || chapterStatusIcon.not_started
          const Icon = cfg.icon
          const showPlanBtn = isActive && ((ch.sectionPlan?.length ?? 0) === 0 || ch.totalSections === 0)
          const isPlanning = planningChapterId === ch.id

          return (
            <div key={ch.id}>
              <button
                onClick={() => onSelectChapter(ch.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                  isActive
                    ? "bg-purple-50/80 border-l-purple-600"
                    : "border-l-transparent hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.color}`} />
                  <span className={`text-xs font-medium truncate ${isActive ? "text-purple-900" : "text-gray-700"}`}>
                    {ch.chapterNumber}. {ch.title}
                  </span>
                </div>
                {ch.totalSections > 0 && (
                  <div className="ml-6 mt-1.5">
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-400 rounded-full transition-all"
                        style={{ width: `${ch.totalSections > 0 ? Math.round((ch.completedSections / ch.totalSections) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{ch.completedSections}/{ch.totalSections} sections</span>
                  </div>
                )}
              </button>

              {/* Plan button */}
              {showPlanBtn && (
                <div className="px-3 py-1.5 bg-purple-50/60">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-purple-300 text-purple-700 hover:bg-purple-100"
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

                    return (
                      <button
                        key={sec.id}
                        onClick={() => !isLocked && onSelectSection(sec.id)}
                        disabled={isLocked}
                        className={`w-full text-left pl-7 pr-3 py-2 transition-colors border-l-2 ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed border-l-transparent"
                            : isFocused
                              ? "bg-purple-100/80 border-l-purple-500"
                              : "border-l-transparent hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <SIcon className={`h-3 w-3 flex-shrink-0 ${sCfg.color} ${sec.status === "generating" && !isLocked ? "animate-spin" : ""}`} />
                          <span className={`text-xs truncate ${isFocused ? "text-purple-800 font-medium" : "text-gray-600"}`}>
                            {sec.sectionNumber}. {sec.title}
                          </span>
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
