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
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [content, setContent] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState("")
  const [projectBooks, setProjectBooks] = useState<{ id: string; title: string }[]>([])

  const availablePlatforms = ["Instagram", "TikTok", "YouTube", "Facebook"]

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
    if (!bookTitle.trim() || !description.trim() || selectedPlatforms.length === 0) {
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("bookTitle", bookTitle)
      formData.append("description", description)
      formData.append("platforms", JSON.stringify(selectedPlatforms))
      if (pdfFile) {
        formData.append("pdfFile", pdfFile)
      }

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
          <div className="space-y-2">
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
          </div>
          <Listbox value={selectedPlatforms} onChange={setSelectedPlatforms} multiple>
            <div className="relative mt-1">
              <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                <span className="block truncate">
                  {selectedPlatforms.length === 0
                    ? "Select platforms"
                    : `${selectedPlatforms.length} platform(s) selected`}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {availablePlatforms.map((platform) => (
                  <Listbox.Option
                    key={platform}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-10 pr-4 ${
                        active ? "bg-amber-100 text-amber-900" : "text-gray-900"
                      }`
                    }
                    value={platform}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>{platform}</span>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">✓</span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
          <Button
            onClick={generateContent}
            disabled={loading || !bookTitle.trim() || !description.trim() || selectedPlatforms.length === 0}
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

