"use client"

import { useState, useEffect, useRef } from "react"
import { TextInput, Button as TremorButton } from "@tremor/react"
import React from "react"
import {
  ChevronDown, Brain, Lightbulb, ThumbsUp, ThumbsDown, BarChart3, BookOpen,
  ShoppingCart, Search, Sparkles, Star, TrendingUp, Zap
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import Image from "next/image"
import dynamic from 'next/dynamic'
import type { TrendData, AmazonBook } from "@/types"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, saveUserSearch, addMarketResearchToProject } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import { estimateMonthlySales, formatSales } from "@/app/utils/bsrCalculations"

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
    tickfont?: { size?: number; color?: string };
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
    tickfont?: { size?: number; color?: string };
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
    font?: { size?: number; color?: string };
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
    line: { color: string; width: number };
    layer: string;
  }>;
}

type PlotTrace = {
  x: Date[];
  y: number[];
  type: "scatter";
  mode: "lines";
  name: string;
  line: { shape: string; smoothing: number; width: number; color: string };
  hovertemplate?: string;
};

type TrendTimelinePoint = { time: string; value: number[] };

type TrendApiResponse = {
  webSearch?: { timelineData?: TrendTimelinePoint[] };
  youtube?: { timelineData?: TrendTimelinePoint[] };
};

interface PlotlyConfig {
  displayModeBar?: boolean;
  responsive?: boolean;
  scrollZoom?: boolean;
}

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div>Loading Plot...</div>
})

const SELF_PUB_INDICATORS = [
  "independently published", "createspace", "kindle direct",
  "kdp", "ingramspark", "lulu press", "lulu.com", "bookbaby",
  "draft2digital", "blurb", "smashwords", "xlibris", "iuniverse",
  "authorhouse", "trafford", "westbow press", "archway publishing",
  "balboa press", "partridge publishing", "palibrio",
];

const TRADITIONAL_PUBLISHERS = [
  // Big 5 parent companies
  "penguin random house", "harpercollins", "simon & schuster", "simon and schuster",
  "hachette", "macmillan",
  // PRH imprints
  "penguin", "random house", "dutton", "berkley", "ace books", "viking",
  "crown", "ballantine", "del rey", "knopf", "doubleday", "anchor books",
  "bantam", "dial press", "pantheon", "vintage", "plume", "riverhead",
  "putnam", "avery", "portfolio", "sentinel", "pamela dorman",
  "razorbill", "puffin", "grosset", "philomel", "nancy paulsen",
  // HC imprints
  "avon", "william morrow", "harper perennial", "harper voyager",
  "harper business", "harperone", "harlequin", "mira books", "hanover square",
  "broadside", "ecco", "amistad", "harper wave",
  // S&S imprints
  "atria", "scribner", "gallery", "pocket books", "touchstone",
  "threshold", "howard books", "folger shakespeare", "adams media",
  "north star way", "scout press", "saga press",
  // Hachette imprints
  "little, brown", "little brown", "grand central", "forever",
  "twelve", "center street", "faithwords", "basic books", "publicaffairs",
  "perseus", "running press", "hachette go", "orbit", "yen press",
  // Macmillan imprints
  "st. martin", "st martin", "tor books", "tor publishing", "flatiron",
  "henry holt", "farrar straus", "farrar, straus", "picador",
  "celadon", "minotaur", "wednesday books",
  // Academic / specialty
  "wiley", "john wiley", "pearson", "oxford university press", "oup",
  "cambridge university press", "cup", "houghton mifflin", "mcgraw-hill",
  "mcgraw hill", "elsevier", "springer", "routledge", "taylor & francis",
  "sage publications", "bloomsbury", "norton", "w. w. norton",
  "scholastic", "disney", "chronicle books", "workman",
  "abrams", "national geographic", "dk publishing", "hay house",
  "kensington", "sourcebooks", "thomas nelson", "zondervan",
  "tyndale", "waterbrook", "multnomah", "baker books", "bethany house",
  "rodale", "ten speed press", "clarkson potter", "convergent",
  "image books", "harmony books",
];

