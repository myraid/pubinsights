"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Button as TremorButton } from "@tremor/react"
import { FileText, ChevronDown, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "../context/AuthContext"
import { getUserProjects, createBookOutline, saveOutlineHistory, getOutlineHistory, addOutlineToProject } from "../lib/firebase/services"
import type { Project } from "../types/firebase"
import { toast } from "sonner"

interface Chapter {
  title: string;
  content: string[];
}

interface OutlineData {
  title: string;
  chapters: Chapter[];
}

interface OutlineResponse {
  outline: OutlineData;
}

interface OutlineHistoryItem {
  title: string;
  chapters: Chapter[];
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function BookOutline({ title: initialTitle }: { title: string }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(initialTitle)
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectOutline, setProjectOutline] = useState<Project[]>([])
  const [outlineHistory, setOutlineHistory] = useState<OutlineHistoryItem[]>([])

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
    const fetchOutlineHistory = async () => {
      if (!user?.uid) {
        console.log('No user found, skipping outline history fetch');
        return;
      }
      try {
        console.log('Fetching outline history for user:', user.uid);
        const history = await getOutlineHistory(user.uid);
        console.log('Fetched outline history:', history);
        setOutlineHistory(history);
      } catch (error) {
        console.error("Error fetching outline history:", error);
      }
    };

    fetchOutlineHistory();
  }, [user]);

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
      console.log('outline ; ', data)

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate outline')
      }
      
      // Save to history before setting new outline
      if (user?.uid) {
        await saveOutlineHistory(user.uid, data.outline)
        // Update local outline history state
        const newHistoryItem: OutlineHistoryItem = {
          ...data.outline,
          createdAt: {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: 0
          }
        };
        setOutlineHistory(prev => [newHistoryItem, ...prev].slice(0, 10));
      }
      
      setOutline(data)
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
      if (!outline?.outline.chapters.length) {
        showToast('No outline available to add to project');
        return;
      }

      await addOutlineToProject(projectId, title, outline);
      
      // Show success message
      const project = projectOutline.find((p) => p.id === projectId);
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

  const loadOutlineFromHistory = (historyItem: OutlineHistoryItem) => {
    setTitle(historyItem.title);
    setOutline({ outline: historyItem });
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
            onKeyDown={(e) => e.key === 'Enter' && generateOutline()}
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

      {/* Recent Outlines Panel */}
      <Card className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Recent Outlines</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {outlineHistory.map((item) => (
            <Button
              key={item.title}
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => loadOutlineFromHistory(item)}
            >
              {item.title}
            </Button>
          ))}
        </div>
      </Card>

      {error && (
        <Card className="bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {outline && outline.outline && (
        <Card className="bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FileText className="w-6 h-6 text-primary mr-2" />
              <h2 className="text-lg font-semibold text-primary">Generated Outline</h2>
            </div>
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

          <div className="prose prose-sm max-w-none">
            <h3 className="text-2xl font-bold mb-2">{outline.outline.title}</h3>
            
            {outline.outline.chapters && outline.outline.chapters.length > 0 ? (
              outline.outline.chapters.map((chapter) => (
                <div key={chapter.title} className="mt-6">
                  <h4 className="text-xl text-black font-bold mb-2">
                     {chapter.title}
                  </h4>
                  <div className="ml-4 space-y-2">
                    <p className="text-gray-700">
                      {chapter.content.map((content, index) => (
                        <p key={index} className="text-gray-700">
                          {content}
                        </p>
                      ))}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-600">No chapters available in this outline.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

