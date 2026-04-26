"use client"

import { useState, useRef, useCallback } from "react"
import {
  Loader2, Sparkles, Download, FolderPlus, Wand2
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, addSocialContentToProject } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import Logo from "./Logo"
import BookLookupInput, { type BookData } from "@/components/social-media/BookLookupInput"
import PlatformSelector, { type Platform } from "@/components/social-media/PlatformSelector"
import StyleSelector, { type AdStyle } from "@/components/social-media/StyleSelector"
import CreativeCard from "@/components/social-media/CreativeCard"

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentMode = "ad" | "post"

interface Creative {
  platform: Platform
  caption: string
  imageUrl: string | null
  imageBlobUrl: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SocialMedia() {
  const { user } = useAuth()
  const abortRef = useRef<AbortController | null>(null)

  // Book data
  const [book, setBook] = useState<BookData | null>(null)

  // Config
  const [mode, setMode] = useState<ContentMode>("ad")
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram", "twitter", "linkedin"])
  const [style, setStyle] = useState<AdStyle>("clean")
  const [salePrice, setSalePrice] = useState("")
  const [postContext, setPostContext] = useState("")

  // State
  const [generating, setGenerating] = useState(false)
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [regeneratingPlatform, setRegeneratingPlatform] = useState<Platform | null>(null)

  // Projects for save dropdown
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)

  const loadProjects = useCallback(async () => {
    if (projectsLoaded || !user) return
    try {
      const p = await getUserProjects(user.uid)
      setProjects(p)
      setProjectsLoaded(true)
    } catch {
      toast.error("Failed to load projects")
    }
  }, [user, projectsLoaded])

  // ─── Generation ──────────────────────────────────────────────────────────

  async function generateCreatives() {
    if (!book) {
      toast.error("Please add a book first")
      return
    }
    if (platforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    setCreatives([])

    try {
      // Step 1: Generate AI copy via existing endpoint
      const copyRes = await fetch("/api/social-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          title: book.title,
          description: book.description || "",
          author: book.author || "",
          price: book.price?.toString() || "",
          salePrice: mode === "ad" ? (salePrice || book.price?.toString() || "0") : undefined,
          contentType: mode,
          bookDescription: book.description || book.title,
          postInfo: mode === "post" ? postContext : undefined,
          userId: user?.uid,
        }),
      })

      if (!copyRes.ok) throw new Error("Failed to generate copy")
      const copyData = await copyRes.json()
      const generatedContent: { type: string; platform: string; content: string }[] =
        copyData.generatedContent || []

      // Map platform names to our Platform type
      const platformMap: Record<string, Platform> = {
        facebook: "facebook",
        instagram: "instagram",
        twitter: "twitter",
        "x / twitter": "twitter",
        "x/twitter": "twitter",
        linkedin: "linkedin",
      }

      // Step 2: Initialize creatives with captions, images pending
      const initialCreatives: Creative[] = platforms.map(p => {
        const matchedCopy = generatedContent.find(
          c => platformMap[c.platform.toLowerCase()] === p
        )
        return {
          platform: p,
          caption: matchedCopy?.content || `Check out "${book.title}"!`,
          imageUrl: null,
          imageBlobUrl: null,
        }
      })
      setCreatives([...initialCreatives])

      // Step 3: Generate images for each platform in parallel
      const imagePromises = initialCreatives.map(async (creative, idx) => {
        try {
          const imgRes = await fetch("/api/social-media/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              title: book.title,
              author: book.author || undefined,
              price: mode === "ad" ? (salePrice || book.price?.toString() || undefined) : undefined,
              imageUrl: book.imageUrl || undefined,
              copyText: creative.caption,
              platform: creative.platform,
              style,
            }),
          })

          if (!imgRes.ok) throw new Error(`Image generation failed for ${creative.platform}`)

          const blob = await imgRes.blob()
          const blobUrl = URL.createObjectURL(blob)

