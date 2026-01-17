'use client'

import { useAuth } from "@/app/context/AuthContext"

export default function AuthButtons() {
  const { user, signInWithGoogle, logout } = useAuth()

  return (
    <div className="flex gap-4">
      {user ? (
        <div className="flex items-center gap-4">
          <span>Welcome, {user.displayName || user.email}</span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Sign in with Google
        </button>
      )}
    </div>
  )
} 