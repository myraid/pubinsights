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
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './config';
import type { Project, BookOutline, RelatedBook, SearchHistory, ContentHistory, AmazonBook, TrendData } from '../types/firebase';

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

    const projectData = {
      userId,
      name: name.trim(),
      bookOutlines: [],
      relatedBooks: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
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
      relatedBooks: []
    } as Project;
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
      return { 
        id: docSnap.id, 
        ...data,
        outlines: data.outlines?.map((outline: any) => ({
          ...outline,
          createdAt: outline.createdAt || Timestamp.now(),
          outline: outline.outline || {
            Title: '',
            Chapters: []
          }
        })) || [],
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as Project;
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
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        bookOutlines: data.bookOutlines || [],
        relatedBooks: data.relatedBooks || []
      } as Project;
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
export const saveUserSearch = async (userId: string, keyword: string, books: AmazonBook[], trendData: TrendData) => {
  try {
    const searchHistoryRef = collection(db, 'searchHistory');
    const searchData = {
      userId,
      keyword,
      timestamp: Date.now(),
      books,
      trendData,
      searchType: trendData.searchType || 'general',
      generatedContent: trendData.generatedContent || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Add to searchHistory collection
    await addDoc(searchHistoryRef, searchData);

    // Also save to user's searches for quick access
    const userSearchRef = doc(db, 'users', userId, 'searches', keyword);
    await setDoc(userSearchRef, {
      ...searchData,
      lastAccessed: Timestamp.now()
    });

    return searchData;
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

interface SearchHistoryItem {
  keyword: string;
  timestamp: number;
  books: AmazonBook[];
  trendData: TrendData;
}

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
export const saveOutlineHistory = async (userId: string, outline: any) => {
  try {
    const outlineHistoryRef = collection(db, 'outlineHistory');
    
    // Create new outline history document
    const newOutline = {
      userId,
      ...outline,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Add new outline to history collection`
    await addDoc(outlineHistoryRef, newOutline);

   
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
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
      .slice(0, 10);
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
    // Get the user's search document for this keyword
    const userSearchRef = doc(db, 'users', userId, 'searches', keyword);
    const searchDoc = await getDoc(userSearchRef);
    
    if (!searchDoc.exists()) {
      return null;
    }

    const data = searchDoc.data();
    return {
      insights: data.generatedContent || [],
      timestamp: data.timestamp,
      lastAccessed: data.lastAccessed?.toDate()
    };
  } catch (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }
};

export const addOutlineToProject = async (projectId: string, title: string, outline: any) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    // Replace existing outline with new one
    const updatedOutlines = [{
      title,
      outline: {
        Title: outline.outline.Title,
        Chapters: outline.outline.Chapters.map((chapter: any) => ({
          Chapter: chapter.Chapter,
          Title: chapter.Title,
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

export const addMarketResearchToProject = async (projectId: string, researchData: any) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) throw new Error('Project not found');

    const projectData = projectDoc.data();
    const research = projectData.research || [];

    research.push({
      ...researchData,
      createdAt: Timestamp.now(),
    });

    await updateDoc(projectRef, {
      research,
      updatedAt: Timestamp.now(),
    });

    return true;
  } catch (error) {
    console.error('Error adding market research to project:', error);
    throw error;
  }
}; 