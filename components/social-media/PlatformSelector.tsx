"use client"

import { Facebook, Instagram, Twitter, Linkedin } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type Platform = "facebook" | "instagram" | "twitter" | "linkedin"

interface PlatformOption {
  id: Platform
  label: string
  icon: LucideIcon
  color: string
}

const PLATFORMS: PlatformOption[] = [
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { id: "twitter", label: "X / Twitter", icon: Twitter, color: "#1DA1F2" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
]

interface PlatformSelectorProps {
  selected: Platform[]
  onChange: (platforms: Platform[]) => void
}

export default function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  function toggle(id: Platform) {
    if (selected.includes(id)) {
      if (selected.length === 1) return // keep at least one
      onChange(selected.filter(p => p !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map(p => {
        const active = selected.includes(p.id)
        return (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
              active
                ? "bg-white shadow-md border-purple-200 text-gray-900"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
            }`}
          >
            <p.icon
              className="h-4 w-4"
              style={{ color: active ? p.color : undefined }}
            />
            {p.label}
            {active && (
              <div className="w-2 h-2 rounded-full bg-green-400" />
            )}
          </button>
        )
      })}
    </div>
  )
}
