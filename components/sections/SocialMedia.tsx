"use client"

import { useState } from "react"
import { Card, Title, Text, Button, Badge } from "@tremor/react"
import Logo from "./Logo"
import { BookOpen, Info, Download, RefreshCw, ExternalLink, Star, User, DollarSign } from "lucide-react"
import { toast } from "sonner"

interface BookData {
  title: string
  description: string
  coverUrl: string
  author: string
  price: string
  rating: string
  reviews: string
}

interface AdData {
  imageUrl: string
  imageId: string
  status: string
}

export default function SocialMedia() {
  const [bookUrl, setBookUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingAd, setIsGeneratingAd] = useState(false)
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [adData, setAdData] = useState<AdData | null>(null)

  const fetchBookDetails = async () => {
    if (!bookUrl.trim()) {
      toast.error("Please enter a book URL")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/my-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookUrl: bookUrl.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch book details")
      }

      const data = await response.json()
      setBookData(data)
      setAdData(null) // Reset previous ad
      toast.success("Book details fetched successfully!")
    } catch (error) {
      console.error("Error fetching book details:", error)
      toast.error(error instanceof Error ? error.message : "Failed to fetch book details")
    } finally {
      setIsLoading(false)
    }
  }

  const generateAd = async () => {
    if (!bookData) {
      toast.error("Please fetch book details first")
      return
    }

    setIsGeneratingAd(true)
    try {
      const response = await fetch("/api/social-media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: bookData.title,
          price: bookData.price,
          coverUrl: bookData.coverUrl,
          author: bookData.author,
          description: bookData.description
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate ad")
      }

      const data = await response.json()
      
      // Create mock ad data since the actual image will come from Make integration
      const mockAdData = {
        imageUrl: "https://via.placeholder.com/400x300?text=Ad+Being+Generated",
        imageId: data.requestId,
        status: "processing"
      }
      
      setAdData(mockAdData)
      toast.success("Ad generation request sent successfully! Check your Make integration for the result.")
    } catch (error) {
      console.error("Error generating ad:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate ad")
    } finally {
      setIsGeneratingAd(false)
    }
  }

  const downloadAd = async () => {
    if (!adData?.imageUrl) return

    try {
      const response = await fetch(adData.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const fileName = `book-ad-${bookData?.title?.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Ad downloaded successfully!")
    } catch (error) {
      console.error("Error downloading ad:", error)
      toast.error("Failed to download ad")
    }
  }

  const resetForm = () => {
    setBookUrl("")
    setBookData(null)
    setAdData(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>AD Creative</Title>
        <Logo />
      </div>

      {/* Book URL Input */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="bookUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Amazon Book URL
            </label>
            <div className="flex gap-3">
              <input
                id="bookUrl"
                type="url"
                value={bookUrl}
                onChange={(e) => setBookUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/B0F6BP151M"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                onClick={fetchBookDetails}
                disabled={isLoading || !bookUrl.trim()}
                className="px-6"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "Fetching..." : "Fetch Details"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Book Details Display */}
      {bookData && (
        <Card className="p-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <img
                src={bookData.coverUrl}
                alt={bookData.title}
                className="w-48 h-64 object-cover rounded-lg shadow-md"
                onError={(e) => {
                  e.currentTarget.src = "https://via.placeholder.com/192x256?text=Cover+Not+Found"
                }}
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{bookData.title}</h2>
                <p className="text-lg text-gray-600 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {bookData.author}
                </p>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-gray-700">{bookData.rating}</span>
                  <Badge color="gray">{bookData.reviews} reviews</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">{bookData.price}</span>
                </div>
              </div>

              <div>
                <Text className="text-gray-700 font-medium mb-2">Description:</Text>
                <p className="mt-2 text-gray-600 line-clamp-4">{bookData.description}</p>
              </div>

              <Button
                onClick={generateAd}
                disabled={isGeneratingAd}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isGeneratingAd ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {isGeneratingAd ? "Generating Ad..." : "Generate Social Media Ad"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Generated Ad Display */}
      {adData && (
        <Card className="p-6">
          <div className="text-center space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Generated Ad</h3>
              <p className="text-gray-600">Your social media ad is ready! Download it to use on your platforms.</p>
            </div>
            
            <div className="max-w-md mx-auto">
              <img
                src={adData.imageUrl}
                alt="Generated social media ad"
                className="w-full rounded-lg shadow-lg border"
                onError={(e) => {
                  e.currentTarget.src = "https://via.placeholder.com/400x300?text=Ad+Generation+Failed"
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={downloadAd}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Ad
              </Button>
              <Button
                onClick={() => window.open(adData.imageUrl, "_blank")}
                variant="secondary"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Size
              </Button>
            </div>

            <div className="text-sm text-gray-500">
              <p>Ad ID: {adData.imageId}</p>
              <p>Status: {adData.status}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Reset Button */}
      {(bookData || adData) && (
        <div className="text-center">
          <Button
            onClick={resetForm}
            variant="secondary"
            className="text-gray-600 hover:text-gray-800"
          >
            Start Over
          </Button>
        </div>
      )}
    </div>
  )
}

