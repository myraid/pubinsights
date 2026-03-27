"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { updateProfile } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { db } from "@/app/lib/firebase/config"

const BRAND = {
  deep: "#8400B8",
  primary: "#9900CC",
  bg: "#F5EEFF",
  gray: "#6E6E6E",
  accent: "#AA00DD",
} as const

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
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {/* ─── Left panel — brand copy ──────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${BRAND.deep} 0%, ${BRAND.primary} 60%, ${BRAND.accent} 100%)` }}
      >
        {/* Decorative circle */}
        <div
          className="absolute top-[-80px] right-[-80px] w-[360px] h-[360px] rounded-full opacity-10"
          style={{ background: "#FFFFFF" }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[280px] h-[280px] rounded-full opacity-10"
          style={{ background: "#FFFFFF" }}
        />

        {/* Logo */}
        <Image
          src="/images/logo.png"
          alt="PubInsights"
          width={800}
          height={240}
          className="w-auto h-12 brightness-0 invert relative z-10"
        />

        {/* Hero copy */}
        <div className="relative z-10">
          <h2
            className="text-4xl font-black text-white mb-4 leading-tight [font-family:var(--font-playfair,Georgia,serif)]"
          >
            Research smarter.<br />Publish with confidence.
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Amazon market data, AI-powered insights, and book outlines — all in one place for indie authors.
          </p>

          {/* Mini feature list */}
          <div className="mt-10 space-y-3">
            {[
              "Real BSR & sales estimates",
              "Google + YouTube trend signals",
              "AI-generated book outlines",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-white/80 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-xs">© 2025 PubInsights</p>
      </div>

      {/* ─── Right panel — auth form ──────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        style={{ background: BRAND.bg }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Image
            src="/images/logo.png"
            alt="PubInsights"
            width={800}
            height={240}
            className="w-auto h-12"
          />
        </div>

        {/* Auth card */}
        <div
          className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8"
          style={{ boxShadow: "0 8px 40px rgba(153,0,204,0.12)" }}
        >
          {/* Toggle tabs */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ background: BRAND.bg }}
          >
            {(["login", "signup"] as const).map((mode) => {
              const active = (mode === "login") === isLogin
              return (
                <button
                  key={mode}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                  style={{
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? BRAND.primary : BRAND.gray,
                    boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  }}
                  onClick={() => { setIsLogin(mode === "login"); setError("") }}
                  disabled={loading}
                >
                  {mode === "login" ? "Sign in" : "Sign up"}
                </button>
              )
            })}
          </div>

          <h1
            className="text-xl font-bold mb-6 [font-family:var(--font-playfair,Georgia,serif)]"
            style={{ color: BRAND.deep }}
          >
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm border" style={{ background: "#FFF1F2", borderColor: "#FECDD3", color: "#9F1239" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold" style={{ color: BRAND.gray }}>
                  Full name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  className="h-10 text-sm bg-white"
                  style={{
                    borderColor: "#DDD0EC",
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold" style={{ color: BRAND.gray }}>
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 text-sm bg-white"
                style={{
                  borderColor: "#DDD0EC",
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold" style={{ color: BRAND.gray }}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 text-sm bg-white"
                style={{
                  borderColor: "#DDD0EC",
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 mt-2"
              disabled={loading}
              style={{
                background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.deep} 100%)`,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              }}
            >
              {loading ? "Please wait..." : (isLogin ? "Sign in" : "Create account")}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "#EEE0F8" }} />
            <span className="text-xs" style={{ color: BRAND.gray }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#EEE0F8" }} />
          </div>

          {/* Google sign-in */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 text-sm font-medium rounded-xl flex items-center gap-3 bg-white transition-all hover:shadow-sm"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              borderColor: "#DDD0EC",
              color: BRAND.gray,
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            }}
          >
            {/* Google G mark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            {loading ? "Please wait..." : "Continue with Google"}
          </Button>

          {/* Mode toggle text */}
          <p className="mt-6 text-center text-xs" style={{ color: BRAND.gray }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError("") }}
              className="font-semibold underline underline-offset-2 transition-colors"
              style={{ color: BRAND.primary }}
              disabled={loading}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
