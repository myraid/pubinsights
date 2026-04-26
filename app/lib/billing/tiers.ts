export type SubscriptionTier = 'free' | 'creator' | 'beta'

export interface TierLimits {
  insights: number
  outlines: number
  social_images: number
  unlimited: boolean
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    insights: 3,
    outlines: 2,
    social_images: 10,
    unlimited: false,
  },
  creator: {
    insights: 25,
    outlines: 15,
    social_images: 100,
    unlimited: false,
  },
  beta: {
    insights: 9999,
    outlines: 9999,
    social_images: 9999,
    unlimited: true,
  },
}

export const TIER_DISPLAY: Record<SubscriptionTier, { name: string; price: number; priceLabel: string }> = {
  free: { name: 'Free', price: 0, priceLabel: '$0 / month' },
  creator: { name: 'Creator', price: 9, priceLabel: '$9 / month' },
  beta: { name: 'Beta', price: 0, priceLabel: 'Beta Access' },
}

export function getMonthKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
