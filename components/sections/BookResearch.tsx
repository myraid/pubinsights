"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import React from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import {
  ChevronDown, Brain, BarChart3,
  BookOpen, ShoppingCart, Search, Star, TrendingUp, ExternalLink,
  Loader2, FolderPlus
} from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { TrendData, AmazonBook } from "@/types"
import { useAuth } from "@/app/context/AuthContext"
import { getUserProjects, saveUserSearch, addMarketResearchToProject } from "@/app/lib/firebase/services"
import type { Project } from "@/app/types/firebase"
import { estimateMonthlySales, formatSales } from "@/app/utils/bsrCalculations"

// ─── Plotly (dynamic — SSR disabled) ─────────────────────────────────────────

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-slate-100" />,
})

// ─── Indie detection ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
}

// Well-known major traditional publishers — if publisher matches one of these, it is NOT indie
const MAJOR_PUBLISHERS = [
  "penguin", "random house", "harpercollins", "harper collins", "simon schuster",
  "simon & schuster", "hachette", "macmillan", "scholastic", "wiley", "john wiley",
  "oxford university press", "cambridge university press", "norton", "w w norton",
  "workman", "chronicle books", "rodale", "hay house", "new world library",
  "sounds true", "berrett-koehler", "skyhorse", "sourcebooks", "kensington",
  "st martins", "st. martins", "thomas nelson", "zondervan", "tyndale",
  "baker publishing", "intervarsity", "moody publishers", "navpress",
]

function isMajorPublisher(pub: string): boolean {
  const n = normalize(pub)
  return MAJOR_PUBLISHERS.some(p => n.includes(p))
}

function detectIndie(book: AmazonBook): boolean {
  const pub    = normalize(book.publisher   || "")
  const author = normalize(book.manufacturer || "") // Amazon stores author in manufacturer

  // Signal 1: explicitly indie
  if (pub.includes("independently published")) return true

  // Signal 2: no publisher listed — unknown publisher strongly suggests self-published
  if (!pub || pub === "unknown" || pub === "n/a" || pub === "") return true

  // Signal 3: major traditional publisher — definitely NOT indie
  if (isMajorPublisher(pub)) return false

  // Signal 4: author name and publisher name match or one contains the other
  if (author && (pub === author || pub.includes(author) || author.includes(pub))) return true

  // Signal 5: publisher name contains the author's last name or a word from their name
  const authorWords = author.split(/\s+/).filter(w => w.length > 3)
  if (authorWords.some(w => pub.includes(w))) return true

  // Signal 6: publisher name contains common self-pub patterns
  if (/\b(self[- ]pub|self pub|indie|imprint|studios?|creations?|media group|publishing group)\b/.test(pub)) return true

  return false
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchPhase = "idle" | "searching" | "analyzing" | "done"

interface InsightsData {
  rating?: number
  insights?: string[]
  pros?: string[]
  cons?: string[]
  verdict?: "Explore" | "Proceed with Caution" | "Avoid"
  verdict_reason?: string
  keyword_suggestions?: string[]
  title_suggestion?: string
  subtitle_suggestion?: string
}

const PHASES: { phase: SearchPhase; label: string }[] = [
  { phase: "searching", label: "Fetching Data" },
  { phase: "analyzing", label: "Analyzing Market" },
  { phase: "done",      label: "Complete" },
]

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score >= 8) return "Strong Opportunity"
  if (score >= 6) return "Moderate Opportunity"
  return "Highly Competitive"
}

function scoreColor(score: number): string {
  if (score >= 8) return "#059669" // emerald-600
  if (score >= 6) return "#d97706" // amber-600
  return "#e11d48"                  // rose-600
}

