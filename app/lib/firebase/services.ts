import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { db } from './config';
import type { BookOutline, ContentHistory } from '../../types/firebase';
import type { AmazonBook, TrendData } from '@/types';

// Project Services
export const createProject = async (userId: string, name: string, description?: string) => {
  if (!userId) throw new Error('User ID is required')
  if (!name.trim()) throw new Error('Project name is required')

  try {
    // Check if project with same name exists
    const existingProjects = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      where('name', '==', name.trim())
    );
    const existingSnapshot = await getDocs(existingProjects);
    
    if (!existingSnapshot.empty) {
      throw new Error('A project with this name already exists');
    }

    const createdAt = Timestamp.now()
    const projectData = {
      userId,
      name: name.trim(),
      bookOutlines: [],
      relatedBooks: [],
      createdAt,
      updatedAt: createdAt
    };

    if (description?.trim()) {
      Object.assign(projectData, { description: description.trim() });
    }

    console.log('Creating project with data:', projectData);
    const docRef = await addDoc(collection(db, 'projects'), projectData);
    console.log('Project created with ID:', docRef.id);
    
    return {
      id: docRef.id,
      ...projectData,
      bookOutlines: [], // Ensure arrays are initialized
      relatedBooks: [],
      createdAt: createdAt.toDate(),
      updatedAt: createdAt.toDate()
    };
  } catch (error) {
    console.error('Error in createProject:', error);
    throw error;
  }
};

export const getProject = async (projectId: string) => {
  try {
    const docRef = doc(db, 'projects', projectId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const outlines = Array.isArray(data.outlines) ? data.outlines : [];
      return {
        id: docSnap.id,
        name: typeof data.name === 'string' ? data.name : '',
        description: typeof data.description === 'string' ? data.description : undefined,
        userId: typeof data.userId === 'string' ? data.userId : '',
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        bookOutlines: data.bookOutlines || [],
        relatedBooks: data.relatedBooks || [],
        research: data.research || [],
        socialContent: Array.isArray(data.socialContent) ? data.socialContent : [],
        outlines: outlines.map((outline: Record<string, unknown>) => ({
          ...outline,
          createdAt: (outline as { createdAt?: Timestamp }).createdAt || Timestamp.now(),
          outline: (outline as { outline?: { Title?: string; Chapters?: unknown[] } }).outline || {
            Title: '',
            Chapters: []
          }
        }))
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
};

export const getUserProjects = async (userId: string) => {
  try {
    if (!userId) {
      console.error('getUserProjects called with no userId');
      throw new Error('User ID is required to fetch projects');
    }
    
    console.log('Fetching projects for user:', userId);
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    console.log('Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    console.log('Query executed. Found projects:', querySnapshot.size);
    
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Processing project:', doc.id, data);
      return {
        id: doc.id,
        name: typeof data.name === 'string' ? data.name : '',
        description: typeof data.description === 'string' ? data.description : undefined,
        userId: typeof data.userId === 'string' ? data.userId : '',
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        bookOutlines: data.bookOutlines || [],
        relatedBooks: data.relatedBooks || [],
        research: data.research || [],
        socialContent: Array.isArray(data.socialContent) ? data.socialContent : [],
        outlines: Array.isArray(data.outlines) ? data.outlines : []
      };
    });
    
    console.log('Processed all projects:', projects);
    return projects;
  } catch (error) {
    console.error('Error in getUserProjects:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
};

// Book Outline Services
export const createBookOutline = async (userId: string, content: string, projectId?: string) => {
  // First, increment the user's operations count
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    operationsCount: increment(1)
  });

  const outlineData = {
    userId,
    projectId,
    content,
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'bookOutlines'), outlineData);
  
  if (projectId) {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      bookOutlines: increment(1),
      updatedAt: Timestamp.now()
    });
  }

  return { id: docRef.id, ...outlineData };
};

