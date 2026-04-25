"use client"

import React, { useState, useEffect } from "react"
import { PlusCircle, Book, FileText, TrendingUp, ShoppingCart, BarChart3, Share2, FolderOpen, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/app/context/AuthContext"
import { createProject, getUserProjects, getProject } from "@/app/lib/firebase/services"
import type { Project, BookOutline, RelatedBook } from "@/app/types/firebase"
import type { TrendData, AmazonBook } from "@/types"
import Image from "next/image"
import dynamic from "next/dynamic"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

interface BookContent {
  research: {
    trendData: TrendData | null
    amazonBooks: AmazonBook[]
  } | null
  outline: BookOutline | null
  socialMedia: unknown | null
}

interface SocialContentItem {
  type: 'post' | 'ad';
  platform: string;
  content: string;
}

interface ProjectSocialContent {
  title: string;
  contentType: 'ad' | 'post';
  items: SocialContentItem[];
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

interface ProjectWithContent extends Project {
  content?: BookContent;
  outlines?: {
    title?: string;
    outline: {
      Title?: string;
      Chapters?: unknown[];
    };
    createdAt: {
      seconds: number;
      nanoseconds: number;
    } | import("firebase/firestore").Timestamp;
  }[];
  relatedBooks?: RelatedBook[];
  research?: {
    keyword: string;
    trendData: TrendData;
    books: AmazonBook[];
    marketIntelligence?: {
      rating: number;
      insights: string[];
      content_gaps: string[];
      title_suggestion: string;
      cover_quality_score?: number;
      cover_quality_summary?: string;
    } | null;
  }[];
  socialContent?: ProjectSocialContent[];
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

type PlotTrace = {
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
};

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
  const [activeCard, setActiveCard] = useState<'competing' | 'market' | 'trends' | 'outline' | 'social' | null>(null)

  // Note: helper functions removed (unused).

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
          setSelectedProject(projectDetails as ProjectWithContent)
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

  // Note: getOverallBSR removed (unused).

  if (!user) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
      >
        <p style={{ color: BRAND.gray }}>Please sign in to view your projects.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: BRAND.primary, borderTopColor: "transparent" }}
          />
          <p style={{ color: BRAND.gray, fontSize: "0.875rem" }}>Loading your projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-[calc(100vh-200px)]"
      style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {/* Left Pane — Project List */}
      <div
        className="w-72 flex-shrink-0 flex flex-col border-r overflow-hidden"
        style={{ borderColor: "#E8D5F5", background: "#FFFFFF" }}
      >
        {/* Sidebar header */}
        <div className="p-5 border-b" style={{ borderColor: "#E8D5F5" }}>
          <div className="flex items-center justify-between mb-1">
            <h2
              className="text-base font-semibold tracking-tight [font-family:var(--font-playfair,Georgia,serif)]"
              style={{ color: BRAND.deep }}
            >
              My Projects
            </h2>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: BRAND.bg, color: BRAND.primary }}
            >
              {projects.length}
            </span>
          </div>
          {user && (
            <p className="text-xs truncate" style={{ color: BRAND.gray }}>
              {user.email}
            </p>
          )}
        </div>

        {/* New project input */}
        <div className="p-4 border-b" style={{ borderColor: "#E8D5F5" }}>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="New project name"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addProject() }}
              className="flex-1 text-sm bg-white"
              style={{
                borderColor: "#DDD0EC",
                outline: "none",
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              }}
            />
            <Button
              onClick={addProject}
              size="sm"
              disabled={isAddingProject || !newProjectTitle.trim()}
              className="flex-shrink-0 text-white text-xs px-3"
              style={{
                background: BRAND.primary,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              }}
            >
              <PlusCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {projects.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: BRAND.gray }}>
              No projects yet
            </p>
          ) : (
            projects.map((project) => {
              const isActive = selectedProject?.id === project.id
              return (
                <button
                  key={project.id}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150 group"
                  style={{
                    background: isActive ? BRAND.bg : "transparent",
                    borderLeft: isActive ? `3px solid ${BRAND.primary}` : "3px solid transparent",
                  }}
                  onClick={() => {
                    setSelectedProject(project)
                    setActiveCard(null)
                  }}
                >
                  <Book
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isActive ? BRAND.primary : BRAND.gray }}
                  />
                  <span
                    className="text-sm truncate flex-1"
                    style={{
                      color: isActive ? BRAND.deep : "#333",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {project.name}
                  </span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND.primary }} />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Pane — Project Details */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedProject ? (
          <div className="space-y-6">
            {/* Project heading */}
            <div>
              <h2
                className="text-2xl font-bold [font-family:var(--font-playfair,Georgia,serif)] mb-1"
                style={{ color: BRAND.deep }}
              >
                {selectedProject.name}
              </h2>
              {selectedProject.description && (
                <p className="text-sm" style={{ color: BRAND.gray }}>
                  {selectedProject.description}
                </p>
              )}
            </div>

            {/* Data cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {selectedProject.research?.some(r => r.books?.length > 0) && (
                <DataCard
                  icon={<ShoppingCart className="w-4 h-4" />}
                  label="Competing Books"
                  count={`${selectedProject.research?.reduce((acc, curr) => acc + curr.books.length, 0) || 0}`}
                  isActive={activeCard === 'competing'}
                  onClick={() => setActiveCard(activeCard === 'competing' ? null : 'competing')}
                />
              )}
              {selectedProject.research?.some(r => r.trendData) && (
                <DataCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Market Intelligence"
                  count={`${selectedProject.research?.length || 0}`}
                  isActive={activeCard === 'market'}
                  onClick={() => setActiveCard(activeCard === 'market' ? null : 'market')}
                />
              )}
              {selectedProject.research?.some(r => r.trendData?.webSearch || r.trendData?.youtube) && (
                <DataCard
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Trends"
                  count={`${selectedProject.research?.length || 0}`}
                  isActive={activeCard === 'trends'}
                  onClick={() => setActiveCard(activeCard === 'trends' ? null : 'trends')}
                />
              )}
              {selectedProject.outlines && selectedProject.outlines.length > 0 && (
                <DataCard
                  icon={<FileText className="w-4 h-4" />}
                  label="Book Outline"
                  count={`${selectedProject.outlines?.length || 0}`}
                  isActive={activeCard === 'outline'}
                  onClick={() => setActiveCard(activeCard === 'outline' ? null : 'outline')}
                />
              )}
              {selectedProject.socialContent && selectedProject.socialContent.length > 0 && (
                <DataCard
                  icon={<Share2 className="w-4 h-4" />}
                  label="Social Content"
                  count={`${selectedProject.socialContent.length}`}
                  isActive={activeCard === 'social'}
                  onClick={() => setActiveCard(activeCard === 'social' ? null : 'social')}
                />
              )}
            </div>

            {/* Prompt when no card is active */}
            {!activeCard && (
              <div
                className="rounded-xl border border-dashed p-10 text-center"
                style={{ borderColor: "#DDD0EC" }}
              >
                <FolderOpen className="w-8 h-8 mx-auto mb-3" style={{ color: BRAND.accent }} />
                <p className="text-sm" style={{ color: BRAND.gray }}>
                  Select a section above to explore your project data.
                </p>
              </div>
            )}

            {/* Competing Books */}
            {activeCard === 'competing' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card
                className="overflow-hidden"
                style={{ borderLeft: `3px solid ${BRAND.primary}` }}
              >
                <div className="px-6 py-4 border-b" style={{ borderColor: "#EEE0F8", background: BRAND.bg }}>
                  <h3
                    className="font-semibold [font-family:var(--font-playfair,Georgia,serif)]"
                    style={{ color: BRAND.deep }}
                  >
                    Competing Books Analysis
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {selectedProject.research.map((research, index) => (
                    <div key={index} className="space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                        Keyword: {research.keyword}
                      </p>
                      <div className="space-y-3">
                        {research.books.map((book) => (
                          <div
                            key={book.asin}
                            className="flex gap-4 p-4 rounded-xl border transition-all hover:shadow-sm"
                            style={{ borderColor: "#EEE0F8", background: "#FDFAFF" }}
                          >
                            <div
                              className="relative w-20 h-28 flex-shrink-0 cursor-pointer rounded overflow-hidden"
                              onClick={() => window.open(book.url, '_blank')}
                            >
                              <Image
                                src={book.image_url}
                                alt={book.title}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4
                                className="text-sm font-semibold mb-1 leading-snug [font-family:var(--font-playfair,Georgia,serif)]"
                                style={{ color: BRAND.deep }}
                              >
                                {book.title}
                              </h4>
                              <p className="text-xs mb-3" style={{ color: BRAND.gray }}>
                                {book.manufacturer || 'Unknown'}
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: "Price", value: `$${book.price.toFixed(2)}` },
                                  { label: "Rating", value: String(book.rating) },
                                  { label: "Reviews", value: book.reviews_count?.toLocaleString() || "0" },
                                  { label: "BSR", value: book.bsr.toLocaleString() },
                                  { label: "Published", value: book.publication_date || 'N/A' },
                                  { label: "Publisher", value: book.publisher || 'Unknown' },
                                ].map(({ label, value }) => (
                                  <div key={label}>
                                    <p className="text-xs font-medium" style={{ color: BRAND.primary }}>{label}</p>
                                    <p className="text-xs" style={{ color: BRAND.gray }}>{value}</p>
                                  </div>
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

            {/* Market Intelligence */}
            {activeCard === 'market' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card
                className="overflow-hidden"
                style={{ borderLeft: `3px solid ${BRAND.primary}` }}
              >
                <div className="px-6 py-4 border-b" style={{ borderColor: "#EEE0F8", background: BRAND.bg }}>
                  <h3
                    className="font-semibold flex items-center gap-2 [font-family:var(--font-playfair,Georgia,serif)]"
                    style={{ color: BRAND.deep }}
                  >
                    <TrendingUp className="w-4 h-4" style={{ color: BRAND.primary }} />
                    Market Intelligence
                  </h3>
                </div>
                <div className="p-6">
                  {(() => {
                    const insights = selectedProject.research[0].marketIntelligence;
                    return (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Market Score */}
                          <div
                            className="rounded-xl p-6 flex flex-col items-center justify-center"
                            style={{ background: BRAND.bg }}
                          >
                            <p
                              className="text-xs font-semibold uppercase tracking-wider mb-4"
                              style={{ color: BRAND.gray }}
                            >
                              Market Opportunity Score
                            </p>
                            <div className="relative w-28 h-28 mb-2 flex items-center justify-center">
                              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle
                                  strokeWidth="8"
                                  stroke="#E8D5F5"
                                  fill="transparent"
                                  r="40"
                                  cx="50"
                                  cy="50"
                                />
                                <circle
                                  strokeWidth="8"
                                  strokeDasharray={`${(insights?.rating || 0) * 25.12} 251.2`}
                                  strokeLinecap="round"
                                  stroke={BRAND.primary}
                                  fill="transparent"
                                  r="40"
                                  cx="50"
                                  cy="50"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                  className="text-3xl font-bold [font-family:var(--font-playfair,Georgia,serif)]"
                                  style={{ color: BRAND.deep }}
                                >
                                  {insights?.rating || 0}
                                </span>
                                <span className="text-xs" style={{ color: BRAND.gray }}>/10</span>
                              </div>
                            </div>
                          </div>
                          {/* Key Insights */}
                          <div
                            className="rounded-xl p-6"
                            style={{ background: BRAND.bg }}
                          >
                            <p
                              className="text-xs font-semibold uppercase tracking-wider mb-3"
                              style={{ color: BRAND.gray }}
                            >
                              Key Insights
                            </p>
                            <ul className="space-y-2">
                              {(insights?.insights || []).map((insight: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "#333" }}>
                                  <span
                                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: BRAND.primary }}
                                  />
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        {/* Content Gaps */}
                        <div className="rounded-xl p-6" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#166534" }}>
                            Content Gaps
                          </p>
                          <ul className="space-y-2">
                            {(insights?.content_gaps || []).map((gap: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "#166534" }}>
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Suggested Title */}
                        <div
                          className="rounded-xl p-6"
                          style={{ background: BRAND.bg, border: `1px solid #DDD0EC` }}
                        >
                          <p
                            className="text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: BRAND.gray }}
                          >
                            Suggested Title
                          </p>
                          <p
                            className="text-base font-medium [font-family:var(--font-playfair,Georgia,serif)]"
                            style={{ color: BRAND.deep }}
                          >
                            {insights?.title_suggestion || 'No title suggestion available'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            )}

            {/* Trends */}
            {activeCard === 'trends' && selectedProject.research && selectedProject.research.length > 0 && (
              <Card
                className="overflow-hidden"
                style={{ borderLeft: `3px solid ${BRAND.primary}` }}
              >
                <div className="px-6 py-4 border-b" style={{ borderColor: "#EEE0F8", background: BRAND.bg }}>
                  <h3
                    className="font-semibold flex items-center gap-2 [font-family:var(--font-playfair,Georgia,serif)]"
                    style={{ color: BRAND.deep }}
                  >
                    <BarChart3 className="w-4 h-4" style={{ color: BRAND.primary }} />
                    Trends Data
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {selectedProject.research.map((research, index) => (
                    <div key={index} className="space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                        Keyword: {research.keyword}
                      </p>
                      {research.trendData && (
                        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#EEE0F8" }}>
                          <div className="p-4" style={{ background: "#FDFAFF" }}>
                            <p className="text-sm font-medium mb-3" style={{ color: BRAND.deep }}>
                              Interest Over Time
                            </p>
                            <div className="h-[400px]">
                              {(research.trendData.webSearch?.timelineData?.length > 0 || research.trendData.youtube?.timelineData?.length > 0) && (
                                (() => {
                                  const traces: PlotTrace[] = []

                                  if (research.trendData.webSearch?.timelineData?.length) {
                                    traces.push({
                                      x: research.trendData.webSearch.timelineData.map(point => new Date(parseInt(point.time) * 1000)),
                                      y: research.trendData.webSearch.timelineData.map(point => point.value[0]),
                                      type: "scatter",
                                      mode: "lines",
                                      name: "Web Search",
                                      line: {
                                        shape: "spline",
                                        smoothing: 1.3,
                                        width: 3,
                                        color: "#2563eb"
                                      }
                                    })
                                  }

                                  if (research.trendData.youtube?.timelineData?.length) {
                                    traces.push({
                                      x: research.trendData.youtube.timelineData.map(point => new Date(parseInt(point.time) * 1000)),
                                      y: research.trendData.youtube.timelineData.map(point => point.value[0]),
                                      type: "scatter",
                                      mode: "lines",
                                      name: "YouTube Search",
                                      line: {
                                        shape: "spline",
                                        smoothing: 1.3,
                                        width: 3,
                                        color: "#dc2626"
                                      }
                                    })
                                  }

                                  return (
                                    <Plot
                                      data={traces}
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
                                  )
                                })()
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

            {/* Book Outline */}
            {activeCard === 'outline' && selectedProject.outlines && selectedProject.outlines.length > 0 && (
              <Card
                className="overflow-hidden"
                style={{ borderLeft: `3px solid ${BRAND.primary}` }}
              >
                <div className="px-6 py-4 border-b" style={{ borderColor: "#EEE0F8", background: BRAND.bg }}>
                  <h3
                    className="font-semibold flex items-center gap-2 [font-family:var(--font-playfair,Georgia,serif)]"
                    style={{ color: BRAND.deep }}
                  >
                    <FileText className="w-4 h-4" style={{ color: BRAND.primary }} />
                    Book Outline
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {selectedProject.outlines.map((outline, index) => (
                    <div key={index} className="space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: BRAND.gray }}>
                        {outline.title}
                      </p>
                      <div>
                        <h3
                          className="text-xl font-bold mb-4 [font-family:var(--font-playfair,Georgia,serif)]"
                          style={{ color: BRAND.deep }}
                        >
                          {outline.outline.Title}
                        </h3>
                        {outline.outline.Chapters && outline.outline.Chapters.length > 0 ? (
                          <div className="space-y-4">
                            {outline.outline.Chapters.map((chapter, chIdx) => {
                              const chapterData =
                                typeof chapter === 'object' && chapter !== null
                                  ? (chapter as Record<string, unknown>)
                                  : {}
                              const chapterNumber =
                                typeof chapterData.Chapter === 'number' ? chapterData.Chapter : chIdx + 1
                              const chapterTitle =
                                typeof chapterData.Title === 'string' ? chapterData.Title : 'Untitled Chapter'

                              return (
                                <div
                                  key={chapterNumber}
                                  className="rounded-xl p-4 border"
                                  style={{ borderColor: "#EEE0F8", background: "#FDFAFF" }}
                                >
                                  <h4
                                    className="text-sm font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
                                    style={{ color: BRAND.deep }}
                                  >
                                    Chapter {chapterNumber}: {chapterTitle}
                                  </h4>
                                  <div className="ml-2 space-y-3">
                                    {Object.entries(chapterData)
                                      .filter(([key]) => !['Chapter', 'Title'].includes(key))
                                      .map(([key, value]) => (
                                        <div key={key}>
                                          <p
                                            className="text-xs font-semibold uppercase tracking-wider mb-1"
                                            style={{ color: BRAND.primary }}
                                          >
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                          </p>
                                          {Array.isArray(value) ? (
                                            <ul className="space-y-1">
                                              {value.map((item, itemIndex) => (
                                                <li
                                                  key={itemIndex}
                                                  className="flex items-start gap-2 text-sm"
                                                  style={{ color: BRAND.gray }}
                                                >
                                                  <span
                                                    className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                                                    style={{ background: BRAND.accent }}
                                                  />
                                                  {String(item)}
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-sm" style={{ color: BRAND.gray }}>{String(value)}</p>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: BRAND.gray }}>No chapters available in this outline.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Social Content */}
            {activeCard === 'social' && selectedProject.socialContent && selectedProject.socialContent.length > 0 && (
              <Card
                className="overflow-hidden"
                style={{ borderLeft: `3px solid ${BRAND.primary}` }}
              >
                <div className="px-6 py-4 border-b" style={{ borderColor: "#EEE0F8", background: BRAND.bg }}>
                  <h3
                    className="font-semibold flex items-center gap-2 [font-family:var(--font-playfair,Georgia,serif)]"
                    style={{ color: BRAND.deep }}
                  >
                    <Share2 className="w-4 h-4" style={{ color: BRAND.primary }} />
                    Social Content
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {selectedProject.socialContent.map((entry, entryIndex) => (
                    <div key={entryIndex} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: BRAND.deep }}>{entry.title}</p>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: BRAND.bg, color: BRAND.primary }}
                        >
                          {entry.contentType}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entry.items.map((item: SocialContentItem, itemIndex: number) => (
                          <div
                            key={itemIndex}
                            className="rounded-xl p-4 border"
                            style={{ borderColor: "#EEE0F8", background: "#FDFAFF" }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: BRAND.bg, color: BRAND.primary }}
                              >
                                {item.platform}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "#F3F4F6", color: BRAND.gray }}
                              >
                                {item.type}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: "#333" }}>
                              {item.content}
                            </p>
                            <button
                              onClick={() => navigator.clipboard.writeText(item.content)}
                              className="text-xs px-3 py-1 rounded-lg transition-colors"
                              style={{
                                background: BRAND.bg,
                                color: BRAND.primary,
                                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* Empty state — no project selected */
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: BRAND.bg }}
              >
                <FolderOpen className="w-9 h-9" style={{ color: BRAND.primary }} />
              </div>
              <h3
                className="text-2xl font-bold mb-2 [font-family:var(--font-playfair,Georgia,serif)]"
                style={{ color: BRAND.deep }}
              >
                Your story starts here
              </h3>
              <p className="text-sm mb-6" style={{ color: BRAND.gray }}>
                Create a project or select one from the sidebar to view your research, outlines, and content.
              </p>
              {projects.length === 0 && (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Project name"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addProject() }}
                    className="flex-1 bg-white text-sm"
                    style={{
                      borderColor: "#DDD0EC",
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    }}
                  />
                  <Button
                    onClick={addProject}
                    disabled={isAddingProject || !newProjectTitle.trim()}
                    className="text-white text-sm px-4"
                    style={{
                      background: BRAND.primary,
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    {isAddingProject ? "Creating..." : "Create"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Reusable data card pill for the project detail view
function DataCard({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all duration-150 hover:shadow-sm text-left w-full"
      style={{
        background: isActive ? BRAND.bg : "#FFFFFF",
        borderColor: isActive ? BRAND.primary : "#EEE0F8",
        borderLeftWidth: isActive ? "3px" : "1px",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: BRAND.bg, color: BRAND.primary }}
      >
        {icon}
      </div>
      <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? BRAND.deep : "#333" }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: BRAND.gray }}>
        {count}
      </p>
    </button>
  )
}

export default MyProjects
