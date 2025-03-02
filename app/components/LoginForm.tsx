"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { Card, Title, TextInput } from "@tremor/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function LoginForm({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const [isLogin, setIsLogin] = useState(initialMode === "login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { login, signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = true // Always succeed for testing
    if (success) {
      await login(username, password)
    }
  }

  const handleGoogleSignIn = () => {
    // Implement Google Sign-In logic here
    console.log("Google Sign-In clicked")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Card className="max-w-lg w-full p-6 bg-white shadow-sm">
        <div className="flex justify-center mb-6">
          <Image
            src="/images/logo.png"
            alt="Publisher Insights"
            width={800}
            height={240}
            className="w-auto h-24 md:h-32"
          />
        </div>
        <Title className="text-center mb-6 text-primary">{isLogin ? "Login" : "Sign Up"} to Publisher Insights</Title>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="border-primary"
          />
          <TextInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-primary"
          />
          <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90">
            {isLogin ? "Login" : "Sign Up"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <span className="text-gray-500">or</span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full mt-4 bg-white text-primary hover:bg-primary/10"
          onClick={handleGoogleSignIn}
        >
          Sign in with Google
        </Button>

        <button onClick={() => setIsLogin(!isLogin)} className="mt-4 text-primary hover:underline w-full text-center">
          {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
        </button>
      </Card>
    </div>
  )
}

