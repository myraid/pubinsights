import { NextResponse } from 'next/server'

interface OutlineSection {
  title: string;
  points: string[];
}

function parseOutlineContent(content: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  let currentSection: OutlineSection | null = null;
  
  for (const line of lines) {
    if (line.startsWith('### ')) {
      // New chapter starts
      if (currentSection) {
        sections.push(currentSection);
      }
      // Remove ### and ** from title
      const title = line.replace('### ', '')
        .replace(/\*\*$/, '')
        .replace(/\*\*/g, '')
        .replace(/^Chapter \d+: /, '');
      
      currentSection = { title, points: [] };
    } else if (line.startsWith('- ') && currentSection) {
      // Add point, removing bold markers
      const point = line.replace('- ', '')
        .replace(/\*\*$/, '')
        .replace(/\*\*/g, '');
      currentSection.points.push(point);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
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

    const parsedOutline = parseOutlineContent(content)
    return NextResponse.json({ sections: parsedOutline })

  } catch (error) {
    console.error('Error generating outline:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate outline'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

