import anthropic, { HAIKU_MODEL } from './anthropic-client'

interface SectionSummaryResult {
  summary: string
  lastParagraph: string
}

export async function summarizeSection(
  sectionTitle: string,
  content: string
): Promise<SectionSummaryResult> {
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 500,
    temperature: 0.2,
    system: 'Summarize the given book section. Return valid JSON with "summary" (2-3 sentences capturing key points) and "lastParagraph" (the text of the last paragraph, for transition context).',
    messages: [{ role: 'user', content: `Section: "${sectionTitle}"\n\n${content}` }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
