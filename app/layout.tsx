import type { Metadata } from "next"
import { Inter, Playfair_Display, DM_Sans } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "./context/AuthContext"
import type React from "react"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-playfair",
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
})

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
      <body className={`${inter.className} ${playfair.variable} ${dmSans.variable} h-full`}>
        <AuthProvider>
          <div className="min-h-full">{children}</div>
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}

