import { Timestamp } from 'firebase/firestore';
import type { AmazonBook, TrendData } from './index';

interface Chapter {
  title: string;
  content: string[];
}

interface OutlineData {
  title: string;
  chapters: Chapter[];
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
    trendData: any;
    books: any[];
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
  outline: OutlineData;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export interface OutlineResponse {
  outline: OutlineData;
} 