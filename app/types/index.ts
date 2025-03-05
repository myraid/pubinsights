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
  id: string;
  title: string;
  author: string;
  price: number;
  image: string;
  bsr: Array<{
    rank: number;
    category: string;
  }>;
  categories: string[];
  rating: number;
  reviewCount: number;
  publisher: string;
  publicationYear?: number;
  isIndie: boolean;
} 