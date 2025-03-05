import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "./context/AuthContext"
import type React from "react"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PubInsights - Book Research and Publishing Insights",
  description: "Research book trends, generate outlines, and get publishing insights",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <AuthProvider>
          <div className="min-h-full">{children}</div>
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}