export const getRecentBookOutlines = async (userId: string) => {
  const q = query(
    collection(db, 'bookOutlines'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BookOutline[];
};

// Search History Services
interface SearchHistoryItem {
  id: string;
  userId: string;
  keyword: string;
  timestamp: number;
  books: AmazonBook[];
  trendData: TrendData;
  searchType: string;
  generatedContent: unknown;
  marketIntelligence: {
    rating: number;
    insights: string[];
    content_gaps: string[];
    title_suggestion: string;
    cover_quality_score?: number;
    cover_quality_summary?: string;
  } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const saveUserSearch = async (
  userId: string,
  keyword: string,
  books: AmazonBook[],
  trendData: TrendData,
  marketIntelligence?: {
    rating: number;
    insights: string[];
    content_gaps: string[];
    title_suggestion: string;
    cover_quality_score?: number;
    cover_quality_summary?: string;
  } | null
) => {
  try {
    const searchHistoryRef = collection(db, 'searchHistory');
    const searchData = {
      userId,
      keyword,
      timestamp: Date.now(),
      books,
      trendData,
      searchType: 'general',
      generatedContent: null,
      marketIntelligence: marketIntelligence || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Add to searchHistory collection
    const docRef = await addDoc(searchHistoryRef, searchData);
    return { id: docRef.id, ...searchData } as SearchHistoryItem;
  } catch (error) {
    console.error('Error saving search:', error);
    throw error;
  }
};

export const getUserSearches = async (userId: string, searchType?: string): Promise<SearchHistoryItem[]> => {
  try {
    const searchHistoryRef = collection(db, 'searchHistory');
    let q = query(
      searchHistoryRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    if (searchType) {
      q = query(q, where('searchType', '==', searchType));
    }

    q = query(q, limit(10));
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SearchHistoryItem[];
  } catch (error) {
    console.error('Error fetching search history:', error);
    throw error;
  }
};

// Content History Services
export const saveContentHistory = async (userId: string, content: string, type: 'social' | 'outline', projectId?: string) => {
  const contentData = {
    userId,
    projectId,
    content,
    type,
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'contentHistory'), contentData);
  return { id: docRef.id, ...contentData };
};

export const getRecentContent = async (userId: string, type: 'social' | 'outline') => {
  const q = query(
    collection(db, 'contentHistory'),
    where('userId', '==', userId),
    where('type', '==', type),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ContentHistory[];
};

// Related Books Services
export const addRelatedBook = async (
  userId: string,
  bookData: { title: string; author: string; description: string; imageUrl?: string },
  projectId?: string
) => {
  const relatedBookData = {
    userId,
    projectId,
    ...bookData,
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'relatedBooks'), relatedBookData);
  
  if (projectId) {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      relatedBooks: increment(1),
      updatedAt: Timestamp.now()
    });
  }

  return { id: docRef.id, ...relatedBookData };
};

export const addBooksToProject = async (projectId: string, keyword: string, books: AmazonBook[]) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    const research = projectData.research || [];
    
    // Add new research data with only books
    research.push({
      keyword,
      books
    });

    // Update project with new research data
    await updateDoc(projectRef, {
      research,
      updatedAt: Timestamp.now()
    });

    return true;
  } catch (error) {
    console.error('Error adding books to project:', error);
    throw error;
  }
};

// Outline History Services
type OutlinePayload = {
  title?: string;
  outline?: {
    Title?: string;
    Chapters?: Array<Record<string, unknown> | { Chapter: number; Title: string }>;
  };
};