          setCreatives(prev => {
            const updated = [...prev]
            if (updated[idx]) {
              updated[idx] = { ...updated[idx], imageUrl: blobUrl, imageBlobUrl: blobUrl }
            }
            return updated
          })
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            console.error(`Image gen failed for ${creative.platform}:`, err)
          }
        }
      })

      await Promise.allSettled(imagePromises)
      toast.success("Creatives generated!")
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Generation failed:", err)
        toast.error("Generation failed. Please try again.")
      }
    } finally {
      setGenerating(false)
    }
  }

  // ─── Regenerate single platform ──────────────────────────────────────────

  async function regeneratePlatform(platform: Platform) {
    if (!book) return
    setRegeneratingPlatform(platform)

    try {
      // Re-generate copy
      const copyRes = await fetch("/api/social-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          description: book.description || "",
          author: book.author || "",
          price: book.price?.toString() || "",
          salePrice: mode === "ad" ? (salePrice || book.price?.toString() || "0") : undefined,
          contentType: mode,
          bookDescription: book.description || book.title,
          postInfo: mode === "post" ? postContext : undefined,
          userId: user?.uid,
        }),
      })

      if (!copyRes.ok) throw new Error("Failed to regenerate copy")
      const copyData = await copyRes.json()
      const content: { type: string; platform: string; content: string }[] = copyData.generatedContent || []
      const platformMap: Record<string, Platform> = {
        facebook: "facebook", instagram: "instagram",
        twitter: "twitter", "x / twitter": "twitter", "x/twitter": "twitter",
        linkedin: "linkedin",
      }
      const matchedCopy = content.find(c => platformMap[c.platform.toLowerCase()] === platform)
      const caption = matchedCopy?.content || `Check out "${book.title}"!`

      // Re-generate image
      const imgRes = await fetch("/api/social-media/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author || undefined,
          price: mode === "ad" ? (salePrice || book.price?.toString() || undefined) : undefined,
          imageUrl: book.imageUrl || undefined,
          copyText: caption,
          platform,
          style,
        }),
      })

      let blobUrl: string | null = null
      if (imgRes.ok) {
        const blob = await imgRes.blob()
        blobUrl = URL.createObjectURL(blob)
      }

      setCreatives(prev =>
        prev.map(c =>
          c.platform === platform
            ? { ...c, caption, imageUrl: blobUrl, imageBlobUrl: blobUrl }
            : c
        )
      )
      toast.success(`${platform} creative regenerated`)
    } catch {
      toast.error(`Failed to regenerate ${platform} creative`)
    } finally {
      setRegeneratingPlatform(null)
    }
  }

  // ─── Download all ──────────────────────────────────────────────────────────

  function downloadAll() {
    creatives.forEach(c => {
      if (c.imageBlobUrl) {
        const a = document.createElement("a")
        a.href = c.imageBlobUrl
        a.download = `${c.platform}-${mode}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    })
  }

  // ─── Save to project ──────────────────────────────────────────────────────

  async function saveToProject(projectId: string) {
    try {
      await addSocialContentToProject(projectId, {
        title: book?.title || "Untitled",
        contentType: mode,
        items: creatives.map(c => ({
          type: mode,
          platform: c.platform,
          content: c.caption,
        })),
      })
      toast.success("Saved to project!")
    } catch {
      toast.error("Failed to save to project")
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Ad Studio
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate platform-ready creatives for your book
          </p>
        </div>
        <Logo />
      </div>

      {/* Section A — Book Input */}
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-b from-purple-50/50 to-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-purple-800 uppercase tracking-wider">
          Book
        </h2>
        <BookLookupInput book={book} onBookLoaded={setBook} />
      </div>

      {/* Section B — Configuration */}
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-b from-purple-50/50 to-white p-5 space-y-5">
        <h2 className="text-sm font-semibold text-purple-800 uppercase tracking-wider">
          Configuration
        </h2>

        {/* Mode toggle */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Content Type</label>
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            {(["ad", "post"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "ad" ? "Ad" : "Post"}
              </button>
            ))}
          </div>
        </div>

        {/* Platform selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Platforms</label>
          <PlatformSelector selected={platforms} onChange={setPlatforms} />
        </div>

        {/* Style selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Ad Style</label>
          <StyleSelector selected={style} onChange={setStyle} />
        </div>

        {/* Mode-specific fields */}
        {mode === "ad" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Sale Price (optional)</label>
            <Input
              value={salePrice}
              onChange={e => setSalePrice(e.target.value)}
              placeholder="e.g. 9.99"
              type="number"
              step="0.01"
              className="max-w-[200px] bg-white border-purple-200"
            />
          </div>
        )}

        {mode === "post" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Additional Context (optional)</label>
            <textarea
              value={postContext}
              onChange={e => setPostContext(e.target.value)}
              placeholder="Tell us more about this post — promotion, launch, review request..."
              rows={3}
              className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400"
            />
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={generateCreatives}
          disabled={generating || !book}
          className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-base font-semibold shadow-lg shadow-purple-300/30 transition-all"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5 mr-2" />
              Generate Creative
            </>
          )}
        </Button>
      </div>

      {/* Section C — Results */}
      {creatives.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-purple-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generated Creatives
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAll}
                className="border-purple-200 hover:bg-purple-50 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download All
              </Button>

              {user && (
                <DropdownMenu onOpenChange={open => { if (open) loadProjects() }}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-200 hover:bg-purple-50 text-xs"
                    >
                      <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                      Save to Project
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {projects.length === 0 ? (
                      <DropdownMenuItem disabled>No projects found</DropdownMenuItem>
                    ) : (
                      projects.map(p => (
                        <DropdownMenuItem key={p.id} onClick={() => saveToProject(p.id)}>
                          {p.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Creative grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatives.map(c => (
              <CreativeCard
                key={c.platform}
                platform={c.platform}
                imageUrl={c.imageBlobUrl}
                caption={c.caption}
                onRegenerate={() => regeneratePlatform(c.platform)}
                regenerating={regeneratingPlatform === c.platform}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
