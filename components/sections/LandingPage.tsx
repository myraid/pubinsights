"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BookOpen, TrendingUp, Share2, BarChart2 } from "lucide-react"
import LoginForm from "./LoginForm"
import type React from "react"
import Image from "next/image"

export default function LandingPage() {
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login")

  if (showLoginForm) {
    return <LoginForm initialMode={loginMode} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <header className="container mx-auto px-4 py-4 md:py-6 flex justify-between items-center">
        <Image
          src="/images/logo.png"
          alt="Publisher Insights"
          width={800}
          height={240}
          className="w-auto h-24 md:h-32"
        />
        <Button
          className="bg-primary text-white hover:bg-primary/90"
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
          <h1 className="text-4xl font-bold text-primary mb-4">Welcome to Publisher Insights</h1>
          <p className="text-xl text-gray-600 mb-8">Empower your writing journey with AI-driven insights and tools</p>
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-primary/90"
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

        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary mb-4">Ready to elevate your writing career?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Join Publisher Insights today and unlock the power of AI for your books
          </p>
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => {
              setLoginMode("signup")
              setShowLoginForm(true)
            }}
          >
            Sign Up Now
          </Button>
        </div>
      </main>

      <footer className="bg-gray-100 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          © 2025 Publisher Insights. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center mb-4">
        {icon}
        <h3 className="text-xl font-semibold ml-4">{title}</h3>
      </div>
      <p className="text-gray-600">{description}</p>
    </Card>
  )
}