export const saveOutlineHistory = async (userId: string, outline: OutlinePayload) => {
  try {
    const outlineHistoryRef = collection(db, 'outlineHistory');
    
    // Create new outline history document
    const newOutline = {
      userId,
      ...outline,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Add new outline to history collection
    const docRef = await addDoc(outlineHistoryRef, newOutline);
    return { id: docRef.id, ...newOutline };
  } catch (error) {
    console.error('Error saving outline history:', error);
    throw error;
  }
};

export const getOutlineHistory = async (userId: string) => {
  try {
    const outlineHistoryRef = collection(db, 'outlineHistory');
    const q = query(
      outlineHistoryRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting outline history:', error);
    throw error;
  }
};

export const deleteOutlineFromHistory = async (userId: string, outlineId: string) => {
  try {
    const outlineRef = doc(db, 'outlineHistory', outlineId);
    await deleteDoc(outlineRef);
    return true;
  } catch (error) {
    console.error('Error deleting outline from history:', error);
    throw error;
  }
};

export const getKeywordInsights = async (userId: string, keyword: string) => {
  try {
    // Get the search document from searchHistory collection
    const searchHistoryRef = collection(db, 'searchHistory');
    const q = query(
      searchHistoryRef,
      where('userId', '==', userId),
      where('keyword', '==', keyword)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const data = querySnapshot.docs[0].data();
    return {
      insights: data.generatedContent || [],
      marketIntelligence: data.marketIntelligence || null,
      timestamp: data.timestamp,
      lastAccessed: data.updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }
};

export const addOutlineToProject = async (projectId: string, title: string, outline: OutlinePayload) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    // Replace existing outline with new one
    const chapters = outline.outline?.Chapters ?? []
    const updatedOutlines = [{
      title,
      outline: {
        Title: outline.outline?.Title || title,
        Chapters: chapters.map((chapter: Record<string, unknown>) => ({
          Chapter: (chapter as { Chapter?: number }).Chapter ?? 0,
          Title: (chapter as { Title?: string }).Title ?? '',
          ...Object.fromEntries(
            Object.entries(chapter).filter(([key]) => !['Chapter', 'Title'].includes(key))
          )
        }))
      },
      createdAt: Timestamp.now()
    }];

    // Update project with new outline
    await updateDoc(projectRef, {
      outlines: updatedOutlines,
      updatedAt: Timestamp.now()
    });

    return true;
  } catch (error) {
    console.error('Error adding outline to project:', error);
    throw error;
  }
};

export const addMarketResearchToProject = async (projectId: string, researchData: {
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
}) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) {
      console.error('Project not found:', projectId);
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    console.log('Current project data:', projectData);

    // Create new research array with updated data
    const updatedResearch = [{
      ...researchData,
      createdAt: Timestamp.now()
    }];

    console.log('Attempting to update project with research:', updatedResearch);

    // Update project with new research array
    await updateDoc(projectRef, {
      research: updatedResearch,
      updatedAt: Timestamp.now()
    });

    console.log('Successfully updated project research');
    return true;
  } catch (error) {
    console.error('Error adding market research to project:', error);
    throw error;
  }
};

// Social Content Services
export const addSocialContentToProject = async (
  projectId: string,
  contentData: {
    title: string;
    contentType: 'ad' | 'post';
    items: { type: 'post' | 'ad'; platform: string; content: string }[];
  }
) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    const existing = Array.isArray(projectData.socialContent) ? projectData.socialContent : [];

    existing.push({
      ...contentData,
      createdAt: Timestamp.now()
    });

    await updateDoc(projectRef, {
      socialContent: existing,
      updatedAt: Timestamp.now()
    });

    return true;
  } catch (error) {
    console.error('Error adding social content to project:', error);
    throw error;
  }
};

// Migration function to move data from user subcollections to main collections
export const migrateToMainCollections = async (userId: string) => {
  try {
    // Migrate searches
    const userSearchesRef = collection(db, 'users', userId, 'searches');
    const searchesSnapshot = await getDocs(userSearchesRef);
    
    const searchPromises = searchesSnapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();
      const searchHistoryRef = collection(db, 'searchHistory');
      await addDoc(searchHistoryRef, {
        ...data,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await deleteDoc(docSnapshot.ref);
    });

    // Migrate outlines
    const userOutlinesRef = collection(db, 'users', userId, 'outlines');
    const outlinesSnapshot = await getDocs(userOutlinesRef);
    
    const outlinePromises = outlinesSnapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();
      const outlineHistoryRef = collection(db, 'outlineHistory');
      await addDoc(outlineHistoryRef, {
        ...data,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await deleteDoc(docSnapshot.ref);
    });

    await Promise.all([...searchPromises, ...outlinePromises]);
    return true;
  } catch (error) {
    console.error('Error migrating to main collections:', error);
    throw error;
  }
};

