interface TimelineDataPoint {
  time: string
  formattedTime: string
  formattedAxisTime: string
  value: number[]
  hasData: boolean[]
  formattedValue: string[]
}

export interface TimelineData {
  time: string
  value: number
  formattedTime: string
  formattedValue: string[]
}

export interface TrendData {
  webSearch: {
    timelineData: Array<{
      time: string;
      value: number[];
    }>;
  };
  youtube: {
    timelineData: Array<{
      time: string;
      value: number[];
    }>;
  };
}

export interface AmazonBook {
  position: number;
  url: string;
  asin: string;
  price: number;
  title: string;
  rating: number;
  image_url: string;
  categories: string[];
  bsr: number;
  publication_date: string;
  publisher: string | null;
  manufacturer: string | null;
  description: string;
  product_details: any | null;
  reviews: any[];
  reviews_count: number;
  rating_stars_distribution: any[];
  review_ai_summary: string | null;
  currency: string;
  is_prime: boolean;
} 