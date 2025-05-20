"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Button as TremorButton } from "@tremor/react"
import { FileText, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "../context/AuthContext"
import { getUserProjects, createBookOutline, addOutlineToProject, saveOutlineHistory } from "../lib/firebase/services"
import type { Project } from "../types/firebase"
import { toast } from "sonner"

interface Chapter {
  Title: string;
  Content: string[];
  Chapter: number;
}

interface OutlineData {
  Title: string;
  Chapters: Chapter[];
}

interface OutlineResponse {
  outline: OutlineData;
}

export default function BookOutline({ title: initialTitle }: { title: string }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(initialTitle)
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectOutline, setProjectOutline] = useState<Project[]>([])

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        console.log('No user found, skipping project fetch');
        return;
      }

      try {
        if (!user.uid) {
          throw new Error('User ID is undefined');
        }
        
        const userProjects = await getUserProjects(user.uid);
        
        if (!Array.isArray(userProjects)) {
          throw new Error('Fetched projects is not an array');
        }
        
        setProjectOutline(userProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        if (error instanceof Error) {
          alert(`Failed to load projects: ${error.message}`);
        } else {
          alert('Failed to load projects. Please try refreshing the page.');
        }
      }
    };

    fetchProjects();
  }, [user]);

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  const generateOutline = async () => {
    if (!title.trim()) return

    setLoading(true)
    setError(null)
    setOutline(null)
    
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
      setTitle('')

      // Save to outline history if user is logged in
      if (user?.uid) {
        await saveOutlineHistory(user.uid, {
          title,
          outline: data.outline
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string) => {
    toast(message, {
      className: "bg-purple-50 text-purple-800 border-purple-200",
      style: {
        border: "1px solid #e9d8fd",
      },
    });
  };

  const handleAddOutlineToProject = async (projectId: string) => {
    if (!user) {
      showToast('Please sign in to add outline to a project');
      return;
    }

    try {
      if (!outline?.outline.Chapters.length) {
        showToast('No outline available to add to project');
        return;
      }

      // Check if the project already has an outline
      const project = projectOutline.find((p) => p.id === projectId);
      if (project && Array.isArray((project as any).outlines) && (project as any).outlines.length > 0) {
        const confirmReplace = window.confirm('This project already has an outline. Adding a new outline will override the existing one. Do you want to continue?');
        if (!confirmReplace) return;
      }

      await addOutlineToProject(projectId, title, outline);
      showToast(`Outline added to project: ${project?.name}`);
    } catch (error) {
      console.error("Error adding outline to project:", error);
      showToast('Failed to add outline to project. Please try again.');
    }
  };

  const handleSaveToProject = async (projectId: string) => {
    if (!user || !outline) return;

    try {
      const outlineContent = JSON.stringify(outline.outline, null, 2);
      await createBookOutline(user.uid, outlineContent, projectId);
      showToast('Outline saved to project successfully!');
    } catch (error) {
      console.error('Error saving outline to project:', error);
      showToast('Failed to save outline to project. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Book Outline</h1>
      </div>

      <Card className="bg-white shadow-sm p-0">
        <div className="flex gap-4 p-4">
          <TextInput
            placeholder="Enter your book title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-grow tr-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                generateOutline();
              }
            }}
          />
          <TremorButton
            onClick={generateOutline}
            loading={loading}
            className="bg-primary text-white hover:bg-primary/90 px-8"
          >
            Generate Outline
          </TremorButton>
        </div>
      </Card>

      {error && (
        <Card className="bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      <Card className="bg-white shadow-sm p-6 min-h-[400px] transition-all duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-primary">
              {loading ? 'Generating Outline...' : outline ? 'Generated Outline' : 'Enter a title to generate an outline'}
            </h2>
          </div>
          <div className={!loading && outline ? 'opacity-100' : 'opacity-0'}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  Save to Project
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {projectOutline.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleAddOutlineToProject(project.id)}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          
          <div className={loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}>
            {outline?.outline ? (
              <div className="prose prose-sm max-w-none">
                <h3 className="text-2xl font-bold mb-2">{outline.outline.Title}</h3>
                
                {outline.outline.Chapters && outline.outline.Chapters.length > 0 ? (
                  outline.outline.Chapters.map((chapter) => (
                    <div key={chapter.Chapter} className="mt-6">
                      <h4 className="text-xl text-black font-bold mb-2">
                        Chapter {chapter.Chapter}: {chapter.Title}
                      </h4>
                      <div className="ml-4 space-y-2">
                        {Object.entries(chapter)
                          .filter(([key]) => !['Chapter', 'Title'].includes(key))
                          .map(([key, value]) => (
                            <div key={key} className="mb-4">
                              <h5 className="font-semibold text-gray-800 mb-2">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </h5>
                              {Array.isArray(value) ? (
                                <ul className="list-disc list-inside text-gray-700 space-y-1">
                                  {value.map((item, index) => (
                                    <li key={index} className="text-gray-700">{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-gray-700">{value}</p>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No chapters available in this outline.</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Enter a book title above and click "Generate Outline" to get started
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
