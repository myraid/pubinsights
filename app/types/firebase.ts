import { Timestamp } from 'firebase/firestore';
import type { AmazonBook, TrendData } from './index';

interface Chapter {
  Title: string;
  Content: string[];
  Chapter: number;
}

interface OutlineData {
  Title: string;
  Chapters: Chapter[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  searches?: string[];
  createdAt: Date;
  updatedAt: Date;
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
  trendsData: any;
  booksData: any;
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