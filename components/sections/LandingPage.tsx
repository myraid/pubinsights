"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, TrendingUp, Share2, BarChart2, ArrowRight, Sparkles, Search, Tag, List, FileText, Video, Zap, Check } from "lucide-react"
import LoginForm from "./LoginForm"
import type React from "react"

const BRAND = {
  deep: "#7000A0",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#BB00EE",
} as const

export default function LandingPage() {
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login")

  if (showLoginForm) {
    return <LoginForm initialMode={loginMode} />
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {/* ─── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b" style={{ borderColor: "#EEE0F8" }}>
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="rounded-xl overflow-hidden shadow-md flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Logo-1.png"
              alt="Publisher Insights"
              width={48}
              height={48}
              loading="eager"
              className="w-auto h-10 md:h-12 block"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              className="text-sm font-medium transition-colors"
              style={{ color: BRAND.gray }}
              onClick={() => { setLoginMode("login"); setShowLoginForm(true) }}
            >
              Sign in
            </button>
            <Button
              onClick={() => { setLoginMode("signup"); setShowLoginForm(true) }}
              className="text-white text-sm px-5 h-9 rounded-full"
              style={{
                background: BRAND.primary,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              }}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section
        className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${BRAND.bg} 0%, #FFFFFF 55%, #FAF5FF 100%)` }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND.accent} 0%, transparent 70%)` }}
        />

        {/* Eyebrow badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 border"
          style={{
            background: BRAND.bg,
            color: BRAND.primary,
            borderColor: "#DDD0EC",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Book Market Research
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight max-w-3xl mb-6 [font-family:var(--font-playfair,Georgia,serif)]"
          style={{ color: BRAND.deep }}
        >
          Discover your next{" "}
          <span
            className="relative inline-block"
            style={{ color: BRAND.accent }}
          >
            bestselling niche
            <svg
              className="absolute -bottom-1 left-0 w-full"
              viewBox="0 0 300 12"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M2 9 C75 3, 150 11, 298 5"
                stroke={BRAND.accent}
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>
          </span>
        </h1>

        {/* Subheading */}
        <p
          className="text-lg sm:text-xl max-w-xl mb-10 leading-relaxed"
          style={{ color: BRAND.gray }}
        >
          PubInsights gives indie authors Amazon market data, AI-driven insights, and book outlines — everything you need to publish with confidence.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            size="lg"
            onClick={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            className="text-white px-8 h-12 rounded-full text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.deep} 100%)`,
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            }}
          >
            Start for free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <button
            className="text-sm font-medium underline underline-offset-4 transition-colors"
            style={{ color: BRAND.gray }}
            onClick={() => { setLoginMode("login"); setShowLoginForm(true) }}
          >
            Already have an account?
          </button>
        </div>
      </section>

      {/* ─── Feature strip ───────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: "#FFFFFF" }}>
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
              style={{ color: BRAND.deep }}
            >
              Everything an indie author needs
            </h2>
            <p className="text-sm" style={{ color: BRAND.gray }}>
              Research smarter. Write faster. Publish with an edge.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Search className="w-5 h-5" />}
              title="Amazon Market Data"
              description="See real BSR, review counts, and pricing for competing books in any niche."
            />
            <FeatureCard
              icon={<BarChart2 className="w-5 h-5" />}
              title="Trend Intelligence"
              description="Google & YouTube trend signals so you publish into rising demand."
            />
            <FeatureCard
              icon={<BookOpen className="w-5 h-5" />}
              title="Book Outline Generator"
              description="AI-drafted chapter outlines ready in seconds, tailored to your topic."
            />
            <FeatureCard
              icon={<Share2 className="w-5 h-5" />}
              title="Social Ad Copy"
              description="Platform-ready ad copy and organic posts crafted for each channel."
            />
          </div>
        </div>
      </section>

      {/* ─── Market Research section ─────────────────────────────── */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BRAND.deep}, ${BRAND.primary}, ${BRAND.accent})` }} />
      <section>
        {/* Header band */}
        <div className="px-4 py-12 text-center" style={{ background: BRAND.primary }}>
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
          >
            Everything you need to research your next book topic.
          </h2>
          <p className="text-sm text-white/80 max-w-xl mx-auto" style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
            Unlock unmatched insights into trends to discover your perfect niche
          </p>
        </div>
        {/* Cards */}
        <div className="py-14 px-4" style={{ background: "#FFFFFF" }}>
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <SectionFeatureCard
                icon={<Search className="w-7 h-7" />}
                title="Find Your Unique Niche"
                description="Research your book topic by analyzing keyword trends across multiple platforms"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
              <SectionFeatureCard
                icon={<TrendingUp className="w-7 h-7" />}
                title="Market Analysis"
                description="Access real-time BSR (Best Seller Rank), daily and monthly sales figures for books related to your niche"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
              <SectionFeatureCard
                icon={<Tag className="w-7 h-7" />}
                title="Keyword Suggestions"
                description="Discover related keywords based on competitor analysis to improve your book's discoverability"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI Writing Assistant section ────────────────────────── */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BRAND.deep}, ${BRAND.primary}, ${BRAND.accent})` }} />
      <section>
        {/* Header band */}
        <div className="px-4 py-12 text-center" style={{ background: "#FFFFFF" }}>
          <h2
            className="text-2xl sm:text-3xl font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
            style={{ color: BRAND.deep }}
          >
            AI-Powered Writing Assistant: Create with Confidence
          </h2>
          <p className="text-sm max-w-2xl mx-auto" style={{ color: BRAND.gray, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
            Crafting your book has never been easier. PubInsights leverages AI to assist you at every stage of the writing process
          </p>
        </div>
        {/* Cards */}
        <div className="py-14 px-4" style={{ background: BRAND.bg }}>
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <SectionFeatureCard
                icon={<BookOpen className="w-7 h-7" />}
                title="Book Title Generator"
                description="Let AI analyze your niche, discover high-demand keywords, and suggest a winning book title"
                iconBg={BRAND.primary}
                iconColor="#FFFFFF"
              />
              <SectionFeatureCard
                icon={<List className="w-7 h-7" />}
                title="Book Outline"
                description="Our AI-generated outlines help you organize your ideas, present insights effectively, and engage readers from cover to cover"
                iconBg={BRAND.primary}
                iconColor="#FFFFFF"
              />
              <SectionFeatureCard
                icon={<FileText className="w-7 h-7" />}
                title="Book Description"
                description="Create a book description packed with the right keywords for SEO optimization"
                iconBg={BRAND.primary}
                iconColor="#FFFFFF"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Media Promotion section ──────────────────────── */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BRAND.deep}, ${BRAND.primary}, ${BRAND.accent})` }} />
      <section>
        {/* Header band */}
        <div className="px-4 py-12 text-center" style={{ background: BRAND.bg }}>
          <h2
            className="text-2xl sm:text-3xl font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
            style={{ color: BRAND.deep }}
          >
            Effortless Book Promotion Across Social Media using AI
          </h2>
          <p className="text-sm max-w-2xl mx-auto" style={{ color: BRAND.gray, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
            Generate ready-to-publish social media posts to engage readers and grow your audience across Facebook, Instagram, and TikTok
          </p>
        </div>
        {/* Cards */}
        <div className="py-14 px-4" style={{ background: "#FFFFFF" }}>
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <SectionFeatureCard
                icon={<Share2 className="w-7 h-7" />}
                title="Generate Social Media Posts"
                description="With one click, create posts for Facebook, Instagram, and TikTok that highlight your book's key selling points, quotes, or exciting snippets"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
              <SectionFeatureCard
                icon={<Video className="w-7 h-7" />}
                title="Video Script Generator"
                description="Use AI to create captivating video scripts for Reels, TikTok videos, and other short-form content"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
              <SectionFeatureCard
                icon={<Zap className="w-7 h-7" />}
                title="Maximize Reach & Engagement"
                description="Our app analyzes current trends, hashtags, and audience behavior to help you craft posts that generate buzz and drive traffic to your book sales page"
                iconBg={BRAND.bg}
                iconColor={BRAND.primary}
              />
            </div>
          </div>
        </div>
      </section>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BRAND.deep}, ${BRAND.primary}, ${BRAND.accent})` }} />

      {/* ─── Pricing ─────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: BRAND.bg }}>
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
              style={{ color: BRAND.deep }}
            >
              Choose a plan that fits you
            </h2>
            <p className="text-sm" style={{ color: BRAND.gray }}>
              Start free and upgrade when you&apos;re ready to go deeper.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PlanCard
              title="Free"
              price="$0"
              priceDetail="per month"
              description="Get started with the essentials."
              features={[
                "3 market insights per month",
                "2 book outlines per month",
                "Amazon & trend data",
                "No credit card required",
              ]}
              cta="Start Free"
              onCta={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            />
            <PlanCard
              title="Creator"
              price="$9"
              priceDetail="per month"
              description="For authors serious about niche research."
              features={[
                "25 market insights per month",
                "15 book outlines per month",
                "Amazon & trend data",
                "Save research to projects",
                "Priority support",
              ]}
              cta="Get Started"
              highlight
              onCta={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            />
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ──────────────────────────────────────────── */}
      <section
        className="py-20 px-4 text-center"
        style={{ background: `linear-gradient(135deg, ${BRAND.deep} 0%, ${BRAND.primary} 100%)` }}
      >
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-4 [font-family:var(--font-playfair,Georgia,serif)]"
          >
            Ready to elevate your publishing career?
          </h2>
          <p className="text-white/70 mb-8 text-base">
            Join PubInsights and unlock the power of AI-driven market research for your books.
          </p>
          <Button
            size="lg"
            onClick={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            className="px-10 h-12 rounded-full text-base font-semibold shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5"
            style={{
              background: "#FFFFFF",
              color: BRAND.primary,
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            }}
          >
            Sign up — it&apos;s free
            <TrendingUp className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="py-6 text-center text-xs border-t" style={{ borderColor: "#EEE0F8", color: BRAND.gray }}>
        © 2025 PubInsights. All rights reserved.
      </footer>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ borderColor: "#EEE0F8", background: "#FFFFFF" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: BRAND.bg, color: BRAND.primary }}
      >
        {icon}
      </div>
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: BRAND.deep }}
      >
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: BRAND.gray }}>
        {description}
      </p>
    </div>
  )
}