// ─── Manuscript / Book Writer Services ────────────────────────────────────────

export const createManuscript = async (
  projectId: string,
  userId: string,
  title: string,
  outlineSnapshot: {
    Title: string;
    Chapters: { Chapter: number; Title: string; Summary?: string; KeyTopics?: string[] }[];
  }
) => {
  const manuscriptsRef = collection(db, 'projects', projectId, 'manuscripts');
  const manuscriptDoc = await addDoc(manuscriptsRef, {
    projectId,
    userId,
    title,
    status: 'in_progress',
    totalChapters: outlineSnapshot.Chapters.length,
    completedChapters: 0,
    totalWordCount: 0,
    outlineSnapshot,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Create empty chapter docs
  const chaptersRef = collection(db, 'projects', projectId, 'manuscripts', manuscriptDoc.id, 'chapters');
  for (const ch of outlineSnapshot.Chapters) {
    await addDoc(chaptersRef, {
      chapterNumber: ch.Chapter,
      title: ch.Title,
      status: 'not_started',
      content: '',
      wordCount: 0,
      outlineContext: {
        summary: ch.Summary || '',
        keyTopics: ch.KeyTopics || [],
      },
      aiGenerated: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  return manuscriptDoc.id;
};

export const getProjectManuscripts = async (projectId: string) => {
  const q = query(
    collection(db, 'projects', projectId, 'manuscripts'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getManuscript = async (projectId: string, manuscriptId: string) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const getAllChapters = async (projectId: string, manuscriptId: string) => {
  const q = query(
    collection(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters'),
    orderBy('chapterNumber', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getChapter = async (projectId: string, manuscriptId: string, chapterId: string) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const saveChapter = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  data: { content?: string; wordCount?: number; status?: string; aiGenerated?: boolean }
) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const updateManuscriptProgress = async (
  projectId: string,
  manuscriptId: string,
  completedChapters: number,
  totalWordCount: number
) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId);
  await updateDoc(docRef, {
    completedChapters,
    totalWordCount,
    status: completedChapters > 0 ? 'in_progress' : 'in_progress',
    updatedAt: Timestamp.now(),
  });
};

// ── Section CRUD ──

export const createSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sections: { sectionNumber: number; title: string; outlineContext: string; estimatedWords: number }[]
) => {
  const chapRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId)
  const sectionsCol = collection(chapRef, 'sections')
  for (const sec of sections) {
    await addDoc(sectionsCol, {
      sectionNumber: sec.sectionNumber,
      title: sec.title,
      status: 'not_started',
      content: '',
      wordCount: 0,
      outlineContext: sec.outlineContext,
      estimatedWords: sec.estimatedWords,
      comments: [],
      revisionCount: 0,
      revisionHistory: [],
      authorNotes: '',
      aiGenerated: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }
}

export const getAllSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string
) => {
  const sectionsCol = collection(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId, 'sections')
  const q = query(sectionsCol, orderBy('sectionNumber', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getSection = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionId: string
) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId, 'sections', sectionId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export const saveSection = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionId: string,
  data: Record<string, unknown>
) => {
  const docRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId, 'sections', sectionId)
  await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() })
}

export const deleteSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string
) => {
  const sectionsCol = collection(db, 'projects', projectId, 'manuscripts', manuscriptId, 'chapters', chapterId, 'sections')
  const snap = await getDocs(sectionsCol)
  for (const d of snap.docs) {
    await deleteDoc(d.ref)
  }
}

// ── Style Profile ──

export const saveStyleProfile = async (
  projectId: string,
  manuscriptId: string,
  styleProfile: Record<string, unknown>
) => {
  const msRef = doc(db, 'projects', projectId, 'manuscripts', manuscriptId)
  await updateDoc(msRef, { styleProfile, updatedAt: Timestamp.now() })
}

// ── Save Manuscript to Project ──

export const saveManuscriptToProject = async (
  projectId: string,
  manuscript: Record<string, unknown>
) => {
  const projRef = doc(db, 'projects', projectId)
  await updateDoc(projRef, { manuscript, updatedAt: Timestamp.now() })
} 