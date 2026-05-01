"use client"

import { CheckCircle2, Circle, PenLine, FileText } from "lucide-react"
import type { ChapterDocument } from "@/app/types/firebase"

interface ChapterSidebarProps {
  chapters: (ChapterDocument & { id: string })[]
  activeChapterId: string | null
  onSelectChapter: (id: string) => void
  totalWordCount: number
  completedCount: number
}

const statusConfig: Record<string, { icon: typeof Circle; label: string; color: string }> = {
  not_started: { icon: Circle, label: "Not Started", color: "text-gray-400" },
  planning: { icon: FileText, label: "Planning", color: "text-blue-500" },
  writing: { icon: PenLine, label: "Writing", color: "text-amber-500" },
  complete: { icon: CheckCircle2, label: "Complete", color: "text-green-500" },
}

export default function ChapterSidebar({
  chapters,
  activeChapterId,
  onSelectChapter,
  totalWordCount,
  completedCount,
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
          const cfg = statusConfig[ch.status] || statusConfig.not_started
          const Icon = cfg.icon

          return (
            <button
              key={ch.id}
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
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
