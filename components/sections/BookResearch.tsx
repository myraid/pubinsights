"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import React from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import {
  ChevronDown, Brain, Sparkles, Zap, Target, Shield, Lightbulb,
  BookOpen, ShoppingCart, Search, Star, TrendingUp, ExternalLink,
  Loader2, FolderPlus, BarChart3, DollarSign, Users, Award,
  BookMarked
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
  const author = normalize(book.manufacturer || "")

  if (pub.includes("independently published")) return true
  if (!pub || pub === "unknown" || pub === "n/a" || pub === "") return true
  if (isMajorPublisher(pub)) return false
  if (author && (pub === author || pub.includes(author) || author.includes(pub))) return true
  const authorWords = author.split(/\s+/).filter(w => w.length > 3)
  if (authorWords.some(w => pub.includes(w))) return true
  if (/\b(self[- ]pub|self pub|indie|imprint|studios?|creations?|media group|publishing group)\b/.test(pub)) return true
  return false
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchPhase = "idle" | "searching" | "analyzing" | "done"

interface InsightsData {
  rating?: number
  insights?: string[]
  content_gaps?: string[]
  verdict?: "Explore" | "Proceed with Caution" | "Avoid"
  verdict_reason?: string
  keyword_suggestions?: string[]
  title_suggestion?: string
  subtitle_suggestion?: string
  cover_quality_score?: number
  cover_quality_summary?: string
}

const PHASES: { phase: SearchPhase; label: string }[] = [
  { phase: "searching", label: "Fetching Data" },
  { phase: "analyzing", label: "Analyzing Market" },
  { phase: "done",      label: "Complete" },
]

// ─── Brand palette ────────────────────────────────────────────────────────────

const BRAND = {
  deep:    "#8400B8",
  primary: "#9900CC",
  bg:      "#F5EEFF",
  gray:    "#6E6E6E",
  accent:  "#AA00DD",
} as const

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score >= 8) return "Strong Opportunity"
  if (score >= 6) return "Moderate Opportunity"
  return "Highly Competitive"
}

function scoreColor(score: number): string {
  if (score >= 8) return "#059669"
  if (score >= 6) return "#d97706"
  return "#e11d48"
}

