"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User } from "../types"

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  signup: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if there's a user in localStorage
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    // Always succeed for testing
    const newUser = { username }
    setUser(newUser)
    localStorage.setItem("user", JSON.stringify(newUser))
    return true
  }

  const signup = async (username: string, password: string) => {
    try {
      const hashedPassword = await hashPassword(password)
      await saveUser(username, hashedPassword)
      const newUser = { username }
      setUser(newUser)
      localStorage.setItem("user", JSON.stringify(newUser))
      return true
    } catch (error) {
      console.error("Signup error:", error)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return <AuthContext.Provider value={{ user, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Helper functions
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function checkAuthentication(username: string, passwordHash: string): Promise<boolean> {
  // In a real app, this would check against a database
  const users = await loadUsers()
  return users[username] === passwordHash
}

async function saveUser(username: string, passwordHash: string): Promise<void> {
  const users = await loadUsers()
  users[username] = passwordHash
  localStorage.setItem("users", JSON.stringify(users))
}

async function loadUsers(): Promise<Record<string, string>> {
  const users = localStorage.getItem("users")
  return users ? JSON.parse(users) : {}
}

