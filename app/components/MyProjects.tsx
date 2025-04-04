"use client"

import React, { useState, useEffect } from "react"
import { PlusCircle, Book, Trash2, FileText, Share2, TrendingUp, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "../context/AuthContext"
import { createProject, getUserProjects, getProject } from "../lib/firebase/services"
import type { Project, BookOutline, RelatedBook } from "../types/firebase"
import type { TrendData, AmazonBook } from "@/app/types/index"
import Image from "next/image"
import { toast } from "sonner"

interface BookContent {
  research: {
    trendData: TrendData | null
    amazonBooks: AmazonBook[]
  } | null
  outline: BookOutline | null
  socialMedia: any | null
}

interface ProjectWithContent extends Project {
  content?: BookContent;
  outlines?: {
    title: string;
    outline: {
      Title: string;
      Chapters: {
        Chapter: number;
        Title: string;
        [key: string]: string[] | string | number; // Allow dynamic content
      }[];
    };
    createdAt: {
      seconds: number;
      nanoseconds: number;
    };
  }[];
  relatedBooks?: RelatedBook[];
  research?: {
    keyword: string;
    trendData: TrendData;
    books: AmazonBook[];
  }[];
}

const MyProjects: React.FC = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectWithContent[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithContent | null>(null)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [isAddingProject, setIsAddingProject] = useState(false)

  const renderValue = (value: unknown): React.ReactNode => {
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          {value.map((item, index) => (
            <li key={index} className="text-gray-700">{String(item)}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-gray-700">{String(value)}</p>;
  };

  const showToast = (message: string) => {
    toast(message, {
      className: "bg-purple-50 text-purple-800 border-purple-200",
      style: {
        border: "1px solid #e9d8fd",
      },
    });
  };

  // Fetch user's projects on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        console.log('No user found, skipping project fetch');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Check if user.uid is defined
        if (!user.uid) {
          throw new Error('User ID is undefined');
        }
        
        const userProjects = await getUserProjects(user.uid);
        
        if (!Array.isArray(userProjects)) {
          throw new Error('Fetched projects is not an array');
        }
        
        setProjects(userProjects);
      } catch (error) {
        //console.error("Error in fetchProjects:", error);
        if (error instanceof Error) {
         // console.error('Error details:', {
          // message: error.message,
          // stack: error.stack
          //});
          alert(`Failed to load projects: ${error.message}`);
        } else {
          alert('Failed to load projects. Please try refreshing the page.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  // Fetch project details when a project is selected
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!selectedProject?.id) return

      try {
        console.log('Fetching details for project:', selectedProject.id)
        const projectDetails = await getProject(selectedProject.id)
        if (projectDetails) {
          console.log('Fetched project details:', projectDetails)
          console.log('Project outlines:', projectDetails.outlines)
          if (projectDetails.outlines?.[0]) {
            console.log('First outline:', projectDetails.outlines[0])
            console.log('First outline structure:', projectDetails.outlines[0].outline)
            console.log('Chapters:', projectDetails.outlines[0].outline?.Chapters)
          }
          setSelectedProject(projectDetails)
        }
      } catch (error) {
        console.error("Error fetching project details:", error)
        alert('Failed to load project details. Please try again.')
      }
    }

    fetchProjectDetails()
  }, [selectedProject?.id])

  const addProject = async () => {
    if (!user || !newProjectTitle.trim()) return

    try {
      setIsAddingProject(true)
      console.log('Creating new project:', { userId: user.uid, title: newProjectTitle })
      const newProject = await createProject(user.uid, newProjectTitle.trim())
      console.log('Project created successfully:', newProject)
      
      // Add the new project to the projects list and select it
      const updatedProjects = [...projects, newProject]
      setProjects(updatedProjects)
      setSelectedProject(newProject)
      setNewProjectTitle("")
    } catch (error) {
      console.error("Error creating project:", error)
      // Show error to user with more specific message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create project. Please try again.'
      alert(errorMessage)
    } finally {
      setIsAddingProject(false)
    }
  }

  const getOverallBSR = (book: AmazonBook) => {
    return Math.min(...book.bsr.map((rank) => rank.rank))
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        Please sign in to view your projects
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        Loading projects...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Left Pane (Project List) */}
      <div className="w-1/4 p-4 border-r border-purple-200 overflow-y-auto">
        <h2 className="text-lg font-semibold text-purple-800 mb-4">My Projects</h2>
        {user && (
          <p className="text-sm text-gray-600 mb-4">Signed in as: {user.email}</p>
        )}
        <div className="flex mb-4">
          <Input
            type="text"
            placeholder="New project name"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            className="mr-2 bg-white text-purple-800"
          />
          <Button 
            onClick={addProject} 
            size="sm" 
            className="bg-purple-600 text-white hover:bg-purple-700"
            disabled={isAddingProject || !newProjectTitle.trim()}
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            {isAddingProject ? "Adding..." : "Add"}
          </Button>
        </div>
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                selectedProject?.id === project.id ? "bg-purple-100 text-purple-800" : "text-purple-800 hover:bg-purple-50"
              }`}
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-center">
                <Book className="w-4 h-4 mr-2" />
                <span>{project.name}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right Pane (Project Details) */}
      <div className="w-3/4 p-4 overflow-y-auto">
        {selectedProject ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-purple-800 mb-4">{selectedProject.name}</h2>
            {selectedProject.description && (
              <p className="text-gray-600 mb-4">{selectedProject.description}</p>
            )}

            {/* Book Outlines Section */}
            {selectedProject.outlines && selectedProject.outlines.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    <h3 className="text-lg font-semibold text-purple-800">Book Outline</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-purple-800 hover:text-purple-900"
                    onClick={() => {
                      if (!selectedProject?.outlines?.[0]?.outline) return;
                      const outline = selectedProject.outlines[0].outline;
                      const formattedOutline = `${outline.Title}\n\n${outline.Chapters.map(chapter => {
                        const chapterContent = Object.entries(chapter)
                          .filter(([key]) => !['Chapter', 'Title'].includes(key))
                          .map(([key, value]) => {
                            const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
                            if (Array.isArray(value)) {
                              return `${formattedKey}:\n${value.map(item => `• ${item}`).join('\n')}`;
                            }
                            return `${formattedKey}: ${value}`;
                          }).join('\n\n');
                        
                        return `Chapter ${chapter.Chapter}: ${chapter.Title}\n\n${chapterContent}`;
                      }).join('\n\n')}`;
                      
                      navigator.clipboard.writeText(formattedOutline);
                      showToast('Outline copied to clipboard!');
                    }}
                  >
                    Copy Outline
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none">
                  {selectedProject.outlines[0].outline && (
                    <>
                      <h3 className="text-2xl font-bold mb-4">{selectedProject.outlines[0].outline.Title}</h3>
                      {selectedProject.outlines[0].outline.Chapters && selectedProject.outlines[0].outline.Chapters.length > 0 ? (
                        selectedProject.outlines[0].outline.Chapters.map((chapter) => (
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
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Research Section */}
            {selectedProject.research && selectedProject.research.length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" /> Market Research
                </h3>
                <div className="space-y-6">
                  {selectedProject.research.map((research, index) => (
                    <div key={index} className="space-y-4">
                      <h4 className="font-medium text-gray-900">Research for "{research.keyword}"</h4>
                      <div className="space-y-4">
                        {research.books.map((book) => (
                          <div key={book.id} className="flex gap-4 p-4 border rounded-lg hover:bg-primary/5 transition-colors duration-200">
                            <div className="relative w-24 h-32 flex-shrink-0">
                              <Image
                                src={book.image}
                                alt={book.title}
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                            <div className="flex-grow">
                              <div className="flex items-center gap-2 mb-2">
                                <h5 
                                  className="font-semibold text-lg text-black hover:text-primary cursor-pointer"
                                  onClick={() => window.open(`https://www.amazon.com/dp/${book.id}`, "_blank")}
                                >
                                  {book.title}
                                </h5>
                                {book.isIndie && (
                                  <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                                    Indie Author
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm text-gray-600 mb-2">
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Author</span>
                                  <span className="truncate">{book.author}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Rating</span>
                                  <span>{book.rating.toFixed(1)} ({book.reviewCount} reviews)</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Rank</span>
                                  <span>{Math.min(...book.bsr.map((rank: { rank: number }) => rank.rank))}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Price</span>
                                  <span>${book.price.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Publisher</span>
                                  <span className="truncate">{book.publisher}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500">Release</span>
                                  <span>{book.publicationYear}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {book.categories.slice(0, 3).map((category: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-gray-100 px-2 py-1 rounded"
                                  >
                                    {category}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Related Books Section */}
            {selectedProject.relatedBooks && selectedProject.relatedBooks.length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" /> Related Books
                </h3>
                <div className="space-y-4">
                  {selectedProject.relatedBooks.map((book, index) => (
                    <div key={book.id || index} className="bg-gray-50 p-3 rounded">
                      <h4 className="font-semibold">{book.title}</h4>
                      <p className="text-sm text-gray-600">By {book.author}</p>
                      <p className="text-sm mt-2">{book.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {(!selectedProject.outlines || selectedProject.outlines.length === 0) &&
             (!selectedProject.relatedBooks || selectedProject.relatedBooks.length === 0) &&
             (!selectedProject.research || selectedProject.research.length === 0) && (
              <p className="text-gray-600">
                No content has been added to this project yet. Use the Book Research, Book Outline, or Social Media features to
                add content.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-purple-800">
            Select a project to view details
          </div>
        )}
      </div>
    </div>
  )
}

export default MyProjects

