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
      content_gaps: string[];
      title_suggestion: string;
      cover_quality_score?: number;
      cover_quality_summary?: string;
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
    content_gaps: string[];
    title_suggestion: string;
    cover_quality_score?: number;
    cover_quality_summary?: string;
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

// Book Writer types
export const DEFAULT_TARGET_WORDS_PER_CHAPTER = 2500;

export interface Manuscript {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  status: 'in_progress' | 'complete';
  totalChapters: number;
  completedChapters: number;
  totalWordCount: number;
  outlineSnapshot: {
    Title: string;
    Chapters: { Chapter: number; Title: string; Summary?: string; KeyTopics?: string[] }[];
  };
  styleProfile?: StyleProfile;
  /** Default per-chapter word budget the planner targets when breaking chapters into sections. */
  targetWordsPerChapter?: number;
  /** Free-form author guidance applied to every chapter plan and section draft. */
  aiContext?: string;
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
}

export interface ChapterDocument {
  chapterNumber: number;
  title: string;
  status: 'not_started' | 'planning' | 'writing' | 'complete';
  totalSections: number;
  completedSections: number;
  content: string;
  wordCount: number;
  outlineContext: { summary: string; keyTopics: string[] };
  chapterSummary?: string;
  sectionPlan: SectionPlanEntry[];
  aiGenerated: boolean;
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
}

export interface SectionComment {
  id: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  authorFeedback: string;
  status: 'pending' | 'resolved';
  createdAt: { seconds: number; nanoseconds: number };
}

export interface RevisionEntry {
  version: number;
  content: string;
  resolvedComments: string[];
  createdAt: { seconds: number; nanoseconds: number };
}

export interface SectionPlanEntry {
  sectionNumber: number;
  title: string;
  outlineContext: string;
  estimatedWords: number;
}

export interface Section {
  id: string;
  sectionNumber: number;
  title: string;
  status: 'not_started' | 'generating' | 'review' | 'approved';
  content: string;
  wordCount: number;
  outlineContext: string;
  estimatedWords: number;
  comments: SectionComment[];
  revisionCount: number;
  revisionHistory: RevisionEntry[];
  approvedSummary?: string;
  lastParagraph?: string;
  authorNotes: string;
  aiGenerated: boolean;
  approvedAt?: { seconds: number; nanoseconds: number };
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
}

export interface StyleProfile {
  tone: string;
  vocabulary: string;
  sentenceStructure: string;
  narrativeApproach: string;
  pointOfView: string;
  extractedFromSections: string[];
  authorOverrides?: string;
  lastExtractedAt: { seconds: number; nanoseconds: number };
}

export interface ManuscriptSnapshot {
  manuscriptId: string;
  title: string;
  totalChapters: number;
  totalWordCount: number;
  status: 'in_progress' | 'complete';
  chapters: {
    chapterNumber: number;
    title: string;
    wordCount: number;
    status: string;
  }[];
  savedAt: { seconds: number; nanoseconds: number };
} 