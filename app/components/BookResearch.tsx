"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Button as TremorButton } from "@tremor/react"
import React from "react"
import { Star, ChevronDown, TrendingUp, ShoppingCart, Filter, Brain, Lightbulb, ThumbsUp, ThumbsDown, BarChart3, BookOpen } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "../components/ui/label"
import Image from "next/image"
import googleTrends from 'google-trends-api'
import axios from 'axios'
import dynamic from 'next/dynamic'
import type { TrendData, AmazonBook } from "@/app/types/index"
import { useAuth } from "../context/AuthContext"
import { getUserProjects, saveUserSearch, addMarketResearchToProject, getKeywordInsights } from "../lib/firebase/services"
import type { Project } from "../types/firebase"
import { estimateMonthlySales, formatSales } from "../utils/bsrCalculations"

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
  shapes?: Array<{
    type: string;
    xref: string;
    yref: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    line: {
      color: string;
      width: number;
    };
    layer: string;
  }>;
}

// Add a new interface for Plot data
interface PlotData {
  x: any[];
  y: any[];
  type: string;
  mode?: string;
  name?: string;
  line?: {
    shape?: string;
    smoothing?: number;
    width?: number;
    color?: string;
  };
  hovertemplate?: string;
}

interface PlotlyConfig {
  displayModeBar?: boolean;
  responsive?: boolean;
  scrollZoom?: boolean;
}

// Dynamically import Plotly with no SSR
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div>Loading Plot...</div>
})

const wellKnownPublishers = [
  "Penguin Random House",
  "HarperCollins",
  "Simon & Schuster",
  "Hachette Book Group",
  "Macmillan Publishers",
  "Scholastic",
  "Wiley",
  "Pearson",
  "Oxford University Press",
  "Cambridge University Press",
  "Houghton Mifflin Harcourt",
]

interface BookCardProps {
  book: AmazonBook;
}

