"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { Card, Title, TextInput } from "@tremor/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { updateProfile } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "@/app/lib/firebase/config"

export default function LoginForm({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const [isLogin, setIsLogin] = useState(initialMode === "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (isLogin) {
        // Handle login
        await signIn(email, password)
      } else {
        // Handle signup
        const userCredential = await signUp(email, password)
        
        // Update user profile with full name
        if (userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: fullName
          })

          // Create user document with additional info
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: userCredential.user.email,
            displayName: fullName,
            isPremium: false,
            operationsCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setError("")
      setLoading(true)
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
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

        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <TextInput
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={!isLogin}
              className="border-primary"
            />
          )}
          <TextInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <Button 
            type="submit" 
            className="w-full bg-primary text-white hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Please wait..." : (isLogin ? "Login" : "Sign Up")}
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
          disabled={loading}
        >
          {loading ? "Please wait..." : "Sign in with Google"}
        </Button>

        <button 
          onClick={() => {
            setIsLogin(!isLogin)
            setError("")
          }} 
          className="mt-4 text-primary hover:underline w-full text-center"
          disabled={loading}
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
        </button>
      </Card>
    </div>
  )
}

