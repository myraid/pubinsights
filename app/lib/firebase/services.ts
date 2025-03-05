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
  setDoc
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
export const saveSearchHistory = async (userId: string, query: string, trendsData: any, booksData: any) => {
  const searchData = {
    userId,
    query,
    trendsData,
    booksData,
    createdAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, 'searchHistory'), searchData);
  return { id: docRef.id, ...searchData };
};

export const getRecentSearches = async (userId: string) => {
  const q = query(
    collection(db, 'searchHistory'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SearchHistory[];
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

export const saveUserSearch = async (userId: string, keyword: string, books: AmazonBook[], trendData: TrendData) => {
  try {
    const searchRef = doc(db, 'users', userId, 'searches', keyword);
    const searchData: SearchHistoryItem = {
      keyword,
      timestamp: Date.now(),
      books,
      trendData
    };
    await setDoc(searchRef, searchData);
  } catch (error) {
    console.error('Error saving search:', error);
    throw error;
  }
};

export const getUserSearches = async (userId: string): Promise<SearchHistoryItem[]> => {
  try {
    const searchesRef = collection(db, 'users', userId, 'searches');
    const q = query(searchesRef, orderBy('timestamp', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      keyword: doc.id
    })) as SearchHistoryItem[];
  } catch (error) {
    console.error('Error fetching search history:', error);
    throw error;
  }
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
export const saveOutlineHistory = async (userId: string, outline: any) => {
  const historyRef = collection(db, 'outlineHistory');
  const userHistoryRef = doc(historyRef, userId);
  
  try {
    // Get current history
    const userHistoryDoc = await getDoc(userHistoryRef);
    let history = [];
    
    if (userHistoryDoc.exists()) {
      history = userHistoryDoc.data().history || [];
    }
    
    // Add new outline to history
    history.unshift({
      ...outline,
      createdAt: Timestamp.now()
    });
    
    // Keep only last 10 outlines
    history = history.slice(0, 10);
    
    // Update history document
    await setDoc(userHistoryRef, {
      userId,
      history,
      updatedAt: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error saving outline history:', error);
    throw error;
  }
};

export const getOutlineHistory = async (userId: string) => {
  const historyRef = collection(db, 'outlineHistory');
  const userHistoryRef = doc(historyRef, userId);
  
  try {
    const userHistoryDoc = await getDoc(userHistoryRef);
    if (userHistoryDoc.exists()) {
      return userHistoryDoc.data().history || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting outline history:', error);
    throw error;
  }
};

export const addOutlineToProject = async (projectId: string, title: string, outline: OutlineResponse) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    const outlines = projectData.outlines || [];
    
    // Add new outline data
    outlines.push({
      title,
      outline: outline.outline,
      createdAt: Timestamp.now()
    });

    // Update project with new outline data
    await updateDoc(projectRef, {
      outlines,
      updatedAt: Timestamp.now()
    });

    return true;
  } catch (error) {
    console.error('Error adding outline to project:', error);
    throw error;
  }
}; 