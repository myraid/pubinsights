"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/app/context/AuthContext"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageData {
  tier: "free" | "creator" | "beta"
  subscriptionStatus: string | null
  insights: { current: number; limit: number }
  outlines: { current: number; limit: number }
}

interface PlanFeature {
  label: string
}

interface Plan {
  id: "free" | "creator"
  name: string
  price: string
  priceDetail: string
  description: string
  features: PlanFeature[]
  insightsLimit: number
  outlinesLimit: number
  cta: string
  highlight: boolean
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceDetail: "per month",
    description: "Get started with the essentials.",
    features: [
      { label: "3 market insights per month" },
      { label: "1 book outline per month" },
      { label: "Amazon & trend data" },
      { label: "No credit card required" },
    ],
    insightsLimit: 3,
    outlinesLimit: 1,
    cta: "Current Plan",
    highlight: false,
  },
  {
    id: "creator",
    name: "Creator",
    price: "$9",
    priceDetail: "per month",
    description: "For authors serious about niche research.",
    features: [
      { label: "25 market insights per month" },
      { label: "10 book outlines per month" },
      { label: "Amazon & trend data" },
      { label: "Save research to projects" },
      { label: "Priority support" },
    ],
    insightsLimit: 25,
    outlinesLimit: 10,
    cta: "Upgrade to Creator",
    highlight: true,
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string
  current: number
  limit: number
}) {
  const pct = Math.min((current / limit) * 100, 100)
  const isNearLimit = pct >= 80

  return (
    <div className="space-y-1">
      <div
        className="flex justify-between text-xs"
        style={{ color: "var(--brand-gray)", fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
      >
        <span>{label}</span>
        <span>
          {current} / {limit} used
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-purple-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isNearLimit ? "#b45309" : "var(--brand-primary)",
          }}
        />
      </div>
    </div>
  )
}

