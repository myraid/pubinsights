import anthropic, { HAIKU_MODEL } from './anthropic-client'

interface ChapterSummaryResult {
  chapterSummary: string
  keyPointsCovered: string[]
}

export async function summarizeChapter(
  chapterTitle: string,
  sectionSummaries: { title: string; summary: string }[]
): Promise<ChapterSummaryResult> {
  const sectionsText = sectionSummaries
    .map(s => `${s.title}: ${s.summary}`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 500,
    temperature: 0.2,
    system: 'Summarize the given book chapter from its section summaries. Return valid JSON with "chapterSummary" (3-5 sentences) and "keyPointsCovered" (array of main topics addressed).',
    messages: [{ role: 'user', content: `Chapter: "${chapterTitle}"\n\nSections:\n${sectionsText}` }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
