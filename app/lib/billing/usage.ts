import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getMonthKey, TIER_LIMITS } from './tiers'
import type { SubscriptionTier } from './tiers'

export interface UsageCheckResult {
  allowed: boolean
  tier: SubscriptionTier
  current: number
  limit: number
}

/**
 * Checks if the user is within their monthly limit for the given operation type.
 * If allowed, atomically increments the counter.
 * Call this before the expensive AI operation.
 */
export async function checkAndIncrementUsage(
  userId: string,
  type: 'insights' | 'outlines' | 'sections' | 'social'
): Promise<UsageCheckResult> {
  const monthKey = getMonthKey()
  const userRef = adminDb.collection('users').doc(userId)
  const userDoc = await userRef.get()

  // DEV: skip usage limits on localhost
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true, tier: 'free', current: 0, limit: 999 }
  }

  if (!userDoc.exists) {
    // Auto-create user doc with free tier defaults
    await userRef.set({
      subscriptionTier: 'free',
      subscriptionStatus: null,
      usage: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  const data = (userDoc.exists ? userDoc.data() : {}) as Record<string, unknown>
  const tier = (data.subscriptionTier ?? 'free') as SubscriptionTier
  const tierConfig = TIER_LIMITS[tier]

  // Beta users have unlimited access — skip limit check
  if (tierConfig.unlimited) {
    return { allowed: true, tier, current: 0, limit: 9999 }
  }

  const monthUsage = ((data.usage ?? {}) as Record<string, Record<string, number>>)[monthKey] ?? {}
  const current = (monthUsage[type] ?? 0)
  const limit = tierConfig[type]

  if (current >= limit) {
    return { allowed: false, tier, current, limit }
  }

  await userRef.update({
    [`usage.${monthKey}.${type}`]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { allowed: true, tier, current: current + 1, limit }
}

/**
 * Returns the current month's usage and limits for a user.
 * Used by the /api/usage endpoint and the Pricing component.
 */
export async function getUserUsage(userId: string) {
  const monthKey = getMonthKey()
  const userDoc = await adminDb.collection('users').doc(userId).get()

  if (!userDoc.exists) return null

  const data = userDoc.data()!
  const tier = (data.subscriptionTier ?? 'free') as SubscriptionTier
  const monthUsage = (data.usage ?? {})[monthKey] ?? {}

  return {
    tier,
    subscriptionStatus: (data.subscriptionStatus as string) ?? null,
    insights: {
      current: (monthUsage.insights as number) ?? 0,
      limit: TIER_LIMITS[tier].insights,
    },
    outlines: {
      current: (monthUsage.outlines as number) ?? 0,
      limit: TIER_LIMITS[tier].outlines,
    },
    sections: {
      current: (monthUsage.sections as number) ?? 0,
      limit: TIER_LIMITS[tier].sections,
    },
    social: {
      current: (monthUsage.social as number) ?? 0,
      limit: TIER_LIMITS[tier].social,
    },
  }
}
