export interface TrendData {
  trends: {
    [platform: string]: {
      dates: string[]
      values: number[]
    }
  }
  insights: string
}

export interface AmazonBook {
  id: string
  title: string
  author: string
  price: number
  image: string
  bsr: {
    rank: number
    category: string
  }[]
  categories: string[]
  rating: number
  reviewCount: number
  publisher: string
}

