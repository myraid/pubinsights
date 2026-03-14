"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Title, Textarea } from "@tremor/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ShoppingCart, Share2, ChevronDown } from "lucide-react"
import Image from "next/image"
import GeneratedContent from "./GeneratedContent"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, addSocialContentToProject } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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

interface ContentItem {
  type: 'post' | 'ad'
  platform: string
  content: string
}

export default function ContentGenerator({ bookDetails }: ContentGeneratorProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'ad' | 'post'>('ad')
  const [loading, setLoading] = useState(false)
  const [generatedItems, setGeneratedItems] = useState<ContentItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [salePrice, setSalePrice] = useState("")
  const [postInfo, setPostInfo] = useState("")

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user?.uid) return
      try {
        const userProjects = await getUserProjects(user.uid)
        setProjects(userProjects)
      } catch (error) {
        console.error("Error fetching projects:", error)
      }
    }
    fetchProjects()
  }, [user])

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
    setGeneratedItems([])
    try {
      const formDataToSend = new FormData()
      formDataToSend.append("title", bookDetails.title)
      formDataToSend.append("bookDescription", bookDetails.description)
      formDataToSend.append("contentType", activeTab)
      if (user?.uid) formDataToSend.append("userId", user.uid)

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

      if (data.generatedContent) {
        setGeneratedItems(data.generatedContent)
      }

      setSalePrice("")
      setPostInfo("")

      toast.success("Content generated successfully")
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error("Failed to generate content")
    } finally {
      setLoading(false)
    }
  }

  const handleAddToProject = async (projectId: string) => {
    if (!generatedItems.length) {
      toast.error("No generated content to add")
      return
    }

    try {
      await addSocialContentToProject(projectId, {
        title: bookDetails.title,
        contentType: activeTab,
        items: generatedItems,
      })

      const project = projects.find(p => p.id === projectId)
      toast.success(`Content added to project: ${project?.name}`)
    } catch (error) {
      console.error("Error adding to project:", error)
      toast.error("Failed to add content to project")
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
                <Image
                  src={URL.createObjectURL(bookDetails.coverImage)}
                  alt="Book cover"
                  width={128}
                  height={160}
                  className="w-32 h-40 object-cover rounded-lg mt-2"
                  unoptimized
                />
              </div>
            )}
          </div>
        </Card>

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

      {generatedItems.length > 0 && (
        <>
          {user && projects.length > 0 && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-primary border-primary">
                    Add to Project
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => handleAddToProject(project.id)}
                    >
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <GeneratedContent items={generatedItems} />
        </>
      )}
    </div>
  )
}
