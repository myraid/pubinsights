"use client"

import { useState } from "react"
import { Card, TextInput, Title, Textarea } from "@tremor/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ShoppingCart, Share2 } from "lucide-react"
import GeneratedContent from "./GeneratedContent"

interface ContentGeneratorProps {
  bookDetails: {
    title: string;
    description: string;
    coverImage: File | null;
    author: string;
    price: string;
    rating: string;
  };
}

export default function ContentGenerator({ bookDetails }: ContentGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'ad' | 'post'>('ad')
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  
  // Ad specific state
  const [salePrice, setSalePrice] = useState("")
  
  // Post specific state
  const [postInfo, setPostInfo] = useState("")

  const handleSubmit = async () => {
    if (activeTab === 'ad' && !salePrice) {
      toast.error("Please enter a sale price")
      return
    }

    if (activeTab === 'post' && !postInfo) {
      toast.error("Please enter some book information")
      return
    }

    setLoading(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append("title", bookDetails.title)
      formDataToSend.append("bookDescription", bookDetails.description)
      formDataToSend.append("contentType", activeTab)
      
      if (activeTab === 'ad') {
        formDataToSend.append("salePrice", salePrice)
      } else {
        formDataToSend.append("postInfo", postInfo)
      }

      if (bookDetails.coverImage) {
        formDataToSend.append("bookCoverImage", bookDetails.coverImage)
      }

      const response = await fetch("/api/social-media", {
        method: "POST",
        body: formDataToSend,
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const data = await response.json()
      setRequestId(data.requestId)
      
      // Clear form after successful submission
      setSalePrice("")
      setPostInfo("")

      toast.success("Content generation started")
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error("Failed to generate content")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button
          onClick={() => setActiveTab('ad')}
          className={`flex-1 ${activeTab === 'ad' ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Create Ad
        </Button>
        <Button
          onClick={() => setActiveTab('post')}
          className={`flex-1 ${activeTab === 'post' ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Book Details Card */}
        <Card className="bg-white shadow-sm">
          <Title className="mb-4">Book Information</Title>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Title</p>
              <p className="text-lg">{bookDetails.title}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Author</p>
              <p className="text-lg">{bookDetails.author}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Rating</p>
              <p className="text-lg">{bookDetails.rating}</p>
            </div>
            {bookDetails.coverImage && (
              <div>
                <p className="text-sm font-medium text-gray-500">Cover Image</p>
                <img
                  src={URL.createObjectURL(bookDetails.coverImage)}
                  alt="Book cover"
                  className="w-32 h-40 object-cover rounded-lg mt-2"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Content Generation Card */}
        <Card className="bg-white shadow-sm">
          <Title className="mb-4">
            {activeTab === 'ad' ? 'Create Ad' : 'Create Post'}
          </Title>
          <div className="space-y-4">
            {activeTab === 'ad' ? (
              <div>
                <TextInput
                  placeholder="Enter sale price"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="border-primary"
                  type="number"
                  min="0"
                  step="0.01"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Enter the sale price to create an engaging ad
                </p>
              </div>
            ) : (
              <div>
                <Textarea
                  placeholder="Enter book information to analyze"
                  value={postInfo}
                  onChange={(e) => setPostInfo(e.target.value)}
                  className="border-primary min-h-[100px]"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Share interesting facts, quotes, or insights about your book
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={loading || (activeTab === 'ad' ? !salePrice : !postInfo)}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              {loading ? "Generating..." : `Generate ${activeTab === 'ad' ? 'Ad' : 'Post'}`}
            </Button>
          </div>
        </Card>
      </div>

      {requestId && <GeneratedContent requestId={requestId} />}
    </div>
  )
} 