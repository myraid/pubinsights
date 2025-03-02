"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Title } from "@tremor/react"
import { Listbox } from "@headlessui/react"
import { ChevronUpDownIcon } from "@heroicons/react/20/solid"
import { ChevronDown, Loader2 } from "lucide-react"
import Logo from "./Logo"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface OutlineSection {
  title: string;
  points: string[];
}

interface OutlineResponse {
  sections: OutlineSection[];
}

export default function BookOutline({ title: initialTitle }: { title: string }) {
  const [title, setTitle] = useState(initialTitle)
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectBooks, setProjectBooks] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    // In a real app, fetch the list of books from your backend or state management
    setProjectBooks([
      { id: "1", title: "The Future of AI" },
      { id: "2", title: "Mindful Living" },
    ])
  }, [])

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  const generateOutline = async () => {
    if (!title.trim()) return

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate outline')
      }
      
      setOutline(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const addOutlineToBook = async (bookId: string) => {
    // In a real app, you would send this to your backend
    console.log(`Adding outline for topic "${title}" to book ${bookId}`)
    console.log("Outline data:", outline)

    // Here you would typically make an API call to save this data
    // For now, we'll just show an alert
    alert(`Outline added to book: ${projectBooks.find((b) => b.id === bookId)?.title}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>Book Outline Generator</Title>
        <Logo />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Add to Project <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {projectBooks.map((book) => (
              <DropdownMenuItem key={book.id} onSelect={() => addOutlineToBook(book.id)}>
                {book.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="mt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <TextInput
              placeholder="Enter your book title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-grow"
            />
            <Button
              onClick={generateOutline}
              disabled={loading}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Generate Outline'
              )}
            </Button>
          </div>

          {error && (
            <div className="text-red-500">
              {error}
            </div>
          )}
        </div>
      </Card>

      {outline && outline.sections && outline.sections.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold text-xl mb-4">{title} Outline</h2>
          <div className="space-y-6">
            {outline.sections.map((section, index) => (
              <div key={index} className="border-l-2 border-primary pl-4">
                <h3 className="font-semibold text-xl mb-3">
                  {section.title} {/* Displaying section title */}
                </h3>
                <ol className="list-decimal list-inside space-y-2">
                  {section.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="text-gray-600 pl-4">
                      {point}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

