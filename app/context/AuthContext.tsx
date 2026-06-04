"use client"

import { createContext, useContext, useEffect, useState } from "react"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  UserCredential
} from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { auth, db } from "../lib/firebase/config"

export interface FeatureFlags {
  coauthoring?: boolean
}

export type SubscriptionTier = 'free' | 'creator' | 'beta'

interface AuthContextType {
  user: User | null
  loading: boolean
  featureFlags: FeatureFlags
  subscriptionTier: SubscriptionTier
  signIn: (email: string, password: string) => Promise<UserCredential>
  signUp: (email: string, password: string) => Promise<UserCredential>
  signInWithGoogle: () => Promise<UserCredential>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({})
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)

        // Check if user document exists
        const userDoc = await getDoc(doc(db, 'users', user.uid))

        if (!userDoc.exists()) {
          // Create new user document if it doesn't exist
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName,
            isPremium: false,
            subscriptionTier: 'free',
            operationsCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          setFeatureFlags({})
        } else {
          const data = userDoc.data()
          setFeatureFlags(data?.featureFlags ?? {})
          setSubscriptionTier((data?.subscriptionTier as SubscriptionTier) ?? 'free')
        }
      } else {
        setUser(null)
        setFeatureFlags({})
        setSubscriptionTier('free')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, featureFlags, subscriptionTier, signIn, signUp, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
