import { NextResponse } from 'next/server'
import { generateOutline } from '@/app/lib/agents/outline-agent'
import { logGeneration } from '@/app/lib/agents/generation-logger'
import { MODEL } from '@/app/lib/agents/openai-client'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'

interface ChapterContent {
  Chapter: number;
  Title: string;
  [key: string]: unknown;
}

interface OutlineData {
  Title: string;
  Chapters: ChapterContent[];
}

function parseOutlineContent(title: string, content: string): OutlineData {
  try {
    const parsedContent = JSON.parse(content);

    if (!parsedContent.Title || !Array.isArray(parsedContent.Chapters)) {
      throw new Error('Invalid outline structure');
    }

    const processedChapters = parsedContent.Chapters.map((chapter: unknown, index: number) => {
      const chapterData = typeof chapter === 'object' && chapter !== null ? (chapter as Record<string, unknown>) : {}
      const processedChapter: ChapterContent = {
        Chapter: typeof chapterData.Chapter === 'number' ? chapterData.Chapter : index + 1,
        Title: typeof chapterData.Title === 'string' ? chapterData.Title : 'Untitled Chapter'
      };

      Object.entries(chapterData).forEach(([key, value]) => {
        if (!['Chapter', 'Title'].includes(key)) {
          if (Array.isArray(value)) {
            processedChapter[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            processedChapter[key] = value;
          } else {
            processedChapter[key] = String(value);
          }
        }
      });
      return processedChapter;
    });

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
    const { title, userId } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    try {
      const usageCheck = await checkAndIncrementUsage(userId, 'outlines')
      if (!usageCheck.allowed) {
        return NextResponse.json(
          {
            error: 'usage_limit_exceeded',
            tier: usageCheck.tier,
            current: usageCheck.current,
            limit: usageCheck.limit,
          },
          { status: 429 }
        )
      }
    } catch (usageError) {
      console.error('Usage check failed (non-blocking):', usageError)
    }

    const content = await generateOutline(title)
    const parsedOutline = parseOutlineContent(title, content)

    if (userId) {
      logGeneration(userId, 'outline', { title }, parsedOutline as unknown as Record<string, unknown>, MODEL);
    }

    return NextResponse.json({ outline: parsedOutline })

  } catch (error) {
    console.error('Error generating outline:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate outline'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