function UsageBarSkeleton() {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-purple-100 animate-pulse" />
        <div className="h-3 w-16 rounded bg-purple-100 animate-pulse" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-purple-100 animate-pulse" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Pricing() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [usage, setUsage] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  // Check URL params for checkout result on mount
  useEffect(() => {
    const checkout = searchParams.get("checkout")
    if (checkout === "success") {
      toast.success("You're now on the Creator plan. Welcome!")
      // Remove the param from the URL without a full navigation
      const url = new URL(window.location.href)
      url.searchParams.delete("checkout")
      router.replace(url.pathname + (url.search || ""))
    } else if (checkout === "cancel") {
      toast.info("Checkout cancelled. Your plan was not changed.")
      const url = new URL(window.location.href)
      url.searchParams.delete("checkout")
      router.replace(url.pathname + (url.search || ""))
    }
  }, [searchParams, router])

  // Fetch current usage
  useEffect(() => {
    if (!user) {
      setUsageLoading(false)
      return
    }

    const controller = new AbortController()

    async function fetchUsage() {
      try {
        const res = await fetch(`/api/usage?userId=${user!.uid}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data: UsageData = await res.json()
          setUsage(data)
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Silently fail — pricing cards still render without usage bars
          console.error("Failed to load usage data:", err)
        }
      } finally {
        setUsageLoading(false)
      }
    }

    fetchUsage()
    return () => controller.abort()
  }, [user])

  async function handleUpgrade() {
    if (!user) return
    setUpgrading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: "creator",
          userId: user.uid,
          email: user.email,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? "Checkout failed. Please try again.")
      }

      const data = await res.json()
      if (data?.url) {
        router.push(data.url)
      } else {
        throw new Error("No checkout URL returned.")
      }
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong. Please try again.")
      setUpgrading(false)
    }
  }

  const currentTier = usage?.tier ?? "free"

  return (
    <section
      className="min-h-[calc(100vh-140px)] flex flex-col items-center px-4 py-12"
      style={{ background: "var(--brand-bg)" }}
    >
      {/* Section heading */}
      <div className="text-center mb-10 max-w-xl">
        <h1
          className="text-3xl md:text-4xl font-bold mb-3"
          style={{
            fontFamily: "var(--font-playfair, Georgia, serif)",
            color: "var(--brand-deep)",
          }}
        >
          Choose Your Plan
        </h1>
        <p
          className="text-base leading-relaxed"
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            color: "var(--brand-gray)",
          }}
        >
          Start free and upgrade when you&apos;re ready to go deeper.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentTier === plan.id
          const isCreator = plan.id === "creator"

          return (
            <Card
              key={plan.id}
              className="relative flex flex-col bg-white overflow-hidden"
              style={
                isCreator
                  ? {
                      outline: "2px solid var(--brand-primary)",
                      outlineOffset: "2px",
                      boxShadow: "0 4px 24px 0 rgba(153,0,204,0.10)",
                    }
                  : {}
              }
            >
              {/* "Most Popular" badge — Creator only */}
              {isCreator && (
                <div
                  className="absolute top-0 right-0 flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-bl-xl text-white"
                  style={{
                    background: "var(--brand-primary)",
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  }}
                >
                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                  Most Popular
                </div>
              )}

              <CardHeader className="pb-4">
                {/* Plan name */}
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{
                    color: isCreator ? "var(--brand-primary)" : "var(--brand-gray)",
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  }}
                >
                  {plan.name}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span
                    className="text-4xl font-bold"
                    style={{
                      fontFamily: "var(--font-playfair, Georgia, serif)",
                      color: "var(--brand-deep)",
                    }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--brand-gray)",
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    }}
                  >
                    {plan.priceDetail}
                  </span>
                </div>

                <p
                  className="text-sm"
                  style={{
                    color: "var(--brand-gray)",
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  }}
                >
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-6">
                {/* Feature list */}
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 flex-shrink-0 mt-0.5"
                        style={{ color: isCreator ? "var(--brand-primary)" : "#059669" }}
                      />
                      <span
                        className="text-sm leading-snug"
                        style={{
                          color: "var(--brand-gray)",
                          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                        }}
                      >
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Usage bars — shown only when usage is loaded and this is the current plan */}
                {isCurrentPlan && (
                  <div
                    className="rounded-lg p-3 space-y-3"
                    style={{ background: "var(--brand-bg)" }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: "var(--brand-deep)",
                        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                      }}
                    >
                      This month&apos;s usage
                    </p>
                    {usageLoading ? (
                      <div className="space-y-3">
                        <UsageBarSkeleton />
                        <UsageBarSkeleton />
                      </div>
                    ) : usage ? (
                      <div className="space-y-3">
                        <UsageBar
                          label="Insights"
                          current={usage.insights.current}
                          limit={usage.insights.limit}
                        />
                        <UsageBar
                          label="Outlines"
                          current={usage.outlines.current}
                          limit={usage.outlines.limit}
                        />
                      </div>
                    ) : (
                      <p
                        className="text-xs"
                        style={{
                          color: "var(--brand-gray)",
                          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                        }}
                      >
                        Usage data unavailable.
                      </p>
                    )}
                  </div>
                )}

                {/* Spacer pushes CTA to bottom */}
                <div className="flex-1" />

                {/* CTA button */}
                {plan.id === "free" ? (
                  <Button
                    variant={isCurrentPlan ? "outline" : "default"}
                    size="lg"
                    className="w-full"
                    disabled
                    style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
                  >
                    Current Plan
                  </Button>
                ) : isCurrentPlan ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    disabled
                    style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleUpgrade}
                    disabled={upgrading || !user}
                    style={{
                      background: "var(--brand-primary)",
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    }}
                  >
                    {upgrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        Redirecting…
                      </>
                    ) : (
                      plan.cta
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Footer note */}
      <p
        className="mt-8 text-xs text-center max-w-sm"
        style={{
          color: "var(--brand-gray)",
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        }}
      >
        Cancel anytime. Upgrades take effect immediately. All prices in USD.
      </p>
    </section>
  )
}
