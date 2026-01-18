"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BookOpen, TrendingUp, Share2, BarChart2 } from "lucide-react"
import LoginForm from "./LoginForm"
import SubscriptionPlans from "./SubscriptionPlans"
import type React from "react"
import Image from "next/image"

export default function LandingPage() {
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login")

  if (showLoginForm) {
    return <LoginForm initialMode={loginMode} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/90 via-white to-white">
      <header className="container mx-auto px-4 py-4 md:py-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <Image
          src="/images/logo.png"
          alt="Publisher Insights"
          width={800}
          height={240}
          className="w-auto h-20 md:h-24 drop-shadow-sm"
        />
        <Button
          className="px-6"
          onClick={() => {
            setLoginMode("login")
            setShowLoginForm(true)
          }}
        >
          Login
        </Button>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
            Welcome to Publisher Insights
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Empower your writing journey with AI-driven insights and tools tailored for indie publishers.
          </p>
          <Button
            size="lg"
            className="px-8"
            onClick={() => {
              setLoginMode("signup")
              setShowLoginForm(true)
            }}
          >
            Get Started
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <FeatureCard
            icon={<BookOpen className="w-8 h-8 text-primary" />}
            title="Book Research"
            description="Analyze market trends and get AI-powered insights for your book ideas"
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8 text-primary" />}
            title="Book Outline"
            description="Generate comprehensive book outlines with AI assistance"
          />
          <FeatureCard
            icon={<Share2 className="w-8 h-8 text-primary" />}
            title="Social Media"
            description="Create engaging social media content to promote your books"
          />
          <FeatureCard
            icon={<BarChart2 className="w-8 h-8 text-primary" />}
            title="Analytics"
            description="Track your progress and gain insights into your writing projects"
          />
        </div>

        <div className="mb-16">
          <SubscriptionPlans />
        </div>

        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Ready to elevate your writing career?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Join Publisher Insights today and unlock the power of AI for your books
          </p>
          <Button
            size="lg"
            className="px-8"
            onClick={() => {
              setLoginMode("signup")
              setShowLoginForm(true)
            }}
          >
            Sign Up Now
          </Button>
        </div>
      </main>

      <footer className="bg-white/70 border-t border-purple-100/70 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          © 2025 Publisher Insights. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 ring-1 ring-purple-100">
          {icon}
        </div>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  )
}
