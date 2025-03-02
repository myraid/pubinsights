"use client"

import Image from "next/image"
import { useAuth } from "../context/AuthContext"
import { Button } from "@/components/ui/button"
import { UserCircle } from "lucide-react"

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-gradient-to-b from-purple-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <Image
              src="/images/logo.png"
              alt="Publisher Insights"
              width={600}
              height={240}
              className="w-auto h-24 md:h-32"
            />
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserCircle className="h-8 w-8 text-purple-600" />
                <span className="text-lg font-medium text-purple-800">{user.username}</span>
              </div>
              <Button onClick={logout} className="bg-primary text-white hover:bg-primary/90">
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

