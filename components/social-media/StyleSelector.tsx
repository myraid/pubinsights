"use client"

export type AdStyle = "clean" | "bold" | "quote"

interface StyleOption {
  id: AdStyle
  label: string
  description: string
  previewBg: string
  previewText: string
}

const STYLES: StyleOption[] = [
  {
    id: "clean",
    label: "Clean Minimal",
    description: "White background, elegant typography",
    previewBg: "bg-gradient-to-br from-white to-purple-50",
    previewText: "text-gray-800",
  },
  {
    id: "bold",
    label: "Bold Promo",
    description: "Deep purple gradient, gold accents",
    previewBg: "bg-gradient-to-br from-[#3D0066] to-[#7B00CC]",
    previewText: "text-white",
  },
  {
    id: "quote",
    label: "Quote / Review",
    description: "Dark overlay, featured quote",
    previewBg: "bg-gradient-to-b from-[#1a1a2e] to-[#2d1b4e]",
    previewText: "text-white",
  },
]

interface StyleSelectorProps {
  selected: AdStyle
  onChange: (style: AdStyle) => void
}

export default function StyleSelector({ selected, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STYLES.map(s => {
        const active = selected === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
              active
                ? "border-purple-500 shadow-lg shadow-purple-200/50 scale-[1.02]"
                : "border-gray-200 hover:border-purple-300"
            }`}
          >
            {/* Preview thumbnail */}
            <div className={`${s.previewBg} h-24 flex items-center justify-center p-3`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-10 rounded bg-white/20 border border-white/30" />
                <div className="space-y-1">
                  <div className={`text-xs font-bold ${s.previewText}`}>Book Title</div>
                  <div className={`text-[9px] ${s.previewText} opacity-60`}>by Author</div>
                  <div className="w-10 h-1 rounded-full bg-purple-400/50" />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-white">
              <div className="text-xs font-semibold text-gray-900">{s.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.description}</div>
            </div>

            {/* Active indicator */}
            {active && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
