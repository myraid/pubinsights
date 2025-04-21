"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Button as TremorButton } from "@tremor/react"
import React from "react"
import { Star, ChevronDown, TrendingUp, ShoppingCart, Filter } from "lucide-react"
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
import { getUserProjects, saveUserSearch, addBooksToProject, getKeywordInsights } from "../lib/firebase/services"
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
  const [insights, setInsights] = useState<string[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null)

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

  // Function to check for insights
  const checkForInsights = async (userId: string, searchKeyword: string) => {
    try {
      const insightsData = await getKeywordInsights(userId, searchKeyword);
      
      if (insightsData?.insights) {
        const insightsArray = Array.isArray(insightsData.insights) 
          ? insightsData.insights 
          : [insightsData.insights];
        setInsights(insightsArray);
        return true; // Insights found
      }
      return false; // No insights yet
    } catch (error) {
      console.error('Error checking insights:', error);
      return false;
    }
  };

  // Start polling for insights
  const startPollingForInsights = (userId: string, searchKeyword: string) => {
    setInsightsLoading(true);
    let attempts = 0;
    const maxAttempts = 10; // Maximum 10 attempts (50 seconds)
    
    const poll = async () => {
      attempts++;
      const hasInsights = await checkForInsights(userId, searchKeyword);
      
      if (hasInsights) {
        setInsightsLoading(false);
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }
      } else if (attempts < maxAttempts) {
        // Continue polling every 5 seconds
        const timeout = setTimeout(() => poll(), 5000);
        setPollingTimeout(timeout);
      } else {
        // Stop polling after max attempts
        setInsightsLoading(false);
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }
      }
    };

    poll();
  };

  // Cleanup polling on unmount or when keyword changes
  useEffect(() => {
    return () => {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
    };
  }, [pollingTimeout]);

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
      
      // If it's page 1, fetch page 2 as well for complete data
      let combinedBooksData = booksData;
      if (page === 1) {
        const page2Response = await fetch(`/api/amazon-books/search?keywords=${encodeURIComponent(keyword)}&page=2`)
        const page2Data = await page2Response.json()
        combinedBooksData = {
          SearchResult: {
            Items: [...(booksData.SearchResult?.Items || []), ...(page2Data.SearchResult?.Items || [])]
          }
        }
      }
      
      // Process the response to extract required information
      const processedBooks = combinedBooksData.SearchResult?.Items?.map((item: any) => {
        const publicationYear = item.ItemInfo.ContentInfo?.PublicationDate?.DisplayValue?.split('T')[0] || "unknown";

        const publisher = item.ItemInfo.ByLineInfo.Manufacturer?.DisplayValue || 'Unknown Publisher';
        const isIndie = publisher.toLowerCase().includes("independently published") ||
                       publisher.toLowerCase().includes("self-published") ||
                       publisher.toLowerCase().includes("self-published") ||
                       publisher.toLowerCase().includes("unknown publisher");
        // Get the first listing's merchant info
        const firstListing = item.Offers?.Listings?.[0];
        const merchantInfo = firstListing?.MerchantInfo;
        
        // Get the first contributor as author
        const author = item.ItemInfo.ByLineInfo.Contributors?.[0]?.Name || 'Unknown Author';
        
        // Get the first price amount
        const price = firstListing?.Price?.Amount || 0;
        
        // Get the first image URL
        const image = item.Images?.Primary?.Large?.URL || '/images/cover.jpg';
        
        // Get BSR data
        const bsr = item.BrowseNodeInfo.WebsiteSalesRank?.SalesRank ? [{
          rank: item.BrowseNodeInfo.WebsiteSalesRank.SalesRank,
          category: item.BrowseNodeInfo.BrowseNodes[0]?.ContextFreeName || 'General'
        }] : [];
        
        // Get categories
        const categories = item.BrowseNodeInfo.BrowseNodes.map((node: any) => node.DisplayName) || [];
        
        // Get rating and review count from the first listing's merchant info
        console.log('merchantInfo : ', merchantInfo);
        const rating = merchantInfo?.FeedbackRating || 0;
        const reviewCount = merchantInfo?.FeedbackCount || 0;

        return {
          id: item.ASIN,
          title: item.ItemInfo.Title.DisplayValue,
          author,
          price,
          image,
          bsr,
          categories,
          rating,
          reviewCount,
          publisher,
          publicationYear,
          isIndie
        }
      }) || []

      if (page === 1) {
        setBooks(processedBooks);
        // Save search results to history
        if (user?.uid) {
          try {
            console.log('Saving search to history:', {
              keyword,
              booksCount: processedBooks.length,
              trendDataExists: !!validTrendData
            });

            await saveUserSearch(user.uid, keyword, processedBooks, validTrendData);
            // Start polling for insights after saving the search
            startPollingForInsights(user.uid, keyword);
          } catch (error) {
            console.error("Error saving search:", error);
          }
        }
      } else {
        setBooks(prev => [...prev, ...processedBooks]);
      }

      setCurrentPage(page);
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

  const handleAddBooksToProject = async (projectId: string) => {
    if (!user) {
      alert('Please sign in to add research to a project');
      return;
    }

    try {
      if (!books.length) {
        alert('No books available to add to project');
        return;
      }

      await addBooksToProject(projectId, keyword, books);
      
      const project = projectBooks.find((p) => p.id === projectId);
      alert(`Books added to project: ${project?.name}`);
    } catch (error) {
      console.error("Error adding books to project:", error);
      alert('Failed to add books to project. Please try again.');
    }
  };

  const isIndieAuthor = (book: AmazonBook) => {
    return book.isIndie;
  }

  const getOverallBSR = (book: AmazonBook) => {
    return Math.min(...book.bsr.map((rank) => rank.rank))
  }

  const getEstimatedSales = (book: AmazonBook) => {
    const bsr = getOverallBSR(book);
    return formatSales(estimateMonthlySales(bsr));
  }

  const openAmazonPage = (book: AmazonBook) => {
    window.open(`https://www.amazon.com/dp/${book.id}`, "_blank")
  }

  const filteredBooks = showIndieOnly 
    ? books.filter(book => isIndieAuthor(book))
    : books;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Book Market Research</h1>
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
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <Card className="bg-white shadow-md p-4 sm:p-6 border border-gray-200 hover:border-primary/20 transition-colors duration-200 h-full">
              <div className="flex items-center mb-6">
                <TrendingUp className="w-6 h-6 text-primary mr-2" />
                <h2 className="text-lg font-semibold text-primary">Interest over time</h2>
              </div>
              <div className="flex flex-col h-[calc(100%-3rem)]">
                <div className="w-full flex-grow">
                  {loading ? (
                    <div className="flex items-center justify-center h-full min-h-[500px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    (data.webSearch?.timelineData?.length > 0 || data.youtube?.timelineData?.length > 0) && (
                      <div className="w-full h-full min-h-[500px] relative">
                        <div className="absolute inset-0">
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
                                y: -0.35,
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
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card className="bg-white shadow-md p-4 sm:p-6 border border-gray-200 hover:border-primary/20 transition-colors duration-200 h-full">
              <div className="flex items-center mb-6">
                <Filter className="w-6 h-6 text-primary mr-2" />
                <h2 className="text-lg font-semibold text-primary">Market Insights</h2>
              </div>
              
              <div className="space-y-4">
                {insightsLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-gray-500">Generating market insights...</span>
                  </div>
                ) : insights.length > 0 ? (
                  <div className="space-y-3">
                    {insights.map((insight, index) => (
                      <div 
                        key={index}
                        className="p-4 bg-primary/5 rounded-lg border border-primary/10"
                      >
                        {insight}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    {keyword 
                      ? "AI is analyzing the market data. Insights will appear here automatically."
                      : "Enter a keyword and click Analyze to get started"}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
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
                    onClick={() => handleAddBooksToProject(project.id)}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-4">
            {filteredBooks.map((book) => (
              <div key={book.id} className="flex gap-4 p-4 border border-gray-100 rounded-lg hover:bg-primary/5 hover:border-primary/20 transition-colors duration-200">
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
                    <h3 
                      className="font-semibold text-lg text-black hover:text-primary cursor-pointer"
                      onClick={() => openAmazonPage(book)}
                    >
                      {book.title}
                    </h3>
                    {isIndieAuthor(book) && (
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
                      <span className="text-xs text-gray-500">Est. Monthly Sales</span>
                      <span>{getEstimatedSales(book)} copies</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">BSR</span>
                      <span>#{getOverallBSR(book).toLocaleString()}</span>
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
                    {book.categories.slice(0, 3).map((category, idx) => (
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
        </Card>
      )}
    </div>
  )
})

export default BookResearch