function detectIndie(book: AmazonBook): boolean {
  const pub = (book.publisher || '').toLowerCase().trim();
  const mfr = (book.manufacturer || '').toLowerCase().trim();

  if (!pub && !mfr) return true;

  if (SELF_PUB_INDICATORS.some(ind => pub.includes(ind) || mfr.includes(ind))) return true;

  if (TRADITIONAL_PUBLISHERS.some(tp => pub.includes(tp) || mfr.includes(tp))) return false;

  return true;
}

type SearchPhase = 'idle' | 'searching' | 'trends' | 'analyzing' | 'done';

const PHASE_STEPS: { phase: SearchPhase; label: string; icon: React.ReactNode }[] = [
  { phase: 'searching', label: 'Searching Amazon', icon: <Search className="w-4 h-4" /> },
  { phase: 'trends', label: 'Fetching Trends', icon: <TrendingUp className="w-4 h-4" /> },
  { phase: 'analyzing', label: 'Generating AI insights', icon: <Sparkles className="w-4 h-4" /> },
  { phase: 'done', label: 'Complete', icon: <Zap className="w-4 h-4" /> },
];

function ProgressStepper({ currentPhase }: { currentPhase: SearchPhase }) {
  if (currentPhase === 'idle' || currentPhase === 'done') return null;

  const currentIdx = PHASE_STEPS.findIndex(s => s.phase === currentPhase);

  return (
    <div className="bg-white border border-purple-100 rounded-2xl shadow-sm p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between">
        {PHASE_STEPS.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isComplete = idx < currentIdx;
          return (
            <React.Fragment key={step.phase}>
              <div className="flex items-center gap-2.5">
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500
                  ${isComplete ? 'bg-purple-600 text-white scale-100' : ''}
                  ${isActive ? 'bg-purple-600 text-white scale-110 ring-4 ring-purple-100' : ''}
                  ${!isComplete && !isActive ? 'bg-gray-100 text-gray-400' : ''}
                `}>
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${isActive ? 'text-purple-700' : isComplete ? 'text-purple-600' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
              {idx < PHASE_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded transition-colors duration-500 ${idx < currentIdx ? 'bg-purple-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className ?? ''}`} />;
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPulse className="h-4 w-3/4" />
      <SkeletonPulse className="h-4 w-full" />
      <SkeletonPulse className="h-4 w-5/6" />
      <SkeletonPulse className="h-4 w-2/3" />
    </div>
  );
}

interface BookCardProps { book: AmazonBook; index: number }

const BookCard: React.FC<BookCardProps> = ({ book, index }) => {
  const monthlySales = estimateMonthlySales(book.bsr);
  const isIndie = detectIndie(book);

  return (
    <div
      className="group relative bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={() => window.open(book.url, '_blank')}
    >
      <div className="flex">
        {/* Cover */}
        <div className="relative w-24 sm:w-28 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100">
          <Image
            src={book.image_url}
            alt={book.title}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="112px"
          />
          <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {index + 1}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 p-3.5 min-w-0">
          {/* Title + Badges */}
          <div className="flex items-start gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-purple-700 transition-colors flex-1">
              {book.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isIndie && <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">INDIE</span>}
              {book.is_prime && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PRIME</span>}
            </div>
          </div>

          {/* Publisher */}
          <p className="text-xs text-gray-500 mb-3">{book.publisher || book.manufacturer || 'Unknown Publisher'}</p>

          {/* Key Metrics */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Price</p>
              <p className="text-sm font-semibold text-gray-800">${book.price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Est. Sales</p>
              <p className="text-sm font-semibold text-purple-700">{formatSales(monthlySales)}<span className="text-gray-400 font-normal">/mo</span></p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">BSR</p>
              <p className="text-sm font-semibold text-gray-800">{book.bsr ? `#${book.bsr.toLocaleString()}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Rating</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {book.rating || 'N/A'}
                <span className="text-gray-400 font-normal text-xs">({(book.reviews_count ?? 0).toLocaleString()})</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Published</p>
              <p className="text-sm font-semibold text-gray-800">{book.publication_date || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BookResearch = React.memo(() => {
  const { user } = useAuth()
  const [keyword, setKeyword] = useState("")
  const [data, setData] = useState<TrendData | null>(null)
  const [books, setBooks] = useState<AmazonBook[]>([])
  const [loading, setLoading] = useState(false)
  const [projectBooks, setProjectBooks] = useState<Project[]>([])
  const [showIndieOnly, setShowIndieOnly] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [searchPhase, setSearchPhase] = useState<SearchPhase>('idle')
  const [insightsData, setInsightsData] = useState<{
    rating?: number;
    pros?: string[];
    cons?: string[];
    insights?: string[];
    title_suggestion?: string;
  }>({})
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const exampleKeywords = [
    "habit change for busy professionals",
    "meal prep for beginners",
    "personal finance for millennials",
    "home organization for small spaces",
    "mindfulness for anxiety"
  ]

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return
      try {
        if (!user.uid) throw new Error('User ID is undefined')
        const userProjects = await getUserProjects(user.uid)
        if (!Array.isArray(userProjects)) throw new Error('Fetched projects is not an array')
        setProjectBooks(userProjects)
      } catch (error) {
        console.error("Error fetching projects:", error)
      }
    }
    fetchProjects()
  }, [user])

  const fetchData = async (keyword: string, page: number = 1) => {
    try {
      setLoading(true)
      setInsightsLoading(true)
      setSearchPhase('searching')
      if (page === 1) {
        setBooks([])
        setInsightsData({})
        setData(null)
      }

      const booksResponse = await fetch(
        `/api/amazon-books/search?keywords=${encodeURIComponent(keyword)}&page=${page}`
      )
      const booksData = await booksResponse.json()
      setBooks(booksData)
      setLoading(false)

      setSearchPhase('trends')

      let trendResult: TrendData = { webSearch: { timelineData: [] }, youtube: { timelineData: [] } }
      try {
        const trendsResponse = await fetch(`/api/trends?keyword=${encodeURIComponent(keyword)}`)
        if (trendsResponse.ok) {
          const trendsJson = await trendsResponse.json()
          trendResult = {
            webSearch: trendsJson.webSearch ?? { timelineData: [] },
            youtube: trendsJson.youtube ?? { timelineData: [] },
          }
        }
      } catch (trendErr) {
        console.error('Trends fetch failed, continuing without trends:', trendErr)
      }
      setData(trendResult)

      setSearchPhase('analyzing')

      const insightsResponse = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anonymous',
          keyword,
          books: Array.isArray(booksData) ? booksData : [],
          trendData: trendResult,
          timestamp: Date.now()
        }),
      })

      if (insightsResponse.ok) {
        const insightsResult = await insightsResponse.json()
        if (insightsResult.insights) {
          setInsightsData(insightsResult)
          if (user?.uid) {
            await saveUserSearch(user.uid, keyword, booksData, trendResult, insightsResult)
          }
        }
      } else {
        console.error('Failed to get insights')
      }
    } catch (error) {
      console.error('Error in fetchData:', error)
    } finally {
      setLoading(false)
      setInsightsLoading(false)
      setSearchPhase('done')
      setTimeout(() => setSearchPhase('idle'), 1500)
    }
  }

  const analyzeKeyword = async () => {
    if (!keyword.trim()) return
    await fetchData(keyword, 1)
  }

  useEffect(() => {
    if (!loading && data && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [loading, data])

  const handleAddMarketResearchToProject = async (projectId: string) => {
    if (!user) { alert('Please sign in to add research to a project'); return }
    try {
      if (!books.length || !data) { alert('No research data available to add to project'); return }
      const project = projectBooks.find((p) => p.id === projectId)
      if (!project) throw new Error('Project not found')
      const hasExistingResearch = project.research && project.research.length > 0
      if (hasExistingResearch) {
        const confirmReplace = window.confirm(`This project already has market research data. Adding new research will replace the existing data. Do you want to continue?`)
        if (!confirmReplace) return
      }
      const researchData = {
        keyword,
        books,
        trendData: data,
        marketIntelligence: {
          rating: insightsData.rating || 0,
          insights: insightsData.insights || [],
          pros: insightsData.pros || [],
          cons: insightsData.cons || [],
          title_suggestion: insightsData.title_suggestion || '',
        },
        timestamp: Date.now(),
      }
      await addMarketResearchToProject(projectId, researchData)
      alert(`Market research for "${keyword}" has been ${hasExistingResearch ? 'updated' : 'added'} to project: ${project.name}`)
    } catch (error) {
      console.error("Error in handleAddMarketResearchToProject:", error)
      const errorMessage = error instanceof Error
        ? `Failed to add market research: ${error.message}`
        : 'Failed to add market research to project. Please try again.'
      alert(errorMessage)
    }
  }

  const filteredBooks = showIndieOnly
    ? books.filter(book => detectIndie(book))
    : books

  const hasInsights = !!(insightsData.insights?.length || insightsData.rating);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Book Market Research</h1>
          <p className="text-sm text-gray-500 mt-1">
            Discover demand trends and top-performing titles in your niche.
          </p>
        </div>
        {books.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50">
                Add to Project
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {projectBooks.map((project) => (
                <DropdownMenuItem key={project.id} onClick={() => handleAddMarketResearchToProject(project.id)}>
                  {project.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <TextInput
                placeholder="Enter a keyword (e.g. 'meal prep for beginners')"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9 tr-input"
                onKeyDown={(e) => e.key === 'Enter' && analyzeKeyword()}
              />
            </div>
            <TremorButton
              onClick={analyzeKeyword}
              loading={loading}
              className="bg-purple-600 text-white hover:bg-purple-700 px-8 rounded-lg"
            >
              Analyze Market
            </TremorButton>
          </div>

          {/* Example keywords */}
          {!data && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 mt-1">Try:</span>
              {exampleKeywords.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setKeyword(ex); }}
                  className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <ProgressStepper currentPhase={searchPhase} />

      <div ref={resultsRef} />

      {/* Books loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 flex overflow-hidden">
              <SkeletonPulse className="w-28 h-36 flex-shrink-0" />
              <div className="flex-1 p-3.5 space-y-3">
                <SkeletonPulse className="h-4 w-4/5" />
                <SkeletonPulse className="h-3 w-1/3" />
                <div className="flex gap-4 pt-1">
                  <SkeletonPulse className="h-8 w-14" />
                  <SkeletonPulse className="h-8 w-14" />
                  <SkeletonPulse className="h-8 w-14" />
                  <SkeletonPulse className="h-8 w-14 hidden sm:block" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trend Charts Section */}
      {data && (data.webSearch.timelineData.length > 0 || data.youtube.timelineData.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Search Trends</h2>
              <p className="text-xs text-gray-500">Google & YouTube interest over the past 6 months</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.webSearch.timelineData.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" />
                  Google Web Search
                </h3>
                <Plot
                  data={[{
                    x: data.webSearch.timelineData.map(p => new Date(parseInt(p.time) * 1000)),
                    y: data.webSearch.timelineData.map(p => p.value[0]),
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: 'Web Search',
                    line: { shape: 'spline', smoothing: 1.3, width: 2.5, color: '#7c3aed' },
                    hovertemplate: '%{x|%b %d}: <b>%{y}</b><extra></extra>',
                  } as PlotTrace]}
                  layout={{
                    height: 200,
                    margin: { t: 10, r: 20, b: 40, l: 40 },
                    xaxis: { showgrid: false, tickformat: '%b %d', tickfont: { size: 10, color: '#9ca3af' }, automargin: true },
                    yaxis: { showgrid: true, gridcolor: '#f3f4f6', tickfont: { size: 10, color: '#9ca3af' }, rangemode: 'tozero', automargin: true },
                    plot_bgcolor: 'transparent',
                    paper_bgcolor: 'transparent',
                    hovermode: 'x unified',
                    autosize: true,
                    showlegend: false,
                  } as PlotlyLayout}
                  config={{ displayModeBar: false, responsive: true } as PlotlyConfig}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {data.youtube.timelineData.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
                  YouTube Search
                </h3>
                <Plot
                  data={[{
                    x: data.youtube.timelineData.map(p => new Date(parseInt(p.time) * 1000)),
                    y: data.youtube.timelineData.map(p => p.value[0]),
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: 'YouTube',
                    line: { shape: 'spline', smoothing: 1.3, width: 2.5, color: '#ef4444' },
                    hovertemplate: '%{x|%b %d}: <b>%{y}</b><extra></extra>',
                  } as PlotTrace]}
                  layout={{
                    height: 200,
                    margin: { t: 10, r: 20, b: 40, l: 40 },
                    xaxis: { showgrid: false, tickformat: '%b %d', tickfont: { size: 10, color: '#9ca3af' }, automargin: true },
                    yaxis: { showgrid: true, gridcolor: '#f3f4f6', tickfont: { size: 10, color: '#9ca3af' }, rangemode: 'tozero', automargin: true },
                    plot_bgcolor: 'transparent',
                    paper_bgcolor: 'transparent',
                    hovermode: 'x unified',
                    autosize: true,
                    showlegend: false,
                  } as PlotlyLayout}
                  config={{ displayModeBar: false, responsive: true } as PlotlyConfig}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Intelligence Section */}
      {data && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Market Intelligence</h2>
              <p className="text-xs text-gray-500">AI-powered analysis of the competitive landscape</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {/* Score + Insights */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              {/* Score */}
              <div className="md:col-span-2 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 flex flex-col items-center justify-center">
                <h3 className="text-sm font-semibold text-purple-600 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Market Score
                </h3>
                {insightsLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <SkeletonPulse className="w-28 h-28 rounded-full" />
                    <SkeletonPulse className="w-24 h-3" />
                  </div>
                ) : (
                  <>
                    <div className="relative w-28 h-28 mb-3">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle strokeWidth="8" stroke="#e9d5ff" fill="transparent" r="42" cx="50" cy="50" />
                        <circle
                          strokeWidth="8"
                          strokeDasharray={`${((insightsData?.rating || 0) / 10) * 264} 264`}
                          strokeLinecap="round"
                          stroke="#9333ea"
                          fill="transparent"
                          r="42"
                          cx="50"
                          cy="50"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-black text-purple-700">
                          {insightsData?.rating || 0}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-500 font-medium">out of 10</p>
                  </>
                )}
              </div>

              {/* Key Insights */}
              <div className="md:col-span-3 bg-gray-50 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Key Insights
                </h3>
                {insightsLoading ? <InsightsSkeleton /> : (
                  <div className="space-y-3">
                    {insightsData?.insights?.map((insight, index) => (
                      <div key={index} className="flex items-start gap-3 group">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pros and Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-emerald-50/60 rounded-2xl p-6 border border-emerald-100">
                <h3 className="text-sm font-semibold text-emerald-700 mb-4 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  Opportunities
                </h3>
                {insightsLoading ? <InsightsSkeleton /> : (
                  <div className="space-y-3">
                    {insightsData?.pros?.map((pro, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-emerald-800">{pro}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-rose-50/60 rounded-2xl p-6 border border-rose-100">
                <h3 className="text-sm font-semibold text-rose-700 mb-4 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4" />
                  Challenges
                </h3>
                {insightsLoading ? <InsightsSkeleton /> : (
                  <div className="space-y-3">
                    {insightsData?.cons?.map((con, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                          </svg>
                        </div>
                        <p className="text-sm text-rose-800">{con}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Title */}
            {(insightsLoading || insightsData?.title_suggestion) && (
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-purple-100">
                <h3 className="text-sm font-semibold text-purple-600 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Suggested Title
                </h3>
                {insightsLoading ? (
                  <SkeletonPulse className="h-6 w-2/3" />
                ) : (
                  <p className="text-xl font-semibold text-gray-900 italic">
                    &ldquo;{insightsData?.title_suggestion}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competing Books */}
      {filteredBooks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Competing Books</h2>
                  <p className="text-xs text-gray-500">{filteredBooks.length} titles found</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <Switch id="indie-filter" checked={showIndieOnly} onCheckedChange={setShowIndieOnly} />
                <Label htmlFor="indie-filter" className="text-sm">Indie Only</Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredBooks.map((book, idx) => (
              <BookCard key={book.asin} book={book} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

BookResearch.displayName = "BookResearch"

export default BookResearch
