export type SubscriptionTier = 'free' | 'creator'

export interface TierLimits {
  insights: number
  outlines: number
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    insights: 3,
    outlines: 2,
  },
  creator: {
    insights: 25,
    outlines: 15,
  },
}

export const TIER_DISPLAY: Record<SubscriptionTier, { name: string; price: number; priceLabel: string }> = {
  free: { name: 'Free', price: 0, priceLabel: '$0 / month' },
  creator: { name: 'Creator', price: 9, priceLabel: '$9 / month' },
}

export function getMonthKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
