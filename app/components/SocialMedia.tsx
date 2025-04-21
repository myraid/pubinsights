"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, TextInput, Title, Textarea } from "@tremor/react"
import { Listbox } from "@headlessui/react"
import { ChevronUpDownIcon } from "@heroicons/react/20/solid"
import { ChevronDown } from "lucide-react"
import Logo from "./Logo"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function SocialMedia() {
  const [bookTitle, setBookTitle] = useState("")
  const [description, setDescription] = useState("")
  const [content, setContent] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState("")
  const [projectBooks, setProjectBooks] = useState<{ id: string; title: string }[]>([])

  const platforms = ["Facebook", "Instagram"]

  useEffect(() => {
    // In a real app, fetch the list of books from your backend or state management
    setProjectBooks([
      { id: "1", title: "The Future of AI" },
      { id: "2", title: "Mindful Living" },
    ])
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === "application/pdf") {
        setPdfFile(file)
        setPdfError("")
      } else {
        setPdfError("Please upload a PDF file")
        setPdfFile(null)
      }
    }
  }

  const generateContent = async () => {
    if (!bookTitle.trim() || !description.trim()) {
      return;
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("bookTitle", bookTitle)
      formData.append("description", description)
      if (pdfFile) {
        formData.append("pdfFile", pdfFile)
      }
      formData.append("platforms", JSON.stringify(platforms))

      const response = await fetch("/api/generate-social", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      setContent(data)
    } catch (error) {
      console.error("Error generating social content:", error)
    } finally {
      setLoading(false)
    }
  }

  const addSocialContentToBook = async (bookId: string) => {
    // In a real app, you would send this to your backend
    console.log(`Adding social content for book "${bookTitle}" to project ${bookId}`)
    console.log("Social content:", content)

    // Here you would typically make an API call to save this data
    // For now, we'll just show an alert
    alert(`Social content added to book: ${projectBooks.find((b) => b.id === bookId)?.title}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>Social Media Content Generator</Title>
        <Logo />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Add to Project <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {projectBooks.map((book) => (
              <DropdownMenuItem key={book.id} onSelect={() => addSocialContentToBook(book.id)}>
                {book.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="bg-white shadow-sm">
        <div className="space-y-4">
          <TextInput
            placeholder="Book Title"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            className="border-primary"
          />
          <Textarea
            placeholder="Brief Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            className="border-primary"
          />
          
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm text-gray-600">Upload Book Draft (Optional)</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-white
                hover:file:bg-primary/80"
            />
            {pdfError && <p className="text-red-500 text-sm">{pdfError}</p>}
            {pdfFile && (
              <p className="text-sm text-green-600">
                ✓ PDF uploaded: {pdfFile.name}
              </p>
            )}
          </div>
          
          <div className="flex gap-2 items-center justify-center py-2 px-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Will generate posts for:</p>
            <div className="flex gap-2">
              {platforms.map((platform) => (
                <span key={platform} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                  {platform}
                </span>
              ))}
            </div>
          </div>

          <Button
            onClick={generateContent}
            disabled={loading || !bookTitle.trim() || !description.trim()}
            className="w-full bg-primary text-white hover:bg-primary/90"
          >
            {loading ? "Generating..." : "Generate Content"}
          </Button>
        </div>
      </Card>

      {Object.keys(content).length > 0 && (
        <div className="space-y-4">
          {Object.entries(content).map(([platform, content]) => (
            <Card key={platform} className="bg-white shadow-sm">
              <Title className="text-lg mb-2 text-primary">{platform}</Title>
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-muted-foreground">
                {JSON.stringify(content, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

