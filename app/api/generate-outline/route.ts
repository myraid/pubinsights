import { NextResponse } from 'next/server'

interface Chapter {
  title: string;
  content: string[];
}

interface OutlineData {
  title: string;
  chapters: Chapter[];
}

function parseOutlineContent(title: string, content: string): OutlineData {
  try {
    // Split content into lines and process
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    // Process chapters
    const chapters: Chapter[] = [];
    let currentChapter: Partial<Chapter> = {};
    let currentContent: string[] = [];
    
    // Handle first line as chapter if it's a chapter heading or contains "Introduction"
    if (lines[0]) {
      const chapterMatch = lines[0].match(/\*\*(.*?)\*\*/) || 
                          lines[0].match(/^Chapter\s+\d+:(.+)/) || 
                          lines[0].match(/^(.*?Introduction.*?)$/) ||
                          lines[0].match(/^##(.+)$/);
      if (chapterMatch) {
        currentChapter = {
          title: chapterMatch[1] ? chapterMatch[1].trim() : lines[0].trim()
        };
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for new chapter heading
      const chapterMatch = line.match(/\*\*(.*?)\*\*/) || 
                          line.match(/^Chapter\s+\d+:(.+)/) || 
                          line.match(/^(.*?Introduction.*?)$/) ||
                          line.match(/^##(.+)$/);

      if (chapterMatch) {  // Only process as new chapter if not first line
        // Save previous chapter if exists
        if (currentChapter.title && i > 0) {
          chapters.push({
            title: currentChapter.title,
            content: currentContent
          });
        }
        
        // Start new chapter
        currentChapter = {
          title: chapterMatch[1] ? chapterMatch[1].trim() : line.trim()
        };
        currentContent = [];
      } else  {
        // Add bullet point as separate item with newline
        currentContent.push(line+"\n");

      }
    }
    
    // Add the last chapter if exists
    if (currentChapter.title) {  // Removed content length check to include chapters with no bullets
      chapters.push({
        title: currentChapter.title,
        content: currentContent
      });
    }

    if (chapters.length === 0) {
      throw new Error('No chapters available in this outline.');
    }

    return {
      title,
      chapters
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

