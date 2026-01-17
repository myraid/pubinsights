"use client"

import React, { useState, useEffect } from "react"
import { PlusCircle, Book, Trash2, FileText, Share2, TrendingUp, ShoppingCart, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/app/context/AuthContext"
import { createProject, getUserProjects, getProject } from "@/app/lib/firebase/services"
import type { Project, BookOutline, RelatedBook } from "@/app/types/firebase"
import type { TrendData, AmazonBook } from "@/types"
import Image from "next/image"
import { toast } from "sonner"
import dynamic from "next/dynamic"

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

// Add Plotly types
interface PlotlyLayout {
  height?: number;
  margin?: { t: number; r: number; b: number; l: number };
  xaxis?: {
    title?: string;
    showgrid?: boolean;
    zeroline?: boolean;
    tickformat?: string;
    dtick?: string;
    tickangle?: number;
    tickfont?: {
      size?: number;
      color?: string;
    };
    range?: string[];
    automargin?: boolean;
  };
  yaxis?: {
    title?: string;
    showgrid?: boolean;
    gridcolor?: string;
    zeroline?: boolean;
    range?: number[];
    ticksuffix?: string;
    tickfont?: {
      size?: number;
      color?: string;
    };
    rangemode?: string;
    automargin?: boolean;
  };
  plot_bgcolor?: string;
  paper_bgcolor?: string;
  showlegend?: boolean;
  legend?: {
    orientation?: string;
    yanchor?: string;
    y?: number;
    xanchor?: string;
    x?: number;
    font?: {
      size?: number;
      color?: string;
    };
    bgcolor?: string;
    bordercolor?: string;
    borderwidth?: number;
  };
  hovermode?: string;
  autosize?: boolean;
}

interface PlotlyConfig {
  displayModeBar?: boolean;
  responsive?: boolean;
  scrollZoom?: boolean;
}

type PlotData = {
  x: Date[];
  y: number[];
  type: string;
  mode: string;
  name: string;
  line: {
    shape: string;
    smoothing: number;
    width: number;
    color: string;
  };
}[];

// Dynamically import Plotly with no SSR
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div>Loading Plot...</div>
})

