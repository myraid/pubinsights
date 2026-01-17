"use client"

import { useState } from "react"
import { useAuth } from "./context/AuthContext"
import { Card } from "@/components/ui/card"
import BookResearch from "@/components/sections/BookResearch"
import BookOutline from "@/components/sections/BookOutline"
import SocialMedia from "@/components/sections/SocialMedia"
import MyProjects from "@/components/sections/MyProjects"
import LandingPage from "@/components/sections/LandingPage"
import Header from "@/components/sections/Header"
import { SearchIcon as BookSearch, PenTool, Share2, FolderKanban } from "lucide-react"

export default function Home() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<string>("My Projects")

  if (!user) {
    return <LandingPage />
  }

  const sections = [
    { name: "My Projects", icon: FolderKanban, component: MyProjects },
    { name: "Book Research", icon: BookSearch, component: BookResearch },
    { name: "Book Outline", icon: PenTool, component: BookOutline },
    { name: "Social Media", icon: Share2, component: SocialMedia },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Header />
      <main className="container mx-auto p-4 md:p-8 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {sections.map((section) => (
            <Card
              key={section.name}
              className={`cursor-pointer transition-all duration-200 ${
                activeSection === section.name
                  ? "bg-primary text-white shadow-lg scale-105"
                  : "bg-white hover:bg-gray-50"
              }`}
              onClick={() => setActiveSection(section.name)}
            >
              <div className="flex flex-col items-center justify-center p-4 space-y-2">
                <section.icon className={`h-8 w-8 ${activeSection === section.name ? "text-white" : "text-primary"}`} />
                <span className="font-medium text-center">{section.name}</span>
              </div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden bg-white shadow-sm p-4">
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

