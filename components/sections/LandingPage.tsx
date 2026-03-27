"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, TrendingUp, Share2, BarChart2, ArrowRight, Sparkles, Search } from "lucide-react"
import LoginForm from "./LoginForm"
import type React from "react"
import Image from "next/image"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
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
          <Image
            src="/images/logo.png"
            alt="PubInsights"
            width={800}
            height={240}
            className="w-auto h-10"
          />
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

      {/* ─── Pricing ─────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: BRAND.bg }}>
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3 [font-family:var(--font-playfair,Georgia,serif)]"
              style={{ color: BRAND.deep }}
            >
              Choose a plan that fits you
            </h2>
            <p className="text-sm" style={{ color: BRAND.gray }}>
              Flexible options for nonfiction creators at every stage.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlanCard
              title="Freemium"
              price="Free"
              description="Try the platform with a small monthly allowance."
              features={[
                "5 book requests / month",
                "3 outline generations / month",
                "No social media ads",
              ]}
              cta="Start Free"
              onCta={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            />
            <PlanCard
              title="Creator"
              price="25 requests"
              description="Validate topics and build your nonfiction pipeline."
              features={[
                "25 book requests / month",
                "25 outline generations / month",
                "Email support",
              ]}
              cta="Choose Creator"
              highlight
              onCta={() => { setLoginMode("signup"); setShowLoginForm(true) }}
            />
            <PlanCard
              title="Pro"
              price="100 requests"
              description="Scale your nonfiction catalog with pro tools."
              features={[
                "100 book requests / month",
                "100 outline generations / month",
                "Social media ad generation",
              ]}
              cta="Go Pro"
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

function PlanCard({
  title,
  price,
  description,
  features,
  cta,
  highlight,
  onCta,
}: {
  title: string
  price: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
  onCta: () => void
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col transition-all hover:shadow-lg"
      style={{
        background: highlight ? BRAND.primary : "#FFFFFF",
        border: highlight ? "none" : `1px solid #EEE0F8`,
        boxShadow: highlight ? "0 8px 32px rgba(153,0,204,0.25)" : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <h3
          className="text-base font-bold"
          style={{ color: highlight ? "#FFFFFF" : BRAND.deep }}
        >
          {title}
        </h3>
        {highlight && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}
          >
            Most Popular
          </span>
        )}
      </div>
      <p
        className="text-xs mb-6"
        style={{ color: highlight ? "rgba(255,255,255,0.7)" : BRAND.gray }}
      >
        {description}
      </p>
      <p
        className="text-2xl font-bold mb-1 [font-family:var(--font-playfair,Georgia,serif)]"
        style={{ color: highlight ? "#FFFFFF" : BRAND.deep }}
      >
        {price}
      </p>
      <p
        className="text-xs mb-6"
        style={{ color: highlight ? "rgba(255,255,255,0.6)" : BRAND.gray }}
      >
        Billed monthly
      </p>
      <ul className="flex-1 space-y-2 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: highlight ? "rgba(255,255,255,0.8)" : BRAND.primary }}
            />
            <span style={{ color: highlight ? "rgba(255,255,255,0.85)" : BRAND.gray }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      <Button
        onClick={onCta}
        className="w-full h-10 text-sm font-semibold rounded-xl transition-all"
        style={{
          background: highlight ? "#FFFFFF" : BRAND.primary,
          color: highlight ? BRAND.primary : "#FFFFFF",
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        }}
      >
        {cta}
      </Button>
    </div>
  )
}