const MyProjects: React.FC = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectWithContent[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithContent | null>(null)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [activeCard, setActiveCard] = useState<'competing' | 'market' | 'trends' | 'outline' | null>(null)

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
    return book.bsr;
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
              onClick={() => {
                setSelectedProject(project)
                setActiveCard(null)
              }}
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

            {/* Cards Section */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {/* Competing Books Card */}
              {selectedProject.research?.some(r => r.books?.length > 0) && (
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    activeCard === 'competing' ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50'
                  }`}
                  onClick={() => setActiveCard(activeCard === 'competing' ? null : 'competing')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ShoppingCart className="w-5 h-5 mr-2 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Competing Books</h3>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedProject.research?.reduce((acc, curr) => acc + curr.books.length, 0) || 0} books
                    </span>
                  </div>
                </Card>
              )}

              {/* Market Intelligence Card */}
              {selectedProject.research?.some(r => r.trendData) && (
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    activeCard === 'market' ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50'
                  }`}
                  onClick={() => setActiveCard(activeCard === 'market' ? null : 'market')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Market Intelligence</h3>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedProject.research?.length || 0} analyses
                    </span>
                  </div>
                </Card>
              )}

              {/* Trends Data Card */}
              {selectedProject.research?.some(r => r.trendData?.webSearch || r.trendData?.youtube) && (
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    activeCard === 'trends' ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50'
                  }`}
                  onClick={() => setActiveCard(activeCard === 'trends' ? null : 'trends')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Trends Data</h3>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedProject.research?.length || 0} trends
                    </span>
                  </div>
                </Card>
              )}

              {/* Book Outline Card */}
              {selectedProject.outlines && selectedProject.outlines.length > 0 && (
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    activeCard === 'outline' ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50'
                  }`}
                  onClick={() => setActiveCard(activeCard === 'outline' ? null : 'outline')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Book Outline</h3>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedProject.outlines?.length || 0} outline{selectedProject.outlines?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Card>
              )}
            </div>

            {/* Content Sections */}
            {activeCard === 'competing' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-4">Competing Books Analysis</h3>
                <div className="space-y-6">
                  {selectedProject.research.map((research, index) => (
                    <div key={index} className="space-y-4">
                      <h4 className="font-medium text-gray-900">Books for "{research.keyword}"</h4>
                      <div className="space-y-4">
                        {research.books.map((book) => (
                          <Card key={book.asin} className="p-4 mb-4 hover:shadow-lg transition-shadow hover:border-primary/50 hover:bg-primary/5">
                            <div className="flex gap-4">
                              <div 
                                className="relative w-32 h-48 flex-shrink-0 cursor-pointer"
                                onClick={() => window.open(book.url, '_blank')}
                              >
                                <Image
                                  src={book.image_url}
                                  alt={book.title}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-2 text-primary">{book.title}</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                  {book.manufacturer || 'Unknown'}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">Price</span>
                                      ${book.price.toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">Rating</span>
                                      {book.rating}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">Reviews</span>
                                      {book.reviews_count?.toLocaleString() || 0}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">BSR</span>
                                      {book.bsr.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">Published</span>
                                      {book.publication_date || 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium block">Publisher</span>
                                      {book.publisher || 'Unknown'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeCard === 'market' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card className="p-4">
                <h3 className="text-2xl font-semibold text-purple-700 mb-6 flex items-center">
                  <span className="mr-2"><TrendingUp className="w-6 h-6 text-purple-700" /></span>
                  Market Intelligence
                </h3>
                {(() => {
                  const insights = selectedProject.research[0].marketIntelligence;
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Market Score */}
                        <div className="bg-purple-50 rounded-xl p-6 flex flex-col items-center justify-center">
                          <h4 className="text-lg font-semibold text-purple-700 mb-4 flex items-center">
                            <BarChart3 className="w-5 h-5 mr-2" />
                            Market Score
                          </h4>
                          <div className="relative w-32 h-32 mb-2 flex items-center justify-center">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                              <circle
                                className="text-purple-200"
                                strokeWidth="10"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="50"
                                cy="50"
                              />
                              <circle
                                className="text-purple-600"
                                strokeWidth="10"
                                strokeDasharray={`${(insights?.rating || 0) * 251.2} 251.2`}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="50"
                                cy="50"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-3xl font-bold text-purple-700">
                                {insights?.rating || 0}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 text-center mt-2">Market Opportunity Score</p>
                        </div>
                        {/* Key Insights */}
                        <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                          <h4 className="text-lg font-semibold text-purple-700 mb-4 flex items-center">
                            <span className="mr-2"><span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.02 0l1.41-1.41M6.34 6.34L4.93 4.93" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>
                            Key Insights
                          </h4>
                          <ul className="list-disc list-inside text-purple-900 space-y-2">
                            {(insights?.insights || []).map((insight: string, idx: number) => (
                              <li key={idx} className="text-sm">{insight}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Pros */}
                        <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                          <h4 className="text-lg font-semibold text-green-700 mb-4 flex items-center">
                            <span className="mr-2"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            Pros
                          </h4>
                          <ul className="list-disc list-inside text-green-900 space-y-2">
                            {(insights?.pros || []).map((pro: string, idx: number) => (
                              <li key={idx} className="text-sm">{pro}</li>
                            ))}
                          </ul>
                        </div>
                        {/* Cons */}
                        <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                          <h4 className="text-lg font-semibold text-red-700 mb-4 flex items-center">
                            <span className="mr-2"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M19 13l-4 4-4-4M5 7l4 4 4-4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            Cons
                          </h4>
                          <ul className="list-disc list-inside text-red-900 space-y-2">
                            {(insights?.cons || []).map((con: string, idx: number) => (
                              <li key={idx} className="text-sm">{con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {/* Suggested Title */}
                      <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                        <h4 className="text-lg font-semibold text-purple-700 mb-4 flex items-center">
                          <span className="mr-2"><span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.02 0l1.41-1.41M6.34 6.34L4.93 4.93" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>
                          Suggested Title
                        </h4>
                        <p className="text-lg text-gray-800 font-medium">
                          {insights?.title_suggestion || 'No title suggestion available'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </Card>
            )}

            {activeCard === 'trends' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-4">Trends Data</h3>
                <div className="space-y-6">
                  {selectedProject.research.map((research, index) => (
                    <div key={index} className="space-y-4">
                      <h4 className="font-medium text-gray-900">Trends for "{research.keyword}"</h4>
                      {research.trendData && (
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h5 className="font-semibold mb-2">Interest over time</h5>
                            <div className="h-[400px]">
                              {(research.trendData.webSearch?.timelineData?.length > 0 || research.trendData.youtube?.timelineData?.length > 0) && (
                                <Plot
                                  data={[
                                    ...(research.trendData.webSearch?.timelineData?.length > 0 ? [{
                                      x: research.trendData.webSearch.timelineData.map(point => 
                                        new Date(parseInt(point.time) * 1000)
                                      ),
                                      y: research.trendData.webSearch.timelineData.map(point => point.value[0]),
                                      type: "scatter",
                                      mode: "lines",
                                      name: "Web Search",
                                      line: {
                                        shape: "spline",
                                        smoothing: 1.3,
                                        width: 3,
                                        color: '#2563eb'
                                      }
                                    }] : []),
                                    ...(research.trendData.youtube?.timelineData?.length > 0 ? [{
                                      x: research.trendData.youtube.timelineData.map(point => 
                                        new Date(parseInt(point.time) * 1000)
                                      ),
                                      y: research.trendData.youtube.timelineData.map(point => point.value[0]),
                                      type: "scatter",
                                      mode: "lines",
                                      name: "YouTube Search",
                                      line: {
                                        shape: "spline",
                                        smoothing: 1.3,
                                        width: 3,
                                        color: '#dc2626'
                                      }
                                    }] : [])
                                  ] as any}
                                  layout={{
                                    autosize: true,
                                    height: 400,
                                    width: null,
                                    margin: { t: 30, r: 40, b: 70, l: 60 },
                                    xaxis: {
                                      title: '',
                                      showgrid: false,
                                      gridcolor: '#f3f4f6',
                                      zeroline: false,
                                      tickformat: '%b %Y',
                                      dtick: 'M2',
                                      tickangle: -45,
                                      tickfont: {
                                        size: 12,
                                        color: '#6b7280'
                                      },
                                      range: [
                                        new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
                                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                                      ],
                                      automargin: true
                                    },
                                    yaxis: {
                                      title: 'Search Interest',
                                      titlefont: {
                                        size: 13,
                                        color: '#6b7280'
                                      },
                                      showgrid: false,
                                      gridcolor: '#f3f4f6',
                                      zeroline: false,
                                      range: [0, 100],
                                      ticksuffix: '%',
                                      tickfont: {
                                        size: 12,
                                        color: '#6b7280'
                                      },
                                      rangemode: 'tozero',
                                      automargin: true
                                    },
                                    plot_bgcolor: 'white',
                                    paper_bgcolor: 'white',
                                    showlegend: true,
                                    legend: {
                                      orientation: 'h',
                                      yanchor: 'bottom',
                                      y: -0.2,
                                      xanchor: 'center',
                                      x: 0.5,
                                      font: {
                                        size: 12,
                                        color: '#6b7280'
                                      },
                                      bgcolor: 'rgba(255,255,255,0.9)',
                                      bordercolor: 'rgba(0,0,0,0.1)',
                                      borderwidth: 1
                                    },
                                    hovermode: 'x unified',
                                    hoverlabel: {
                                      bgcolor: 'white',
                                      bordercolor: '#e5e7eb',
                                      font: {
                                        size: 12,
                                        color: '#374151'
                                      }
                                    }
                                  } as PlotlyLayout}
                                  config={{
                                    displayModeBar: false,
                                    responsive: true,
                                    scrollZoom: false
                                  } as PlotlyConfig}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeCard === 'outline' && selectedProject.outlines && selectedProject.outlines.length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-4">Book Outline</h3>
                <div className="space-y-6">
                  {selectedProject.outlines.map((outline, index) => (
                    <div key={index} className="space-y-4">
                      <h4 className="font-medium text-gray-900">{outline.title}</h4>
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
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {!activeCard && (
              <div className="text-center text-gray-600 py-8">
                Select a card above to view detailed information
              </div>
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