function salesTier(bsr: number, monthly: number): { color: string; bg: string; label: string } {
  if (!bsr || bsr > 100000) return { color: "#AA00DD", bg: "#fdf4ff", label: "Low Signal" }
  if (monthly >= 300)        return { color: "#059669", bg: "#ecfdf5", label: "Hot"        }
  if (monthly >= 90)         return { color: "#d97706", bg: "#fffbeb", label: "Active"     }
  return                            { color: "#AA00DD", bg: "#fdf4ff", label: "Slow"       }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] ${className ?? ""}`}
      style={{ animation: "pulse 2s ease-in-out infinite, shimmer 2s ease-in-out infinite" }}
    />
  )
}


// ── Hero Score ─────────────────────────────────────────────────────────────────

function HeroScore({ score, verdict, verdictReason, loading }: {
  score: number; verdict?: string; verdictReason?: string; loading: boolean
}) {
  const circumference = 2 * Math.PI * 54

  const verdictConfig = {
    "Explore":               { icon: <Sparkles className="h-5 w-5" />, accent: "#34d399", label: "Explore This Niche" },
    "Proceed with Caution":  { icon: <Shield className="h-5 w-5" />,   accent: "#fbbf24", label: "Proceed with Caution" },
    "Avoid":                 { icon: <Target className="h-5 w-5" />,   accent: "#fb7185", label: "Avoid This Market" },
  }[verdict ?? ""] ?? { icon: <Brain className="h-5 w-5" />, accent: "#a78bfa", label: "" }

  return (
    <div
      className="relative overflow-hidden rounded-3xl transition-all duration-500"
      style={{
        background: "linear-gradient(135deg, #3D0066 0%, #5C0099 50%, #3D0066 100%)",
        boxShadow: "0 8px 40px #3D006655, 0 2px 8px #00000040",
      }}
    >
      {/* Radial texture overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 30% 50%, #7700AA22 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #AA00DD18 0%, transparent 50%)",
        }}
      />

      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
        style={{ background: `linear-gradient(90deg, ${BRAND.accent}, #CC44FF, ${BRAND.accent})` }}
      />

      <div className="relative p-8 sm:p-10">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
          {/* Score Ring */}
          <div className="flex-shrink-0">
            {loading ? (
              <div className="h-40 w-40 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
            ) : (
              <div className="relative h-40 w-40">
                {/* Glow */}
                <div className="absolute inset-4 rounded-full blur-2xl" style={{ background: `${verdictConfig.accent}35` }} />
                <svg className="relative h-full w-full -rotate-90" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
                  <circle
                    cx="64" cy="64" r="54" fill="none"
                    stroke={verdictConfig.accent} strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (score / 10) * circumference}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: `drop-shadow(0 0 10px ${verdictConfig.accent}80)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-5xl font-black leading-none tabular-nums"
                    style={{ color: "#FFFFFF" }}
                  >
                    {score.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-medium mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>/ 10</span>
                </div>
              </div>
            )}
            {!loading && (
              <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: verdictConfig.accent }}>
                {scoreLabel(score)}
              </p>
            )}
          </div>

          {/* Verdict */}
          <div className="flex-1 text-center sm:text-left">
            {loading ? (
              <div className="space-y-3">
                <div className="h-8 w-44 rounded-lg animate-pulse mx-auto sm:mx-0" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="h-4 w-full rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            ) : verdict ? (
              <>
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  <span style={{ color: verdictConfig.accent }}>{verdictConfig.icon}</span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    Verdict
                  </span>
                </div>
                <h2
                  className="[font-family:var(--font-playfair,Georgia,serif)] text-3xl sm:text-4xl lg:text-5xl font-black leading-tight"
                  style={{ color: "#FFFFFF" }}
                >
                  {verdictConfig.label}
                </h2>
                <p className="mt-3 text-sm sm:text-base leading-relaxed max-w-lg" style={{ color: "rgba(255,255,255,0.70)" }}>
                  {verdictReason}
                </p>

                {/* Zone strip */}
                <div
                  className="mt-5 flex w-full max-w-xs overflow-hidden rounded-full text-[9px] font-black uppercase tracking-wide"
                  style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  {[
                    { label: "Avoid",   active: score < 4,                on: "#f43f5e", off: "rgba(255,255,255,0.07)", offText: "rgba(255,255,255,0.35)" },
                    { label: "Caution", active: score >= 4 && score < 7,  on: "#f59e0b", off: "rgba(255,255,255,0.07)", offText: "rgba(255,255,255,0.35)" },
                    { label: "Explore", active: score >= 7,               on: "#10b981", off: "rgba(255,255,255,0.07)", offText: "rgba(255,255,255,0.35)" },
                  ].map(z => (
                    <div
                      key={z.label}
                      className="flex-1 py-1.5 text-center transition-all duration-300"
                      style={{ background: z.active ? z.on : z.off, color: z.active ? "#fff" : z.offText }}
                    >
                      {z.label}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Market Stats ──────────────────────────────────────────────────────────────

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
    { label: "Books Found",    value: books.length.toString(), icon: <BookOpen className="h-4 w-4" />,     color: BRAND.primary },
    { label: "Avg. Price",     value: `$${avgPrice.toFixed(2)}`, icon: <DollarSign className="h-4 w-4" />, color: "#059669" },
    { label: "Avg. Rating",    value: avgRating ? avgRating.toFixed(1) : "—", icon: <Star className="h-4 w-4" />, color: "#d97706" },
    { label: "Indie Share",    value: `${indiePercent}%`, icon: <Users className="h-4 w-4" />,             color: BRAND.accent },
    { label: "Est. Market/mo", value: totalRevEstimate >= 1000000
        ? `$${(totalRevEstimate / 1000000).toFixed(1)}M`
        : `$${(totalRevEstimate / 1000).toFixed(0)}K`,
      icon: <BarChart3 className="h-4 w-4" />, color: BRAND.deep },
  ]

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map(s => (
        <div
          key={s.label}
          className="group relative overflow-hidden rounded-2xl border border-purple-100/60 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, ${s.color}06, ${s.color}10)` }} />
          <div className="relative">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${s.color}12`, color: s.color }}>
              {s.icon}
            </div>
            <p className="text-xl font-black text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Trend Charts ──────────────────────────────────────────────────────────────

interface TrendChartProps {
  title: string
  data: Array<{ time: string; value: number[] }>
  color: string
  icon: React.ReactNode
}

function TrendChart({ title, data, color, icon }: TrendChartProps) {
  if (!data.length) return null
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 transition-shadow hover:shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${color}15`, color }}>
          {icon}
        </span>
        {title}
      </p>
      <Plot
        data={[{
          x: data.map(p => new Date(parseInt(p.time) * 1000)),
          y: data.map(p => p.value[0]),
          type: "scatter" as const,
          mode: "lines" as const,
          fill: "tozeroy" as const,
          fillcolor: `${color}08`,
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

// ── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({ book }: { book: AmazonBook }) {
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
      className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      onClick={() => window.open(book.url, "_blank", "noopener,noreferrer")}
    >
      {/* Colored accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5"
        style={{ background: tier.color }} />

      {/* Cover */}
      <div className="relative ml-1 w-[80px] flex-shrink-0 bg-gradient-to-b from-slate-50 to-white">
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
        <div className="mb-1.5">
          <div className="flex items-start gap-1.5 mb-1">
            <h3 className="[font-family:var(--font-playfair,Georgia,serif)] line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900 group-hover:text-purple-700 transition-colors">
              {book.title}
            </h3>
            <div className="flex flex-shrink-0 items-center gap-1 mt-0.5">
              {isIndie && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white"
                  style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
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

        <div className="flex items-center gap-3 mt-auto flex-wrap">
          <MetricPill label="Price"  value={`$${book.price.toFixed(2)}`} />
          <MetricPill label="BSR"    value={book.bsr ? `#${book.bsr.toLocaleString()}` : "—"} />
          <MetricPill
            label="Rating"
            value={
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {book.rating || "—"}
                <span className="text-[9px] font-normal text-slate-400">
                  ({(book.reviews_count ?? 0).toLocaleString()})
                </span>
              </span>
            }
          />
          <MetricPill
            label="Year"
            value={book.publication_date ? new Date(book.publication_date).getFullYear().toString() : "—"}
          />
          {book.is_prime && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600 border border-blue-100">
              Prime
            </span>
          )}
        </div>
      </div>

      {/* Sales panel */}
      <div
        className="flex-shrink-0 w-[76px] flex flex-col items-center justify-center gap-0.5 border-l"
        style={{ background: `linear-gradient(180deg, ${tier.bg}, white)`, borderColor: `${tier.color}20` }}
      >
        <TrendingUp className="h-3.5 w-3.5 mb-0.5" style={{ color: `${tier.color}99` }} />
        <span
          className="text-[22px] font-black leading-none tabular-nums"
          style={{ color: tier.color }}
        >
          {salesDisplay}
        </span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mt-1 leading-none text-center px-1">
          {tier.label} · /mo
        </span>
      </div>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 border border-slate-100">
      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-[11px] font-semibold text-slate-800">{value}</p>
    </div>
  )
}

// ── Key Signals ───────────────────────────────────────────────────────────────

function KeySignals({ insights, loading }: { insights: string[]; loading: boolean }) {
  const signalStyles = [
    { icon: <Zap className="h-4 w-4" />,        color: "#9900CC" },
    { icon: <Target className="h-4 w-4" />,      color: "#8400B8" },
    { icon: <TrendingUp className="h-4 w-4" />,  color: "#AA00DD" },
    { icon: <Lightbulb className="h-4 w-4" />,   color: "#9900CC" },
    { icon: <Award className="h-4 w-4" />,       color: "#8400B8" },
  ]

  return (
    <div className="rounded-2xl border border-purple-100/60 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
          <Brain className="h-4 w-4" style={{ color: BRAND.primary }} />
        </div>
        <div>
          <h3 className="[font-family:var(--font-playfair,Georgia,serif)] text-lg font-bold text-slate-900">Key Insights</h3>
          <p className="text-xs text-slate-400">What the data tells us about this market</p>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {insights.map((insight, i) => {
            const style = signalStyles[i % signalStyles.length]
            return (
              <div
                key={i}
                className="group/signal flex items-start gap-3 rounded-xl border border-purple-100/50 bg-gradient-to-br p-3 transition-all duration-200 hover:border-purple-200 hover:shadow-sm"
                style={{ background: `linear-gradient(135deg, ${style.color}07, white)` }}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${style.color}, ${style.color}cc)` }}
                >
                  {style.icon}
                </span>
                <p className="text-sm font-medium leading-snug text-slate-800">{insight}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Content Gaps ───────────────────────────────────────────────────────────────

function ContentGapsCard({
  gaps, coverScore, coverSummary, loading,
}: {
  gaps: string[]
  coverScore?: number
  coverSummary?: string
  loading: boolean
}) {
  const coverColor =
    coverScore == null ? '#94a3b8'
    : coverScore >= 7  ? '#10b981'
    : coverScore >= 5  ? '#f59e0b'
    : '#ef4444'

  const coverLabel =
    coverScore == null ? 'Not rated'
    : coverScore >= 7  ? 'Strong'
    : coverScore >= 5  ? 'Average'
    : 'Weak'

  return (
    <div className="rounded-2xl border border-purple-100/60 bg-white shadow-sm overflow-hidden">
      <div className="relative p-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400" />

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
              What Readers Are Missing
            </h4>
            {!loading && gaps.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-700">
                {gaps.length}
              </span>
            )}
          </div>

          {/* Cover quality badge */}
          {(loading || coverScore != null) && (
            <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
              style={{ borderColor: `${coverColor}40`, background: `${coverColor}10` }}>
              <BookOpen className="h-3 w-3" style={{ color: coverColor }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: coverColor }}>
                {loading ? 'Rating covers…' : `Cover Quality: ${coverScore?.toFixed(1)}/10 · ${coverLabel}`}
              </span>
            </div>
          )}
        </div>

        {/* Cover summary */}
        {!loading && coverSummary && (
          <p className="mb-4 text-[11px] leading-relaxed text-slate-500 italic border-l-2 border-amber-200 pl-3">
            {coverSummary}
          </p>
        )}

        {/* Gap items */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {gaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-amber-100/80 bg-gradient-to-r from-amber-50/60 to-white p-3 hover:border-amber-200 transition-colors">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-amber-100 text-[10px] font-black text-amber-700">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{gap}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Suggested Keywords + Title ────────────────────────────────────────────────

function SuggestionsPanel({ title, subtitle, loading }: {
  title?: string; subtitle?: string; loading: boolean
}) {
  if (!loading && !title) return null

  return (
    <div className="rounded-2xl border border-purple-100/60 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: BRAND.bg }}>
          <BookMarked className="h-3.5 w-3.5" style={{ color: BRAND.primary }} />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: BRAND.deep }}>
          Suggested Title
        </h4>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-1/2 rounded" />
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-to-br from-purple-50/50 to-white p-4 border border-purple-100/40">
          <p className="[font-family:var(--font-playfair,Georgia,serif)] text-xl font-bold italic text-slate-900 leading-snug">
            &ldquo;{title}&rdquo;
          </p>
          {subtitle && (
            <p className="mt-2 text-sm italic text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
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

  useEffect(() => {
    if (!user?.uid) return
    getUserProjects(user.uid)
      .then(p => setProjects(Array.isArray(p) ? p : []))
      .catch(err => console.error("Failed to load projects:", err))
  }, [user])

  useEffect(() => {
    if (phase === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [phase])

  const analyze = useCallback(async (kw: string) => {
    const trimmed = kw.trim()
    if (!trimmed) {
      setInputError(true)
      toast.error("Enter a keyword to analyze")
      return
    }
    setInputError(false)

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    setPhase("searching")
    setBooks([])
    setTrendData(null)
    setInsights({})
    setInsightsLoading(false)

    try {
      const [booksResult, trendsResult] = await Promise.allSettled([
        fetch(`/api/amazon-books/search?keywords=${encodeURIComponent(trimmed)}&page=1&userId=${encodeURIComponent(user?.uid || '')}`, { signal })
          .then(r => { if (!r.ok) throw new Error("Amazon search failed"); return r.json() as Promise<AmazonBook[]> }),
        fetch(`/api/trends?keyword=${encodeURIComponent(trimmed)}&userId=${encodeURIComponent(user?.uid || '')}`, { signal })
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
          content_gaps: insights.content_gaps ?? [],
          title_suggestion: insights.title_suggestion ?? "",
          cover_quality_score: insights.cover_quality_score,
          cover_quality_summary: insights.cover_quality_summary,
        },
      })
      toast.success(`Saved to "${project.name}"`)
    } catch (e) {
      console.error("Save failed:", e)
      toast.error("Failed to save. Please try again.")
    }
  }, [books, trendData, keyword, insights, projects])

  const filteredBooks      = (showIndieOnly ? books.filter(detectIndie) : books)
    .slice()
    .sort((a, b) => {
      // Books with BSR sort ascending (best sellers first); no BSR goes to the end
      if (!a.bsr && !b.bsr) return 0
      if (!a.bsr) return 1
      if (!b.bsr) return -1
      return a.bsr - b.bsr
    })
  const hasResults         = books.length > 0
  const hasTrends          = !!(trendData?.webSearch.timelineData.length || trendData?.youtube.timelineData.length)
  const showIntelligence   = insightsLoading || phase === "analyzing" || phase === "done"

  return (
    <div className="min-h-full p-4 sm:p-8" style={{ background: `linear-gradient(180deg, ${BRAND.bg} 0%, #FDFBFF 60%, #FFFFFF 100%)`, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${BRAND.primary}15` }}>
              <BarChart3 className="h-4 w-4" style={{ color: BRAND.primary }} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: BRAND.primary }}>Market Research</span>
          </div>
          <h1 className="[font-family:var(--font-playfair,Georgia,serif)] text-3xl font-black text-slate-900 sm:text-4xl">
            Book Market Research
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-md">
            Uncover demand, competition, and opportunity in any niche.
          </p>
        </div>

        {hasResults && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 rounded-xl transition-all duration-200 hover:scale-105"
                style={{ borderColor: `${BRAND.primary}40`, color: BRAND.primary, background: "white" }}
                onMouseEnter={e => { e.currentTarget.style.background = BRAND.primary; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = BRAND.primary }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = BRAND.primary; e.currentTarget.style.borderColor = `${BRAND.primary}40` }}
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
      <div className="mb-8 overflow-hidden rounded-2xl border border-purple-100/60 bg-white/90 backdrop-blur-sm shadow-sm transition-shadow hover:shadow-md">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. 'meal prep for beginners'"
                value={keyword}
                disabled={isLoading}
                onChange={e => { setKeyword(e.target.value); setInputError(false) }}
                onKeyDown={e => e.key === "Enter" && analyze(keyword)}
                className={`h-12 w-full rounded-xl border pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  inputError
                    ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
                    : "border-purple-200 bg-white focus:border-purple-500 focus:bg-white focus:ring-purple-100"
                }`}
              />
            </div>
            <Button
              onClick={() => analyze(keyword)}
              disabled={isLoading}
              className="h-12 rounded-xl px-7 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 hover:scale-[1.02] hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.deep})` }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Analyze Market
                </span>
              )}
            </Button>
          </div>

          {/* Example pills */}
          {!hasResults && !isLoading && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Try:</span>
              {EXAMPLE_KEYWORDS.map(kw => (
                <button
                  key={kw}
                  onClick={() => { setKeyword(kw); analyze(kw) }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105"
                  style={{ background: BRAND.bg, color: BRAND.primary, border: `1px solid ${BRAND.primary}30` }}
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
          <div className="h-1 w-full bg-purple-50">
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.accent})`,
                width: phase === "searching" ? "40%" : phase === "analyzing" ? "80%" : "100%",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Results anchor ───────────────────────────────────────────────── */}
      <div ref={resultsRef} />

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      {hasResults && <MarketStatsBar books={books} />}

      {/* ── Loading state during fetch ──────────────────────────────────── */}
      {phase === "searching" && (
        <div className="mb-8 space-y-6">
          {/* Activity indicator */}
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(135deg, #3D0066 0%, #5C0099 50%, #3D0066 100%)",
              boxShadow: "0 8px 40px #3D006655, 0 2px 8px #00000040",
            }}
          >
            {/* Radial texture overlay */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 30% 50%, #7700AA22 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #AA00DD18 0%, transparent 50%)",
              }}
            />

            {/* Top accent bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{ background: `linear-gradient(90deg, ${BRAND.accent}, #CC44FF, ${BRAND.accent})` }}
            />

            <div className="relative p-8 sm:p-10">
              <div className="flex flex-col items-center text-center gap-5">
                {/* Animated rings */}
                <div className="relative h-24 w-24">
                  <div
                    className="absolute inset-0 rounded-full border-2 animate-ping"
                    style={{ borderColor: "rgba(170,0,221,0.45)", animationDuration: "2s" }}
                  />
                  <div
                    className="absolute inset-2 rounded-full border-2 animate-ping"
                    style={{ borderColor: "rgba(204,68,255,0.35)", animationDuration: "2.5s", animationDelay: "0.3s" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="h-14 w-14 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.10)" }}
                    >
                      <Search className="h-6 w-6 animate-pulse" style={{ color: "#CC44FF" }} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-lg font-semibold" style={{ color: "#FFFFFF" }}>
                    Scanning the market…
                  </p>
                  <p className="mt-1 text-sm max-w-md" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Fetching Amazon book data and Google Trends in parallel. This usually takes 5–10 seconds.
                  </p>
                </div>

                {/* What we're doing */}
                <div className="flex flex-wrap justify-center gap-3 mt-1">
                  {[
                    { icon: <ShoppingCart className="h-3.5 w-3.5" />, text: "Amazon Books" },
                    { icon: <TrendingUp className="h-3.5 w-3.5" />, text: "Google Trends" },
                    { icon: <Brain className="h-3.5 w-3.5" />, text: "AI Analysis" },
                  ].map((step, i) => (
                    <div
                      key={step.text}
                      className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
                      style={{
                        background: i < 2 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                        color: i < 2 ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                        border: `1px solid ${i < 2 ? "rgba(204,68,255,0.40)" : "rgba(255,255,255,0.12)"}`,
                      }}
                    >
                      {i < 2 && (
                        <span className="relative flex h-2 w-2">
                          <span
                            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                            style={{ background: "#CC44FF" }}
                          />
                          <span
                            className="relative inline-flex h-2 w-2 rounded-full"
                            style={{ background: "#CC44FF" }}
                          />
                        </span>
                      )}
                      {step.icon}
                      {step.text}
                      {i >= 2 && (
                        <span className="text-[10px] ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>up next</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Book card skeletons */}
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex overflow-hidden rounded-2xl border border-slate-100 bg-white" style={{ borderLeft: "3px solid #e2e8f0", opacity: 1 - i * 0.15 }}>
                <Skeleton className="h-28 w-[88px] flex-shrink-0 rounded-none" />
                <div className="flex-1 space-y-2.5 p-4">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex gap-3 pt-1">
                    {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-7 w-16 rounded-full" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero Score + Verdict (prominent placement) ───────────────────── */}
      {showIntelligence && (
        <div className="mb-8">
          <HeroScore
            score={insights.rating ?? 0}
            verdict={insights.verdict}
            verdictReason={insights.verdict_reason}
            loading={insightsLoading}
          />
        </div>
      )}

      {/* ── Key Insights (full width, horizontal grid) ───────────────────── */}
      {showIntelligence && (
        <div className="mb-6">
          <KeySignals insights={insights.insights ?? []} loading={insightsLoading} />
        </div>
      )}

      {/* ── Content Gaps / What Readers Are Missing (full width) ─────────── */}
      {showIntelligence && (
        <div className="mb-6">
          <ContentGapsCard
            gaps={insights.content_gaps ?? []}
            coverScore={insights.cover_quality_score}
            coverSummary={insights.cover_quality_summary}
            loading={insightsLoading}
          />
        </div>
      )}

      {/* ── Suggested Title ───────────────────────────────────────────────── */}
      {showIntelligence && (
        <div className="mb-8">
          <SuggestionsPanel
            title={insights.title_suggestion}
            subtitle={insights.subtitle_suggestion}
            loading={insightsLoading}
          />
        </div>
      )}

      {/* ── Search Demand (Trends) ───────────────────────────────────────── */}
      {hasTrends && trendData && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
              <TrendingUp className="h-4 w-4" style={{ color: BRAND.primary }} />
            </div>
            <div>
              <h2 className="[font-family:var(--font-playfair,Georgia,serif)] text-lg font-bold text-slate-900">Search Demand</h2>
              <p className="text-[11px] text-slate-400">Google & YouTube interest — last 6 months</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {trendData.webSearch.timelineData.length > 0 && (
              <TrendChart
                title="Google Web Search"
                data={trendData.webSearch.timelineData}
                color="#9333ea"
                icon={<Search className="h-3 w-3" />}
              />
            )}
            {trendData.youtube.timelineData.length > 0 && (
              <TrendChart
                title="YouTube Search"
                data={trendData.youtube.timelineData}
                color="#dc2626"
                icon={
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
                  </svg>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* ── Competing Titles ─────────────────────────────────────────────── */}
      {filteredBooks.length > 0 && (
        <div className="rounded-2xl border border-purple-100/60 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: BRAND.bg }}>
                <ShoppingCart className="h-4 w-4" style={{ color: BRAND.primary }} />
              </div>
              <div>
                <h2 className="[font-family:var(--font-playfair,Georgia,serif)] text-lg font-bold text-slate-900">Competing Titles</h2>
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
