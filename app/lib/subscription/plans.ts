export type PlanId = "freemium" | "creator" | "pro"

export interface PlanDefinition {
  id: PlanId
  name: string
  priceLabel: string
  description: string
  limits: {
    bookRequests: number
    outlineGenerations: number
    socialMedia: boolean
  }
  highlights: string[]
  ctaLabel: string
}

export const PLANS: PlanDefinition[] = [
  {
    id: "freemium",
    name: "Freemium",
    priceLabel: "$0",
    description: "Explore the product with a light monthly allowance.",
    limits: {
      bookRequests: 5,
      outlineGenerations: 3,
      socialMedia: false
    },
    highlights: [
      "5 book requests / month",
      "3 outline generations / month",
      "No social media ads"
    ],
    ctaLabel: "Start Free"
  },
  {
    id: "creator",
    name: "Creator",
    priceLabel: "$9.99",
    description: "For authors validating topics and building momentum.",
    limits: {
      bookRequests: 25,
      outlineGenerations: 25,
      socialMedia: false
    },
    highlights: [
      "25 book requests / month",
      "25 outline generations / month",
      "Email support"
    ],
    ctaLabel: "Choose Creator"
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$19.99",
    description: "For serious nonfiction creators and teams.",
    limits: {
      bookRequests: 100,
      outlineGenerations: 100,
      socialMedia: true
    },
    highlights: [
      "100 book requests / month",
      "100 outline generations / month",
      "Social media ad generation"
    ],
    ctaLabel: "Go Pro"
  }
]