function SectionFeatureCard({
  icon,
  title,
  description,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconBg: string
  iconColor: string
}) {
  return (
    <div
      className="flex flex-col items-center text-center max-w-xs mx-auto"
      style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <h3
        className="text-base font-bold mb-2"
        style={{ color: BRAND.deep }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: BRAND.gray }}>
        {description}
      </p>
    </div>
  )
}

function PlanCard({
  title,
  price,
  priceDetail,
  description,
  features,
  cta,
  highlight,
  onCta,
}: {
  title: string
  price: string
  priceDetail: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
  onCta: () => void
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col transition-all hover:shadow-lg relative overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: highlight
          ? `2px solid ${BRAND.primary}`
          : `1px solid #EEE0F8`,
        boxShadow: highlight ? "0 4px 24px 0 rgba(153,0,204,0.10)" : undefined,
      }}
    >
      {/* "Most Popular" badge — highlight plan only */}
      {highlight && (
        <div
          className="absolute top-0 right-0 flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-bl-xl text-white"
          style={{
            background: BRAND.primary,
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          }}
        >
          <Sparkles className="w-3 h-3 flex-shrink-0" />
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{
          color: highlight ? BRAND.primary : BRAND.gray,
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        }}
      >
        {title}
      </p>

      {/* Price row */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          className="text-4xl font-bold [font-family:var(--font-playfair,Georgia,serif)]"
          style={{ color: BRAND.deep }}
        >
          {price}
        </span>
        <span
          className="text-sm"
          style={{ color: BRAND.gray, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
        >
          {priceDetail}
        </span>
      </div>

      {/* Description */}
      <p
        className="text-sm mb-6"
        style={{ color: BRAND.gray, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
      >
        {description}
      </p>

      {/* Feature list */}
      <ul className="flex-1 space-y-2.5 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <Check
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: highlight ? BRAND.primary : "#059669" }}
            />
            <span style={{ color: BRAND.gray, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onCta}
        className="w-full h-10 text-sm font-semibold rounded-xl transition-all"
        style={{
          background: highlight ? BRAND.primary : "#FFFFFF",
          color: highlight ? "#FFFFFF" : BRAND.primary,
          border: highlight ? "none" : `1.5px solid ${BRAND.primary}`,
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        }}
      >
        {cta}
      </Button>
    </div>
  )
}
