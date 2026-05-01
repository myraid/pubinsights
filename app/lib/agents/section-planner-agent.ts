import anthropic, { SONNET_MODEL } from './anthropic-client'

interface PlanSectionsParams {
  bookTitle: string
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  keyTopics: string[]
  totalChapters: number
  previousChapterTitles: string[]
}

interface PlannedSection {
  sectionNumber: number
  title: string
  outlineContext: string
  estimatedWords: number
}

const SYSTEM_PROMPT = `You are a book structure expert. Given a chapter's outline, break it into 3-5 logical sections.

Rules:
- Generate between 2 and 7 sections (minimum 2, maximum 7)
- First section should introduce the chapter's theme
- Last section should conclude and set up the next chapter
- Every key topic must be covered by at least one section
- Distribute word counts by topic complexity, not evenly (600-1500 words per section)
- Section titles must be specific and descriptive (e.g., "The Chemistry of Essential Oils" not "Overview")
- outlineContext should be 2-3 sentences describing exactly what the section should cover

Return valid JSON only:
{
  "sections": [
    {
      "sectionNumber": 1,
      "title": "Section Title",
      "outlineContext": "2-3 sentences describing what to cover",
      "estimatedWords": 1000
    }
  ]
}`

export async function planSections(params: PlanSectionsParams): Promise<PlannedSection[]> {
  const start = Date.now()

  const isFirstChapter = params.chapterNumber === 1
  const isLastChapter = params.chapterNumber === params.totalChapters

  let userMessage = `Book: "${params.bookTitle}"
Chapter ${params.chapterNumber} of ${params.totalChapters}: "${params.chapterTitle}"

Summary: ${params.chapterSummary || 'No summary provided'}

Key Topics:
${params.keyTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Previous chapters: ${params.previousChapterTitles.join(', ') || 'None (this is the first chapter)'}`

  if (isFirstChapter) {
    userMessage += '\n\nThis is the FIRST chapter. Include a section that orients the reader to the book\'s purpose and scope.'
  }
  if (isLastChapter) {
    userMessage += '\n\nThis is the LAST chapter. Include a concluding, forward-looking section.'
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2000,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)
  const duration = Date.now() - start

  console.log(`[section-planner] chapter=${params.chapterNumber} sections=${parsed.sections.length} duration=${duration}ms`)

  return parsed.sections
}
