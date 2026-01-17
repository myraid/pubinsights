"use client"

import { useState } from "react"
import { Card, TextInput, Title } from "@tremor/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Link, Star, DollarSign, BookOpen } from "lucide-react"

interface BookDetailsProps {
  onBookDetailsFetched: (details: {
    title: string;
    description: string;
    coverImage: File | null;
    author: string;
    price: string;
    rating: string;
  }) => void;
}

interface BookDetails {
  title: string;
  description: string;
  coverUrl: string;
  author: string;
  price: string;
  rating: string;
  asin: string;
}

export default function BookDetails({ onBookDetailsFetched }: BookDetailsProps) {
  const [bookUrl, setBookUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [bookData, setBookData] = useState<{
    title: string;
    description: string;
    coverImage: File | null;
    author: string;
    price: string;
    rating: string;
  } | null>(null)

  const handleScrapeBook = async () => {
    if (!bookUrl) {
      toast.error("Please enter a book URL")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/my-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookUrl }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch book details")
      }

      const bookDetails = await response.json() as BookDetails
      console.log("Fetched book details:", bookDetails)
      
      // If there's a cover URL, fetch and convert to File
      let coverImage = null
      if (bookDetails.coverUrl) {
        try {
          const imageResponse = await fetch(bookDetails.coverUrl)
          const blob = await imageResponse.blob()
          coverImage = new File([blob], "book-cover.jpg", { type: "image/jpeg" })
        } catch (error) {
          console.error("Failed to fetch book cover:", error)
        }
      }

      const fetchedData = {
        title: bookDetails.title,
        description: bookDetails.description,
        coverImage,
        author: bookDetails.author,
        price: bookDetails.price,
        rating: bookDetails.rating
      }

      console.log("Processed book data:", fetchedData)
      setBookData(fetchedData)
      onBookDetailsFetched(fetchedData)
      setBookUrl("")
      toast.success("Book details fetched successfully")
    } catch (error) {
      console.error("Error fetching book:", error)
      toast.error("Failed to fetch book details")
    } finally {
      setLoading(false)
    }
  }

  if (bookData) {
    return (
      <Card className="bg-white shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Book Cover */}
          {bookData.coverImage && (
            <div className="flex-shrink-0">
              <img
                src={URL.createObjectURL(bookData.coverImage)}
                alt={bookData.title}
                className="w-48 h-64 object-cover rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
              />
            </div>
          )}
          
          {/* Book Details */}
          <div className="flex-1 space-y-6">
            {/* Title and Author */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{bookData.title}</h2>
              <p className="text-lg text-gray-600">{bookData.author}</p>
            </div>

            {/* Rating and Price */}
            <div className="flex flex-wrap gap-6">
              {bookData.rating && (
                <div className="flex items-center bg-gray-50 px-4 py-2 rounded-full">
                  <Star className="w-5 h-5 text-yellow-400 mr-2" />
                  <span className="text-gray-700">{bookData.rating}</span>
                </div>
              )}
              {bookData.price && (
                <div className="flex items-center bg-gray-50 px-4 py-2 rounded-full">
                  <DollarSign className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-gray-700">{bookData.price}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {bookData.description && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Description</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">{bookData.description}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-white shadow-sm p-6">
      <div className="space-y-4">
        <Title>Get Book Details</Title>
        <div className="flex gap-2">
          <TextInput
            placeholder="Enter Amazon Book URL"
            value={bookUrl}
            onChange={(e) => setBookUrl(e.target.value)}
            className="border-primary flex-1"
            icon={Link}
          />
          <Button
            onClick={handleScrapeBook}
            disabled={loading || !bookUrl}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {loading ? "Fetching..." : "Get Book Details"}
          </Button>
        </div>
        <p className="text-sm text-gray-500">
          Enter an Amazon book URL to automatically fetch book details
        </p>
      </div>
    </Card>
  )
} 