function scoreBg(score: number): string {
  if (score >= 8) return "#ecfdf5"
  if (score >= 6) return "#fffbeb"
  return "#fff1f2"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-100 ${className ?? ""}`} />
  )
}

function PhaseBar({ phase }: { phase: SearchPhase }) {
  if (phase === "idle") return null
  const idx      = PHASES.findIndex(p => p.phase === phase)
  const progress = phase === "done" ? 100 : Math.round((idx / (PHASES.length - 1)) * 100)

  return (
    <div className="mb-6 rounded-xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {phase === "done" ? "Analysis complete" : PHASES.find(p => p.phase === phase)?.label}
        </span>
        <span className="text-xs font-bold" style={{ color: BRAND.primary }}>{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: BRAND.bg }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%`, background: BRAND.primary }}
        />
      </div>
      <div className="mt-3 flex justify-between">
        {PHASES.filter(p => p.phase !== "idle").map((p, i) => {
          const done = i < idx
          const active = p.phase === phase
          return (
            <span
              key={p.phase}
              className="text-[10px] font-medium transition-colors"
              style={{ color: done ? BRAND.primary : active ? "#0f172a" : "#cbd5e1" }}
            >
              {p.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MarketScore({ score, loading }: { score: number; loading: boolean }) {
  const color = scoreColor(score)
  const bg   = scoreBg(score)
  const label = scoreLabel(score)
  const circumference = 2 * Math.PI * 32

  return (
    <div
      className="flex h-full flex-col items-center justify-center rounded-2xl p-6"
      style={{ background: bg }}
    >
      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em]"
         style={{ color }}>
        <BarChart3 className="h-3 w-3" />
        Market Score
      </p>
      {loading ? (
        <>
          <Skeleton className="mb-3 h-20 w-20 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </>
      ) : (
        <>
          <div className="relative mb-3 h-20 w-20">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="32" fill="none"
                stroke={color} strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (score / 10) * circumference}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black leading-none" style={{ color }}>
                {score.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">/ 10</span>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold"
            style={{ background: color + "18", color }}
          >
            {label}
          </span>
        </>
      )}
    </div>
  )
}

interface TrendChartProps {
  title: string
  data: Array<{ time: string; value: number[] }>
  color: string
  icon: React.ReactNode
}

function TrendChart({ title, data, color, icon }: TrendChartProps) {
  if (!data.length) return null
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon} {title}
      </p>
      <Plot
        data={[{
          x: data.map(p => new Date(parseInt(p.time) * 1000)),
          y: data.map(p => p.value[0]),
          type: "scatter" as const,
          mode: "lines" as const,
          line: { shape: "spline", smoothing: 1.3, width: 2.5, color },
          hovertemplate: "%{x|%b %d}: <b>%{y}</b><extra></extra>",
        }]}
        layout={{
          height: 160,
          margin: { t: 4, r: 12, b: 32, l: 32 },
          xaxis: {
            showgrid: false,
            tickformat: "%b",
            tickfont: { size: 10, color: "#94a3b8" },
            automargin: true,
          },
          yaxis: {
            showgrid: true,
            gridcolor: "#f1f5f9",
            zeroline: false,
            tickfont: { size: 10, color: "#94a3b8" },
            rangemode: "tozero",
            automargin: true,
          },
          plot_bgcolor: "transparent",
          paper_bgcolor: "transparent",
          hovermode: "x unified",
          autosize: true,
          showlegend: false,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  )
}

interface BookCardProps {
  book: AmazonBook
}

// Brand palette constants
const BRAND = {
  deep:    "#8400B8",
  primary: "#9900CC",
  bg:      "#F5EEFF",
  gray:    "#6E6E6E",
  accent:  "#AA00DD",
} as const

function salesTier(bsr: number, monthly: number): { color: string; bg: string; label: string } {
  if (!bsr || bsr > 100000) return { color: "#AA00DD", bg: "#fdf4ff", label: "Low Signal" }
  if (monthly >= 300)        return { color: "#8400B8", bg: "#f3e8ff", label: "Hot"        }
  if (monthly >= 90)         return { color: "#9900CC", bg: "#f5eeff", label: "Active"     }
  return                            { color: "#AA00DD", bg: "#fdf4ff", label: "Slow"       }
}

function BookCard({ book }: BookCardProps) {
  const monthlySales = estimateMonthlySales(book.bsr)
  const isIndie      = detectIndie(book)
  const tier         = salesTier(book.bsr, monthlySales)
  const salesDisplay = formatSales(monthlySales, book.bsr)

  const authorLine = [
    book.manufacturer,
    book.publisher && book.publisher !== book.manufacturer ? book.publisher : null,
  ].filter(Boolean).join(" · ")

  return (
    <div
      className="group flex cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-px"
      style={{ borderLeft: `3px solid ${tier.color}` }}
      onClick={() => window.open(book.url, "_blank", "noopener,noreferrer")}
    >
      {/* Cover */}
      <div className="relative w-[80px] flex-shrink-0 bg-slate-50">
        <Image
          src={book.image_url}
          alt={book.title}
          fill
          className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          sizes="80px"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 flex flex-col justify-between p-3 pr-2">

        {/* Title + badges */}
        <div className="mb-1.5">
          <div className="flex items-start gap-1.5 mb-1">
            <h3 className="[font-family:var(--font-playfair,Georgia,serif)] line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900 group-hover:text-purple-700 transition-colors">
              {book.title}
            </h3>
            <div className="flex flex-shrink-0 items-center gap-1 mt-0.5">
              {isIndie && (
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white"
                  style={{ background: tier.color }}
                >
                  Indie
                </span>
              )}
              <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
          {authorLine && (
            <p className="text-[11px] text-slate-400 truncate leading-none">{authorLine}</p>
          )}
        </div>

        {/* Secondary metrics */}
        <div className="flex items-center gap-4 mt-auto flex-wrap">
          <Metric label="Price"  value={`$${book.price.toFixed(2)}`} />
          <span className="text-slate-200 select-none">|</span>
          <Metric label="BSR"    value={book.bsr ? `#${book.bsr.toLocaleString()}` : "—"} />
          <span className="text-slate-200 select-none">|</span>
          <Metric
            label="Rating"
            value={
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {book.rating || "—"}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                  ({(book.reviews_count ?? 0).toLocaleString()})
                </span>
              </span>
            }
          />
          <span className="text-slate-200 select-none">|</span>
          <Metric
            label="Year"
            value={
              book.publication_date
                ? new Date(book.publication_date).getFullYear().toString()
                : "—"
            }
          />
          {book.is_prime && (
            <>
              <span className="text-slate-200 select-none">|</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
                Prime
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sales panel — full-height right column */}
      <div
        className="flex-shrink-0 w-[72px] flex flex-col items-center justify-center gap-0.5 border-l"
        style={{ background: tier.bg, borderColor: tier.color + "30" }}
      >
        <TrendingUp className="h-3.5 w-3.5 mb-0.5" style={{ color: tier.color + "99" }} />
        <span
          className="text-[22px] font-black leading-none tabular-nums"
          style={{ color: tier.color }}
        >
          {salesDisplay}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-1 leading-none text-center px-1">
          {tier.label} · /mo
        </span>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
  )
}

function MarketStatsBar({ books }: { books: AmazonBook[] }) {
  if (!books.length) return null

  const avgPrice = books.reduce((a, b) => a + b.price, 0) / books.length
  const avgRating = books.filter(b => b.rating).reduce((a, b) => a + b.rating, 0) / books.filter(b => b.rating).length
  const indieCount = books.filter(detectIndie).length
  const indiePercent = Math.round((indieCount / books.length) * 100)
  const totalRevEstimate = books.reduce((a, b) => {
    const sales = estimateMonthlySales(b.bsr)
    return a + sales * b.price
  }, 0)

  const stats = [
    { label: "Books Found",   value: books.length.toString() },
    { label: "Avg. Price",    value: `$${avgPrice.toFixed(2)}` },
    { label: "Avg. Rating",   value: avgRating ? avgRating.toFixed(1) : "—" },
    { label: "Indie Share",   value: `${indiePercent}%` },
    { label: "Est. Market/mo", value: totalRevEstimate >= 1000000
        ? `$${(totalRevEstimate / 1000000).toFixed(1)}M`
        : `$${(totalRevEstimate / 1000).toFixed(0)}K` },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map(s => (
        <div
          key={s.label}
          className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-center shadow-sm"
        >
          <p className="text-lg font-black text-slate-900">{s.value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EXAMPLE_KEYWORDS = [
  "habit change for busy professionals",
  "meal prep for beginners",
  "personal finance for millennials",
  "home organization for small spaces",
  "mindfulness for anxiety",
]

export default function BookResearch() {
  const { user } = useAuth()
  const [keyword, setKeyword] = useState("")
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [books, setBooks] = useState<AmazonBook[]>([])
  const [phase, setPhase] = useState<SearchPhase>("idle")
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<InsightsData>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [showIndieOnly, setShowIndieOnly] = useState(false)
  const [inputError, setInputError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const isLoading = phase !== "idle" && phase !== "done"

  // ── Load projects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return
    getUserProjects(user.uid)
      .then(p => setProjects(Array.isArray(p) ? p : []))
      .catch(err => console.error("Failed to load projects:", err))
  }, [user])

  // ── Scroll to results on completion ────────────────────────────────────────
  useEffect(() => {
    if (phase === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [phase])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const analyze = useCallback(async (kw: string) => {
    const trimmed = kw.trim()
    if (!trimmed) {
      setInputError(true)
      toast.error("Enter a keyword to analyze")
      return
    }
    setInputError(false)

    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    setPhase("searching")
    setBooks([])
    setTrendData(null)
    setInsights({})
    setInsightsLoading(false)

    try {
      // 1. Amazon books + Google Trends in parallel
      const [booksResult, trendsResult] = await Promise.allSettled([
        fetch(`/api/amazon-books/search?keywords=${encodeURIComponent(trimmed)}&page=1`, { signal })
          .then(r => { if (!r.ok) throw new Error("Amazon search failed"); return r.json() as Promise<AmazonBook[]> }),
        fetch(`/api/trends?keyword=${encodeURIComponent(trimmed)}`, { signal })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ])

      if (booksResult.status === "rejected") {
        if ((booksResult.reason as Error)?.name === "AbortError") return
        throw new Error("Amazon search failed")
      }

      const booksData: AmazonBook[] = booksResult.value
      const trendsJson = trendsResult.status === "fulfilled" ? trendsResult.value : null
      const trends: TrendData = {
        webSearch: trendsJson?.webSearch ?? { timelineData: [] },
        youtube:   trendsJson?.youtube   ?? { timelineData: [] },
      }

      setBooks(booksData)
      setTrendData(trends)

      // 2. Market intelligence — triggered once both data sources are ready
      setPhase("analyzing")
      setInsightsLoading(true)

      const insightsRes = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:    user?.uid ?? "anonymous",
          keyword:   trimmed,
          books:     booksData,
          trendData: trends,
        }),
        signal,
      })

      if (insightsRes.ok) {
        const insightsResult = await insightsRes.json()
        setInsights(insightsResult)
        if (user?.uid) {
          saveUserSearch(user.uid, trimmed, booksData, trends, insightsResult).catch(
            err => console.error("Failed to save search:", err)
          )
        }
      } else {
        const errBody = await insightsRes.json().catch(() => ({}))
        if (insightsRes.status === 429 && errBody?.error === 'usage_limit_exceeded') {
          toast.error(
            `You've used all ${errBody.limit} insights for this month on the ${errBody.tier} plan. Upgrade to get more.`,
            { duration: 8000 }
          )
        } else {
          const isQuota = insightsRes.status === 500 &&
            (JSON.stringify(errBody).includes("quota") || JSON.stringify(errBody).includes("429"))
          toast.error(
            isQuota
              ? "OpenAI quota exceeded — add credits at platform.openai.com to enable market analysis."
              : "Market analysis unavailable. Books and trends are still shown.",
            { duration: 6000 }
          )
        }
      }

      setPhase("done")
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      console.error("Analysis failed:", e)
      toast.error("Analysis failed. Please try again.")
      setPhase("idle")
    } finally {
      setInsightsLoading(false)
    }
  }, [user])

  // ── Save to project ─────────────────────────────────────────────────────────
  const saveToProject = useCallback(async (projectId: string) => {
    if (!books.length || !trendData) {
      toast.error("Run an analysis first")
      return
    }
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    try {
      await addMarketResearchToProject(projectId, {
        keyword,
        books,
        trendData,
        marketIntelligence: {
          rating: insights.rating ?? 0,
          insights: insights.insights ?? [],
          pros: insights.pros ?? [],
          cons: insights.cons ?? [],
          title_suggestion: insights.title_suggestion ?? "",
        },
      })
      toast.success(`Saved to "${project.name}"`)
    } catch (e) {
      console.error("Save failed:", e)
      toast.error("Failed to save. Please try again.")
    }
  }, [books, trendData, keyword, insights, projects])

  const filteredBooks      = showIndieOnly ? books.filter(detectIndie) : books
  const hasResults         = books.length > 0
  const hasTrends          = !!(trendData?.webSearch.timelineData.length || trendData?.youtube.timelineData.length)
  const showIntelligence   = insightsLoading || phase === "analyzing" || phase === "done"

  return (
      <div className="min-h-full p-4 sm:p-6" style={{ background: BRAND.bg, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="[font-family:var(--font-playfair,Georgia,serif)] text-2xl font-black text-slate-900 sm:text-3xl">
              Book Market Research
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Uncover demand, competition, and opportunity in any niche.
            </p>
          </div>

          {hasResults && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 transition-colors"
                  style={{ borderColor: `${BRAND.primary}50`, color: BRAND.primary, background: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.background = BRAND.primary; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = BRAND.primary }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = BRAND.primary; e.currentTarget.style.borderColor = `${BRAND.primary}50` }}
                >
                  <FolderPlus className="h-4 w-4" />
                  Save to Project
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {projects.length === 0 ? (
                  <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
                ) : (
                  projects.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => saveToProject(p.id)}>
                      {p.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ── Search ────────────────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 'meal prep for beginners'"
                  value={keyword}
                  disabled={isLoading}
                  onChange={e => { setKeyword(e.target.value); setInputError(false) }}
                  onKeyDown={e => e.key === "Enter" && analyze(keyword)}
                  className={`h-11 w-full rounded-lg border pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    inputError
                      ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
                      : "border-purple-200 bg-white focus:border-purple-500 focus:bg-white focus:ring-purple-100"
                  }`}
                />
              </div>
              <Button
                onClick={() => analyze(keyword)}
                disabled={isLoading}
                className="h-11 px-6 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: BRAND.primary }}
                onMouseEnter={e => (e.currentTarget.style.background = BRAND.deep)}
                onMouseLeave={e => (e.currentTarget.style.background = BRAND.primary)}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing…
                  </span>
                ) : "Analyze Market"}
              </Button>
            </div>

            {/* Example pills — only before first search */}
            {!hasResults && !isLoading && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                <span className="mt-0.5 text-xs text-slate-400">Try:</span>
                {EXAMPLE_KEYWORDS.map(kw => (
                  <button
                    key={kw}
                    onClick={() => { setKeyword(kw); analyze(kw) }}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{ background: BRAND.bg, color: BRAND.primary, border: `1px solid ${BRAND.primary}40` }}
                    onMouseEnter={e => { e.currentTarget.style.background = BRAND.primary; e.currentTarget.style.color = "#fff" }}
                    onMouseLeave={e => { e.currentTarget.style.background = BRAND.bg; e.currentTarget.style.color = BRAND.primary }}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Inline progress bar */}
          {isLoading && (
            <div className="h-0.5 w-full" style={{ background: BRAND.bg }}>
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  background: BRAND.primary,
                  width: phase === "searching" ? "40%" : phase === "analyzing" ? "80%" : "100%",
                }}
              />
            </div>
          )}
        </div>

        {/* ── Phase bar (full width) ────────────────────────────────────────── */}
        <PhaseBar phase={phase} />

        {/* ── Results anchor ────────────────────────────────────────────────── */}
        <div ref={resultsRef} />

        {/* ── Stats bar (full width) ────────────────────────────────────────── */}
        {hasResults && <MarketStatsBar books={books} />}

        {/* ── Book skeleton during fetch ─────────────────────────────────────── */}
        {phase === "searching" && (
          <div className="mb-5 grid grid-cols-1 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex overflow-hidden rounded-xl border border-slate-100 bg-white" style={{ borderLeft: "3px solid #e2e8f0" }}>
                <Skeleton className="h-32 w-[88px] flex-shrink-0 rounded-none" />
                <div className="flex-1 space-y-2.5 p-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex gap-4 pt-1">
                    {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-7 w-12" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Trend Charts ──────────────────────────────────────────────────── */}
        {hasTrends && trendData && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
                <TrendingUp className="h-4 w-4" style={{ color: BRAND.primary }} />
              </div>
              <div>
                <h2 className="[font-family:var(--font-playfair,Georgia,serif)] text-base font-bold text-slate-900">Search Demand</h2>
                <p className="text-xs text-slate-400">Google & YouTube interest — last 6 months</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {trendData.webSearch.timelineData.length > 0 && (
                <TrendChart
                  title="Google Web Search"
                  data={trendData.webSearch.timelineData}
                  color="#9333ea"
                  icon={<Search className="h-3.5 w-3.5" />}
                />
              )}
              {trendData.youtube.timelineData.length > 0 && (
                <TrendChart
                  title="YouTube Search"
                  data={trendData.youtube.timelineData}
                  color="#dc2626"
                  icon={
                    <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
                    </svg>
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ── Market Intelligence ────────────────────────────────────────────── */}
        {(showIntelligence || phase === "searching") && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
                <Brain className="h-4 w-4" style={{ color: BRAND.deep }} />
              </div>
              <div>
                <h2 className="[font-family:var(--font-playfair,Georgia,serif)] text-base font-bold text-slate-900">Market Intelligence</h2>
                <p className="text-xs" style={{ color: BRAND.gray }}>Deep analysis of BSR, reviews, trends, and indie opportunity</p>
              </div>
            </div>

            <div className="p-6">

              {/* Searching-phase placeholder */}
              {phase === "searching" && (
                <div className="space-y-5">
                  {/* Row 1 skeleton: score + verdict */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Skeleton className="h-40 rounded-2xl" />
                    <div className="space-y-3 md:col-span-2">
                      <Skeleton className="h-8 w-32 rounded-lg" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-4 w-4/5 rounded" />
                    </div>
                  </div>
                  {/* Row 2 skeleton: key findings */}
                  <div className="border-t border-slate-100 pt-5">
                    <Skeleton className="mb-3 h-3 w-28 rounded" />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                      ))}
                    </div>
                  </div>
                  {/* Row 3 skeleton: pros + cons */}
                  <div className="border-t border-slate-100 pt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24 rounded" />
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24 rounded" />
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                  </div>
                  {/* Row 4 skeleton: keywords + title */}
                  <div className="border-t border-slate-100 pt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-32 rounded" />
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28 rounded" />
                      <Skeleton className="h-6 w-3/4 rounded" />
                      <Skeleton className="h-4 w-1/2 rounded" />
                    </div>
                  </div>
                </div>
              )}

              {/* Live intelligence content */}
              {showIntelligence && (
                <>
                  {/* ── Row 1: Score + Verdict ──────────────────────────────── */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Score panel — col-span-1 */}
                    <div className="md:col-span-1">
                      <MarketScore score={insights.rating ?? 0} loading={insightsLoading} />
                    </div>

                    {/* Verdict panel — col-span-2 */}
                    <div className={`flex flex-col justify-center rounded-2xl px-6 py-5 md:col-span-2 ${
                      !insightsLoading && insights.verdict === "Explore"
                        ? "border border-emerald-100 bg-emerald-50"
                        : !insightsLoading && insights.verdict === "Avoid"
                        ? "border border-rose-100 bg-rose-50"
                        : !insightsLoading && insights.verdict
                        ? "border border-amber-100 bg-amber-50"
                        : "border border-slate-100 bg-slate-50"
                    }`}>
                      {insightsLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-8 w-32 rounded-lg" />
                          <Skeleton className="h-4 w-full rounded" />
                          <Skeleton className="h-4 w-3/4 rounded" />
                        </div>
                      ) : insights.verdict ? (
                        <>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                             style={{ color: BRAND.gray }}>
                            Verdict
                          </p>
                          <p className={`[font-family:var(--font-playfair,Georgia,serif)] text-3xl font-black italic leading-none ${
                            insights.verdict === "Explore" ? "text-emerald-700"
                            : insights.verdict === "Avoid" ? "text-rose-700"
                            : "text-amber-700"
                          }`}>
                            {insights.verdict === "Explore" ? "✓ Explore"
                              : insights.verdict === "Avoid" ? "✕ Avoid"
                              : "~ Proceed with Caution"}
                          </p>
                          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                            {insights.verdict_reason}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Row 2: Key Findings ─────────────────────────────────── */}
                  <div className="border-t border-slate-100 pt-5 mt-1">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em]"
                       style={{ color: BRAND.deep }}>
                      Key Findings
                    </p>
                    {insightsLoading ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-14 rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {insights.insights?.map((insight, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-slate-100 bg-white px-4 py-3"
                            style={{ borderLeft: `2px solid ${BRAND.primary}` }}
                          >
                            <p className="text-sm leading-relaxed text-slate-700">{insight}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Row 3: Opportunities + Challenges ──────────────────── */}
                  <div className="border-t border-slate-100 pt-5 mt-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Opportunities */}
                    <div
                      className="rounded-xl border border-slate-100 bg-white p-5"
                      style={{ borderLeft: "4px solid #34d399" }}
                    >
                      <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">
                        Opportunities
                      </p>
                      {insightsLoading ? (
                        <div className="space-y-2.5">
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {insights.pros?.map((pro, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                              <p className="text-sm leading-relaxed text-slate-700">{pro}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Challenges */}
                    <div
                      className="rounded-xl border border-slate-100 bg-white p-5"
                      style={{ borderLeft: "4px solid #fb7185" }}
                    >
                      <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-500">
                        Challenges
                      </p>
                      {insightsLoading ? (
                        <div className="space-y-2.5">
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {insights.cons?.map((con, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
                              <p className="text-sm leading-relaxed text-slate-700">{con}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Row 4: Keywords + Title suggestion ─────────────────── */}
                  {(insightsLoading ||
                    (insights.keyword_suggestions?.length ?? 0) > 0 ||
                    insights.title_suggestion) && (
                    <div className="border-t border-slate-100 pt-5 mt-1 grid grid-cols-1 gap-5 md:grid-cols-2">

                      {/* Suggested Keywords */}
                      {(insightsLoading || (insights.keyword_suggestions?.length ?? 0) > 0) && (
                        <div className="rounded-2xl border border-slate-100 bg-white p-5">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em]"
                             style={{ color: BRAND.deep }}>
                            Suggested Keywords
                          </p>
                          {insightsLoading ? (
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-28 rounded-full" />)}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {insights.keyword_suggestions?.map((kw, i) => (
                                <button
                                  key={i}
                                  onClick={() => { setKeyword(kw); analyze(kw) }}
                                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold transition-colors"
                                  style={{ border: `1px solid ${BRAND.primary}50`, color: BRAND.primary }}
                                  onMouseEnter={e => { e.currentTarget.style.background = BRAND.accent; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = BRAND.accent }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = BRAND.primary; e.currentTarget.style.borderColor = `${BRAND.primary}50` }}
                                >
                                  {kw}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Suggested Title */}
                      {(insightsLoading || insights.title_suggestion) && (
                        <div className="rounded-2xl border border-slate-100 bg-white p-5">
                          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em]"
                             style={{ color: BRAND.deep }}>
                            <BookOpen className="h-3 w-3" />
                            Suggested Title
                          </p>
                          {insightsLoading ? (
                            <div className="space-y-2">
                              <Skeleton className="h-6 w-3/4 rounded" />
                              <Skeleton className="h-4 w-1/2 rounded" />
                            </div>
                          ) : (
                            <div>
                              <p className="[font-family:var(--font-playfair,Georgia,serif)] text-xl font-bold italic text-slate-900 leading-snug">
                                &ldquo;{insights.title_suggestion}&rdquo;
                              </p>
                              {insights.subtitle_suggestion && (
                                <p className="mt-1.5 text-sm italic text-slate-500">
                                  {insights.subtitle_suggestion}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}

        {/* ── Competing Titles / book list ───────────────────────────────────── */}
        {filteredBooks.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
                  <ShoppingCart className="h-4 w-4" style={{ color: BRAND.primary }} />
                </div>
                <div>
                  <h2 className="[font-family:var(--font-playfair,Georgia,serif)] text-base font-bold text-slate-900">Competing Titles</h2>
                  <p className="text-xs text-slate-400">{filteredBooks.length} books found on Amazon</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="indie-filter"
                  checked={showIndieOnly}
                  onCheckedChange={setShowIndieOnly}
                  className="data-[state=checked]:bg-purple-600"
                />
                <Label htmlFor="indie-filter" className="cursor-pointer text-sm font-medium text-slate-600">
                  Indie only
                </Label>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 gap-3">
              {filteredBooks.map((book) => (
                <BookCard key={book.asin} book={book} />
              ))}
            </div>
          </div>
        )}

      </div>
  )
}
