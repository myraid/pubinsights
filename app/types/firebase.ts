import { Timestamp } from 'firebase/firestore';
import type { AmazonBook, TrendData } from '@/types';

interface Chapter {
  Title: string;
  Content: string[];
  Chapter: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  searches?: string[];
  subscriptionTier: 'free' | 'creator';
  subscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  usage?: Record<string, { insights?: number; outlines?: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialContentItem {
  type: 'post' | 'ad';
  platform: string;
  content: string;
}

export interface ProjectSocialContent {
  title: string;
  contentType: 'ad' | 'post';
  items: SocialContentItem[];
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  books?: string[];
  research?: {
    keyword: string;
    trendData: TrendData;
    books: AmazonBook[];
    marketIntelligence?: {
      rating: number;
      insights: string[];
      pros: string[];
      cons: string[];
      title_suggestion: string;
    } | null;
  }[];
  socialContent?: ProjectSocialContent[];
}

export interface BookOutline {
  id: string;
  userId: string;
  projectId?: string;
  content: string;
  createdAt: Timestamp;
}

export interface RelatedBook {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  author: string;
  description: string;
  imageUrl?: string;
  createdAt: Timestamp;
}

export interface SearchHistory {
  id: string;
  userId: string;
  query: string;
  trendsData: unknown;
  booksData: unknown;
  createdAt: Timestamp;
}

export interface ContentHistory {
  id: string;
  userId: string;
  projectId?: string;
  content: string;
  type: 'social' | 'outline';
  createdAt: Timestamp;
}

export interface SearchHistoryItem {
  keyword: string;
  timestamp: number;
  books: AmazonBook[];
  trendData: TrendData;
  marketIntelligence?: {
    rating: number;
    insights: string[];
    pros: string[];
    cons: string[];
    title_suggestion: string;
  } | null;
}

export interface OutlineHistoryItem {
  title: string;
  chapters: Chapter[];
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export interface ProjectOutline {
  title: string;
  outline: {
    Title: string;
    Chapters: {
      Chapter: number;
      Title: string;
      [key: string]: string[] | string | number;
    }[];
  };
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export interface OutlineResponse {
  outline: {
    Title: string;
    Chapters: {
      Chapter: number;
      Title: string;
      [key: string]: string[] | string | number;
    }[];
  };
} 