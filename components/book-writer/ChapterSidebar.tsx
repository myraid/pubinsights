"use client"

import { CheckCircle2, Circle, PenLine, FileText, Lock, Loader2 } from "lucide-react"
import type { ChapterDocument, Section } from "@/app/types/firebase"
import { Button } from "@/components/ui/button"

interface ChapterSidebarProps {
  chapters: (ChapterDocument & { id: string })[]
  activeChapterId: string | null
  sections: (Section & { id: string })[]
  activeSectionId: string | null
  onSelectChapter: (id: string) => void
  onSelectSection: (id: string) => void
  onPlanSections: (chapterId: string) => void
  totalWordCount: number
  completedCount: number
  planningChapterId: string | null
}

const chapterStatusConfig: Record<string, { icon: typeof Circle; label: string; color: string }> = {
  not_started: { icon: Circle, label: "Not Started", color: "text-gray-400" },
  planning: { icon: FileText, label: "Planning", color: "text-blue-500" },
  writing: { icon: PenLine, label: "Writing", color: "text-amber-500" },
  complete: { icon: CheckCircle2, label: "Complete", color: "text-green-500" },
}

const sectionStatusConfig: Record<string, { icon: typeof Circle; label: string; color: string }> = {
  locked: { icon: Lock, label: "Locked", color: "text-gray-400" },
  not_started: { icon: Circle, label: "Not Started", color: "text-gray-400" },
  generating: { icon: Loader2, label: "Generating", color: "text-blue-500" },
  review: { icon: PenLine, label: "Review", color: "text-amber-500" },
  approved: { icon: CheckCircle2, label: "Approved", color: "text-green-500" },
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str
}

export default function ChapterSidebar({
  chapters,
  activeChapterId,
  sections,
  activeSectionId,
  onSelectChapter,
  onSelectSection,
  onPlanSections,
  totalWordCount,
  completedCount,
  planningChapterId,
}: ChapterSidebarProps) {
  const totalChapters = chapters.length
  const progress = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-white border-r border-purple-100">
      {/* Progress header */}
      <div className="p-4 border-b border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Progress</span>
          <span className="text-xs text-gray-400">{completedCount}/{totalChapters} chapters</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {totalWordCount.toLocaleString()} words total
        </p>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((ch) => {
          const isActive = ch.id === activeChapterId
          const cfg = chapterStatusConfig[ch.status] || chapterStatusConfig.not_started
          const Icon = cfg.icon
          const chapterProgress =
            ch.totalSections > 0
              ? Math.round((ch.completedSections / ch.totalSections) * 100)
              : 0
          const showPlanSections =
            isActive &&
            ch.status !== "not_started" &&
            (ch.sectionPlan.length === 0 || ch.totalSections === 0)
          const isPlanning = planningChapterId === ch.id

          return (
            <div key={ch.id}>
              {/* Chapter row */}
              <button
                onClick={() => onSelectChapter(ch.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                  isActive
                    ? "bg-purple-50 border-l-2 border-l-purple-600"
                    : "hover:bg-gray-50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isActive ? "text-purple-900" : "text-gray-700"}`}>
                      Ch. {ch.chapterNumber}: {ch.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                      {ch.wordCount > 0 && (
                        <span className="text-xs text-gray-400">{ch.wordCount.toLocaleString()} words</span>
                      )}
                    </div>
                    {ch.totalSections > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full transition-all duration-300"
                            style={{ width: `${chapterProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          {ch.completedSections}/{ch.totalSections} sections
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Plan Sections button */}
              {showPlanSections && (
                <div className="px-4 py-2 bg-purple-50 border-b border-gray-50">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => onPlanSections(ch.id)}
                    disabled={isPlanning}
                  >
                    {isPlanning ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Planning&hellip;
                      </>
                    ) : (
                      "Plan Sections"
                    )}
                  </Button>
                </div>
              )}

              {/* Sections (only for active chapter) */}
              {isActive && sections.length > 0 && (
                <div className="bg-gray-50">
                  {sections.map((sec, idx) => {
                    const isLocked =
                      idx > 0 && sections[idx - 1].status !== "approved"
                    const isActiveSection = sec.id === activeSectionId
                    const statusKey = isLocked ? "locked" : sec.status
                    const sCfg = sectionStatusConfig[statusKey] || sectionStatusConfig.not_started
                    const SIcon = sCfg.icon
                    const isGenerating = !isLocked && sec.status === "generating"

                    return (
                      <button
                        key={sec.id}
                        onClick={() => {
                          if (!isLocked) onSelectSection(sec.id)
                        }}
                        disabled={isLocked}
                        className={`w-full text-left pl-8 pr-4 py-2.5 border-b border-gray-100 transition-colors ${
                          isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : isActiveSection
                            ? "bg-purple-100 border-l-2 border-l-purple-600"
                            : "hover:bg-gray-100 border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <SIcon
                            className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${sCfg.color}${
                              isGenerating ? " animate-spin" : ""
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-medium ${
                                isActiveSection ? "text-purple-900" : "text-gray-600"
                              }`}
                            >
                              &sect;{sec.sectionNumber}: {truncate(sec.title, 30)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs ${sCfg.color}`}>{sCfg.label}</span>
                              {sec.wordCount > 0 && (
                                <span className="text-xs text-gray-400">
                                  {sec.wordCount.toLocaleString()} words
                                </span>
                              )}
                            </div>
                          </div>
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
