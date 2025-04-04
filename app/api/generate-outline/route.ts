import { NextResponse } from 'next/server'

interface ChapterContent {
  Chapter: number;
  Title: string;
  [key: string]: any; // Allow for dynamic fields
}

interface OutlineData {
  Title: string;
  Chapters: ChapterContent[];
}

function parseOutlineContent(title: string, content: string): OutlineData {
  try {
    // Parse the JSON content
    const parsedContent = JSON.parse(content);
    console.log('parsedContent', parsedContent);
    
    // Validate the structure
    if (!parsedContent.Title || !Array.isArray(parsedContent.Chapters)) {
      throw new Error('Invalid outline structure');
    }

    // Process each chapter to ensure all required fields are present
    const processedChapters = parsedContent.Chapters.map((chapter: any, index: number) => {
      // Create a base chapter object with required fields
      const processedChapter: ChapterContent = {
        Chapter: chapter.Chapter || index + 1,
        Title: chapter.Title || 'Untitled Chapter'
      };

      // Add all other fields from the chapter
      Object.entries(chapter).forEach(([key, value]) => {
        // Skip the fields we've already processed
        if (!['Chapter', 'Title'].includes(key)) {
          // Handle different types of values
          if (Array.isArray(value)) {
            processedChapter[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            processedChapter[key] = value;
          } else {
            processedChapter[key] = String(value);
          }
        }
      });
      console.log('processedChapter', processedChapter);
      return processedChapter;
    });

    // Sort chapters by chapter number
    processedChapters.sort((a: ChapterContent, b: ChapterContent) => a.Chapter - b.Chapter);

    return {
      Title: parsedContent.Title,
      Chapters: processedChapters
    };
  } catch (error) {
    console.error('Error parsing outline content:', error);
    throw new Error('Failed to parse outline content');
  }
}

export async function POST(request: Request) {
  try {
    const { title } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const response = await fetch('https://hook.us2.make.com/7qrng21hu51qnn30m7k4q29wk826p88y', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title })
    })

    if (!response.ok) {
      throw new Error('Failed to generate outline')
    }

    const data = await response.json()
    const content = data[0]?.message?.content

    if (!content) {
      throw new Error('Invalid response format')
    }

    const parsedOutline = parseOutlineContent(title, content)
    return NextResponse.json({ outline: parsedOutline })

  } catch (error) {
    console.error('Error generating outline:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate outline'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

