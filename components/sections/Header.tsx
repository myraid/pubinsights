"use client"

import Image from "next/image"
import { useAuth } from "@/app/context/AuthContext"
import { Button } from "@/components/ui/button"
import { UserCircle } from "lucide-react"

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-gradient-to-b from-purple-50/90 via-white to-white border-b border-purple-100/70">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="mb-4 md:mb-0">
            <Image
              src="/images/logo.png"
              alt="Publisher Insights"
              width={600}
              height={240}
              className="w-auto h-20 md:h-24 drop-shadow-sm"
            />
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm ring-1 ring-purple-100">
                <UserCircle className="h-7 w-7 text-purple-600" />
                <span className="text-base font-medium text-purple-800">{user.username}</span>
              </div>
              <Button onClick={logout}>
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