const BookCard: React.FC<BookCardProps> = ({ book }) => {
  console.log('Rendering BookCard with book:', book); // Debug log
  return (
    <Card className="p-4 mb-4 hover:shadow-lg transition-shadow hover:border-primary/50 hover:bg-primary/5">
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
            <div>
              <p className="text-sm">
                <span className="font-medium block text-primary">Est. Monthly Sales</span>
                <span className="text-primary font-semibold">{formatSales(estimateMonthlySales(book.bsr))}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const BookResearch = React.memo(() => {
  const { user } = useAuth()
  const [keyword, setKeyword] = useState("")
  const [data, setData] = useState<TrendData | null>(null)
  const [books, setBooks] = useState<AmazonBook[]>([])
  const [loading, setLoading] = useState(false)
  const [projectBooks, setProjectBooks] = useState<Project[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [showIndieOnly, setShowIndieOnly] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<string[]>([])
  const [insightsData, setInsightsData] = useState<{
    rating?: number;
    pros?: string[];
    cons?: string[];
    insights?: string[];
    title_suggestion?: string;
  }>({})

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
        
        setProjectBooks(userProjects);
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

  const fetchData = async (keyword: string, page: number = 1) => {
    try {
      setLoading(true)
      // Clear existing books when starting a new search
      if (page === 1) {
        setBooks([]);
        setInsights([]); // Clear existing insights
      }
      
      const response = await fetch(`/api/trends?keyword=${encodeURIComponent(keyword)}`)
      const trendData = await response.json()
      
      // Validate and structure trend data
      const validTrendData: TrendData = {
        webSearch: {
          timelineData: trendData?.webSearch?.timelineData?.map((point: any) => ({
            time: point.time,
            value: Array.isArray(point.value) ? point.value : [0]
          })) || []
        },
        youtube: {
          timelineData: trendData?.youtube?.timelineData?.map((point: any) => ({
            time: point.time,
            value: Array.isArray(point.value) ? point.value : [0]
          })) || []
        }
      };
      
      setData(validTrendData)
      
      // Log Amazon books API call
      const booksResponse = await fetch(`/api/amazon-books/search?keywords=${encodeURIComponent(keyword)}&page=${page}`)
      const booksData = await booksResponse.json()
      
      console.log('Raw books data:', booksData); // Debug log
      
      // The books data is already in the correct format, no need for complex mapping
      setBooks(booksData);
      setCurrentPage(page);

      // Trigger market insights after getting both trends and books data
      if (user?.uid) {
        // Save the search first with all required data
        const searchData = {
          userId: user.uid,
          keyword,
          books: booksData,
          trendData: validTrendData,
          timestamp: Date.now()
        };
        
        await saveUserSearch(user.uid, keyword, booksData, validTrendData);
        
        // Call insights API directly
        setInsightsLoading(true);
        try {
          const insightsResponse = await fetch('/api/insights', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchData),
          });

          if (!insightsResponse.ok) {
            throw new Error('Failed to get insights');
          }

          const insightsData = await insightsResponse.json();
          if (insightsData.insights) {
            setInsights(Array.isArray(insightsData.insights) ? insightsData.insights : [insightsData.insights]);
            setInsightsData(insightsData);
          }
        } catch (error) {
          console.error('Error getting insights:', error);
        } finally {
          setInsightsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error in fetchData:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeKeyword = async () => {
    if (!keyword.trim()) return
    await fetchData(keyword, 1)
  }

  const handleAddMarketResearchToProject = async (projectId: string) => {
    if (!user) {
      alert('Please sign in to add research to a project');
      return;
    }

    try {
      if (!books.length || !data) {
        alert('No research data available to add to project');
        return;
      }

      const researchData = {
        keyword,
        books,
        trendData: data,
        insights: insightsData,
        timestamp: Date.now(),
      };

      await addMarketResearchToProject(projectId, researchData);

      const project = projectBooks.find((p) => p.id === projectId);
      alert(`Market research added to project: ${project?.name}`);
    } catch (error) {
      console.error("Error adding market research to project:", error);
      alert('Failed to add market research to project. Please try again.');
    }
  };

  const isIndieAuthor = (book: AmazonBook) => {
    return !wellKnownPublishers.some(publisher => 
      book.publisher?.toLowerCase().includes(publisher.toLowerCase()) ||
      book.manufacturer?.toLowerCase().includes(publisher.toLowerCase())
    );
  }

  const getOverallBSR = (book: AmazonBook) => {
    return book.bsr;
  }

  const getEstimatedSales = (book: AmazonBook) => {
    const bsr = getOverallBSR(book);
    return formatSales(estimateMonthlySales(bsr));
  }

  const openAmazonPage = (book: AmazonBook) => {
    window.open(book.url, "_blank")
  }

  const filteredBooks = showIndieOnly 
    ? books.filter(book => isIndieAuthor(book))
    : books;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Book Market Research</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              Add to Project
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {projectBooks.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleAddMarketResearchToProject(project.id)}
              >
                {project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="bg-white shadow-md p-4 sm:p-6 border border-gray-200 mb-6">
        <div className="flex gap-4">
          <TextInput
            placeholder="Enter a topic or keyword for your book..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-grow tr-input"
            onKeyDown={(e) => e.key === 'Enter' && analyzeKeyword()}
          />
          <TremorButton
            onClick={analyzeKeyword}
            loading={loading}
            className="bg-primary text-white hover:bg-primary/90 px-8"
          >
            Analyze
          </TremorButton>
        </div>
      </Card>

      {data && (
        <>
          {/* Trends Graph - Full Width */}
          <Card className="bg-white shadow-md p-4 sm:p-6 border border-gray-200 hover:border-primary/20 transition-colors duration-200 mb-6">
            <div className="flex items-center mb-6">
              <TrendingUp className="w-6 h-6 text-primary mr-2" />
              <h2 className="text-lg font-semibold text-primary">Interest over time</h2>
            </div>
            <div className="w-full h-[500px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                (data.webSearch?.timelineData?.length > 0 || data.youtube?.timelineData?.length > 0) && (
                  <Plot
                    data={[
                      ...(data.webSearch?.timelineData?.length > 0 ? [{
                        x: data.webSearch.timelineData.map(point => 
                          new Date(parseInt(point.time) * 1000)
                        ),
                        y: data.webSearch.timelineData.map(point => point.value[0]),
                        type: "scatter",
                        mode: "lines",
                        name: "Web Search",
                        line: {
                          shape: "spline",
                          smoothing: 1.3,
                          width: 3,
                          color: '#2563eb'
                        }
                      }] as any : []),
                      ...(data.youtube?.timelineData?.length > 0 ? [{
                        x: data.youtube.timelineData.map(point => 
                          new Date(parseInt(point.time) * 1000)
                        ),
                        y: data.youtube.timelineData.map(point => point.value[0]),
                        type: "scatter",
                        mode: "lines",
                        name: "YouTube Search",
                        line: {
                          shape: "spline",
                          smoothing: 1.3,
                          width: 3,
                          color: '#dc2626'
                        }
                      }] as any : [])
                    ]}
                    layout={{
                      autosize: true,
                      height: 500,
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
                        borderwidth: 1,
                        traceorder: 'normal'
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
              )}
            </div>
          </Card>

          {/* Market Intelligence Section */}
          <Card className="bg-white shadow-md p-6 border border-gray-200 mb-6">
            <div className="flex items-center mb-6">
              <Brain className="w-6 h-6 text-primary mr-2" />
              <h2 className="text-xl font-semibold text-primary">Market Intelligence</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {/* First Row: Market Score and Key Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Market Score Section */}
                <div>
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 h-full">
                    <h3 className="text-lg font-semibold text-primary mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Market Score
                    </h3>
                    {insightsLoading ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-32 h-32 mb-4">
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                              className="text-gray-200"
                              strokeWidth="10"
                              stroke="currentColor"
                              fill="transparent"
                              r="40"
                              cx="50"
                              cy="50"
                            />
                            <circle
                              className="text-primary"
                              strokeWidth="10"
                              strokeDasharray={`${(insightsData?.rating || 0) * 251.2} 251.2`}
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="40"
                              cx="50"
                              cy="50"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold text-primary">
                              {insightsData?.rating || 0}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 text-center">
                          Market Opportunity Score
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Insights Section */}
                <div>
                  <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 h-full">
                    <h3 className="text-lg font-semibold text-primary mb-4 flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2" />
                      Key Insights
                    </h3>
                    {insightsLoading ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {insightsData?.insights?.map((insight: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                            <p className="text-sm text-gray-800">{insight}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Second Row: Pros and Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pros */}
                <div className="bg-green-50/50 rounded-xl p-6 border border-green-100">
                  <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center">
                    <ThumbsUp className="w-5 h-5 mr-2" />
                    Pros
                  </h3>
                  {insightsLoading ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insightsData?.pros?.map((pro: string, index: number) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                          <p className="text-sm text-green-800">{pro}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cons */}
                <div className="bg-red-50/50 rounded-xl p-6 border border-red-100">
                  <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center">
                    <ThumbsDown className="w-5 h-5 mr-2" />
                    Cons
                  </h3>
                  {insightsLoading ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insightsData?.cons?.map((con: string, index: number) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0"></div>
                          <p className="text-sm text-red-800">{con}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Title Suggestion Row */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Suggested Title
                </h3>
                {insightsLoading ? (
                  <div className="flex items-center justify-center h-[100px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <p className="text-lg text-gray-800 font-medium">
                    {insightsData?.title_suggestion || 'No title suggestion available'}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {filteredBooks.length > 0 && (
        <Card className="bg-white shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <ShoppingCart className="w-6 h-6 text-primary mr-2" />
                <h2 className="text-lg font-semibold text-primary">Competing Books</h2>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="indie-filter"
                  checked={showIndieOnly}
                  onCheckedChange={setShowIndieOnly}
                />
                <Label htmlFor="indie-filter">Indie Authors Only</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredBooks.map((book) => (
              <BookCard key={book.asin} book={book} />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
})

export default BookResearch

