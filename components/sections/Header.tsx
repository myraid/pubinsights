"use client"

import Image from "next/image"
import { useAuth } from "@/app/context/AuthContext"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

function getInitial(user: { displayName?: string | null; email?: string | null }): string {
  const source = user.displayName || user.email || "U"
  return source.charAt(0).toUpperCase()
}

function getDisplayName(user: { displayName?: string | null; email?: string | null }): string {
  return user.displayName || user.email || "User"
}

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100/60"
      style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-18">

          {/* Logo — left anchor */}
          <div className="flex items-center flex-shrink-0">
            <Image
              src="/images/logo.png"
              alt="Publisher Insights"
              width={600}
              height={240}
              className="w-auto h-10 md:h-14 drop-shadow-sm"
              priority
            />
          </div>

          {/* User controls — right anchor */}
          {user && (
            <div className="flex items-center gap-3">

              {/* Avatar + name */}
              <div className="flex items-center gap-2.5">
                {/* Avatar circle */}
                <div
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-semibold select-none"
                  style={{ backgroundColor: BRAND.primary }}
                  aria-hidden="true"
                >
                  {getInitial(user)}
                </div>

                {/* Display name — hidden on small screens */}
                <span
                  className="hidden sm:block text-sm font-medium max-w-[160px] truncate"
                  style={{ color: BRAND.deep }}
                >
                  {getDisplayName(user)}
                </span>
              </div>

              {/* Divider — hidden on small screens */}
              <div
                className="hidden sm:block w-px h-5 flex-shrink-0"
                style={{ backgroundColor: "#E8D5F5" }}
                aria-hidden="true"
              />

              {/* Sign Out — ghost button, subtle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="flex-shrink-0 gap-1.5 px-2 sm:px-3 hover:bg-purple-50/70 transition-colors"
                style={{ color: BRAND.gray }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = BRAND.deep
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = BRAND.gray
                }}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline text-sm">Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
