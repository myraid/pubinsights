"use client"

import { useState } from "react"
import { Download, Copy, RefreshCw, Check, Facebook, Instagram, Twitter, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { Platform } from "./PlatformSelector"

const PLATFORM_ICONS: Record<Platform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
}

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
}

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
}

interface CreativeCardProps {
  platform: Platform
  imageUrl: string | null
  caption: string
  onRegenerate: () => void
  regenerating: boolean
}

export default function CreativeCard({
  platform,
  imageUrl,
  caption,
  onRegenerate,
  regenerating,
}: CreativeCardProps) {
  const [copied, setCopied] = useState(false)
  const Icon = PLATFORM_ICONS[platform]

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      toast.success("Caption copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `${platform}-ad.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-100 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
      {/* Platform badge */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-50">
        <Icon className="h-4 w-4" style={{ color: PLATFORM_COLORS[platform] }} />
        <span className="text-sm font-medium text-gray-700">{PLATFORM_LABELS[platform]}</span>
      </div>

      {/* Image preview */}
      <div className="relative bg-gray-50">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={`${platform} ad creative`}
            className="w-full h-auto"
          />
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-sm text-gray-400">Generating image...</div>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-4">
        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed line-clamp-6">
          {caption}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!imageUrl}
          className="flex-1 text-xs border-purple-200 hover:bg-purple-50"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex-1 text-xs border-purple-200 hover:bg-purple-50"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 mr-1.5" />
          )}
          {copied ? "Copied" : "Copy Text"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-xs border-purple-200 hover:bg-purple-50 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  )
}
