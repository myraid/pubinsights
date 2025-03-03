import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  isPremium: boolean;
  operationsCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  bookOutlines: BookOutline[];
  relatedBooks: RelatedBook[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
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