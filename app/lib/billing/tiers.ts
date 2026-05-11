export type SubscriptionTier = 'free' | 'creator' | 'beta'

export interface TierLimits {
  insights: number
  outlines: number
  sections: number
  social: number
  unlimited: boolean
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    insights: 3,
    outlines: 1,
    sections: 15,
    social: 5,
    unlimited: false,
  },
  creator: {
    insights: 25,
    outlines: 10,
    sections: 200,
    social: 50,
    unlimited: false,
  },
  beta: {
    insights: 9999,
    outlines: 9999,
    sections: 9999,
    social: 9999,
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
