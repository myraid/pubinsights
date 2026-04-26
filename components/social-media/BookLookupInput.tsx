"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2, Link2, ChevronDown, ChevronUp, Star, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export interface BookData {
  asin: string
  title: string
  author: string | null
  description: string | null
  price: number | null
  rating: number | null
  imageUrl: string | null
  publisher: string | null
  categories: string[]
  url: string
}

interface BookLookupInputProps {
  onBookLoaded: (book: BookData) => void
  book: BookData | null
}

export default function BookLookupInput({ onBookLoaded, book }: BookLookupInputProps) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState("")
  const [manualAuthor, setManualAuthor] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [manualPrice, setManualPrice] = useState("")

  async function handleLookup() {
    const input = url.trim()
    if (!input) return

    setLoading(true)
    try {
      const res = await fetch(`/api/amazon-books/lookup?url=${encodeURIComponent(input)}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to look up book")
        return
      }

      onBookLoaded(data)
    } catch {
      toast.error("Failed to look up book. Check the URL and try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleManualSubmit() {
    if (!manualTitle.trim()) {
      toast.error("Title is required")
      return
    }
    onBookLoaded({
      asin: "",
      title: manualTitle.trim(),
      author: manualAuthor.trim() || null,
      description: manualDescription.trim() || null,
      price: manualPrice ? parseFloat(manualPrice) : null,
      rating: null,
      imageUrl: null,
      publisher: null,
      categories: [],
      url: "",
    })
    setShowManual(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLookup()
  }

  return (
    <div className="space-y-4">
      {/* Amazon URL input */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste Amazon book link or ASIN..."
            className="pl-10 h-12 bg-white/80 border-purple-200 focus:border-purple-400 focus:ring-purple-400/20 text-base"
          />
        </div>
        <Button
          onClick={handleLookup}
          disabled={loading || !url.trim()}
          className="h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
        </Button>
      </div>

      {/* Manual toggle */}
      <button
        onClick={() => setShowManual(!showManual)}
        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 transition-colors"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Or enter manually
        {showManual ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Manual form */}
      {showManual && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-purple-50/50 border border-purple-100">
          <Input
            value={manualTitle}
            onChange={e => setManualTitle(e.target.value)}
            placeholder="Book title *"
            className="bg-white border-purple-200"
          />
          <Input
            value={manualAuthor}
            onChange={e => setManualAuthor(e.target.value)}
            placeholder="Author"
            className="bg-white border-purple-200"
          />
          <textarea
            value={manualDescription}
            onChange={e => setManualDescription(e.target.value)}
            placeholder="Book description"
            rows={3}
            className="col-span-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400"
          />
          <Input
            value={manualPrice}
            onChange={e => setManualPrice(e.target.value)}
            placeholder="Price (e.g. 14.99)"
            type="number"
            step="0.01"
            className="bg-white border-purple-200"
          />
          <Button
            onClick={handleManualSubmit}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Use This Book
          </Button>
        </div>
      )}

      {/* Selected book card */}
      {book && (
        <div className="flex gap-4 p-4 rounded-xl bg-white border border-purple-100 shadow-sm">
          {book.imageUrl ? (
            <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden shadow-md">
              <Image
                src={book.imageUrl}
                alt={book.title}
                width={80}
                height={112}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-20 h-28 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-purple-400 text-xs text-center px-1">No cover</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate" style={{ fontFamily: "var(--font-playfair)" }}>
              {book.title}
            </h3>
            {book.author && (
              <p className="text-sm text-gray-500 mt-0.5">by {book.author}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {book.price != null && (
                <span className="text-sm font-semibold text-purple-700">${book.price.toFixed(2)}</span>
              )}
              {book.rating != null && (
                <span className="flex items-center gap-1 text-sm text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {book.rating}
                </span>
              )}
            </div>
            {book.description && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{book.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
