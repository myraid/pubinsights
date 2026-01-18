"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@tremor/react"
import { CheckCircle2, Sparkles } from "lucide-react"
import { PLANS, type PlanDefinition } from "@/app/lib/subscription/plans"

const PlanCard = ({
  plan,
  isHighlighted,
  isLoading,
  onSelect
}: {
  plan: PlanDefinition
  isHighlighted?: boolean
  isLoading: boolean
  onSelect: () => void
}) => {
  return (
    <Card
      className={`p-6 border ${isHighlighted ? "border-primary/40 shadow-md" : "border-gray-200"} bg-white`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
        </div>
        {isHighlighted && (
          <Badge color="purple" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </Badge>
        )}
      </div>

      <div className="mt-6">
        <div className="text-3xl font-semibold text-gray-900">{plan.priceLabel}</div>
        <p className="text-sm text-gray-500 mt-1">Billed monthly</p>
      </div>

      <ul className="mt-6 space-y-3 text-sm text-gray-700">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <Button className="mt-6 w-full" onClick={onSelect} disabled={isLoading}>
        {isLoading ? "Redirecting..." : plan.ctaLabel}
      </Button>
    </Card>
  )
}

export default function SubscriptionPlans() {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoadingPlanId(planId)
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to start checkout")
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      if (planId === "freemium") {
        alert("You are on the Free plan. You can start using the app now.")
        return
      }

      throw new Error("Checkout URL missing")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed"
      alert(message)
    } finally {
      setLoadingPlanId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription Plans</h1>
        <p className="text-sm text-gray-600 mt-1">
          Pick the plan that matches your nonfiction publishing goals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isHighlighted={plan.id === "pro"}
            isLoading={loadingPlanId === plan.id}
            onSelect={() => handleSelectPlan(plan.id)}
          />
        ))}
      </div>
    </div>
  )
}
