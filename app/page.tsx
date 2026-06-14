"use client"

import { useState, type ComponentType } from "react"
import { useAuth } from "./context/AuthContext"
import { Card } from "@/components/ui/card"
import BookResearch from "@/components/sections/BookResearch"
import BookOutline from "@/components/sections/BookOutline"
import SocialMedia from "@/components/sections/SocialMedia"
import MyProjects from "@/components/sections/MyProjects"
import BookWriter from "@/components/sections/BookWriter"
import Pricing from "@/components/sections/Pricing"
import LandingPage from "@/components/sections/LandingPage"
import Header from "@/components/sections/Header"
import { SearchIcon as BookSearch, PenTool, Share2, FolderKanban, Crown, BookText, Lock, ArrowRight, Check, PenLine, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const BRAND = {
  deep: "#7000A0",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
} as const

function BookWriterGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md text-center space-y-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: BRAND.bg }}
        >
          <PenLine className="h-8 w-8" style={{ color: BRAND.primary }} />
        </div>
        <div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: BRAND.deep, fontFamily: "var(--font-playfair, Georgia, serif)" }}
          >
            Your AI copilot, from outline to manuscript.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: BRAND.gray }}>
            Book Writer is available on the Creator plan. Preview your first chapter with AI and see your outline come to life.
          </p>
        </div>
        <div className="rounded-xl border p-4 text-left" style={{ borderColor: "#DDD0EC", background: "#FAFAFE" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: BRAND.primary }}>
            Creator plan — $9/month
          </p>
          <ul className="space-y-2">
            {[
              "25 market insights per month",
              "10 book outlines per month",
              "AI Book Copilot — 1 chapter preview",
              "Save research to projects",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: BRAND.gray }}>
                <Check className="h-4 w-4 flex-shrink-0" style={{ color: BRAND.primary }} />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <Button
          onClick={onUpgrade}
          className="text-sm font-semibold text-white px-8 h-11 rounded-full"
          style={{ background: BRAND.primary }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deep)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.primary)}
        >
          Upgrade to Creator
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, loading, subscriptionTier } = useAuth()
  const [activeSection, setActiveSection] = useState<string>("My Projects")

  if (loading) {
    return null
  }

  if (!user) {
    return <LandingPage />
  }

  const canAccessBookWriter = subscriptionTier === 'creator' || subscriptionTier === 'beta'

  const sections: Array<{ name: string; icon: LucideIcon; component: ComponentType; locked?: boolean }> = [
    { name: "My Projects", icon: FolderKanban, component: MyProjects },
    { name: "Book Research", icon: BookSearch, component: BookResearch },
    { name: "Book Outline", icon: PenTool, component: BookOutline },
    { name: "Social Media", icon: Share2, component: SocialMedia },
    { name: "Book Writer", icon: BookText, component: canAccessBookWriter ? BookWriter : () => <BookWriterGate onUpgrade={() => setActiveSection("Upgrade")} />, locked: !canAccessBookWriter },
    { name: "Upgrade", icon: Crown, component: Pricing },
  ]

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F5EEFF 0%, #FFFFFF 40%, #FFFFFF 100%)" }}>
      <Header />
      <main className="px-4 md:px-8 lg:px-12 py-3 md:py-5">
        <div className={`grid grid-cols-3 gap-3 mb-4 ${sections.length <= 5 ? "sm:grid-cols-5" : "sm:grid-cols-6"}`}>
          {sections.map((section) => (
            <Card
              key={section.name}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                activeSection === section.name
                  ? "bg-primary text-white shadow-lg scale-[1.02]"
                  : "bg-white/80 hover:bg-white"
              }`}
              onClick={() => setActiveSection(section.name)}
            >
              <div className="flex flex-col items-center justify-center p-3 space-y-1 relative">
                <section.icon className={`h-6 w-6 ${activeSection === section.name ? "text-white" : "text-primary"}`} />
                <span className="text-sm font-medium text-center">{section.name}</span>
                {section.locked && (
                  <Lock className={`h-3 w-3 absolute top-2 right-2 ${activeSection === section.name ? "text-white/70" : "text-gray-400"}`} />
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden bg-white/90 shadow-sm">
          {sections.map((section) => (
            <div key={section.name} style={{ display: activeSection === section.name ? "block" : "none" }}>
              <section.component />
            </div>
          ))}
        </Card>
      </main>
    </div>
  )
}
