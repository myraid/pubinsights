import anthropic, { SONNET_MODEL, extractJson } from './anthropic-client'

interface StyleExtractionResult {
  tone: string
  vocabulary: string
  sentenceStructure: string
  narrativeApproach: string
  pointOfView: string
}

const SYSTEM_PROMPT = `Analyze the writing style across the provided sections and describe it in concrete, actionable terms. Return valid JSON.

Describe each dimension specifically. NOT "good writing" but specifics like:
- tone: "conversational but authoritative, uses humor sparingly"
- vocabulary: "accessible, uses analogies over jargon, explains technical terms inline"
- sentenceStructure: "mix of short punchy (5-8 words) and longer flowing sentences, paragraphs of 2-3 sentences"
- narrativeApproach: "opens sections with rhetorical questions, uses case studies as evidence, ends with practical takeaways"
- pointOfView: "second person (you/your) with occasional first-person anecdotes"

If sections are stylistically inconsistent, note the inconsistency.

Return JSON:
{
  "tone": "...",
  "vocabulary": "...",
  "sentenceStructure": "...",
  "narrativeApproach": "...",
  "pointOfView": "..."
}`

export async function extractStyleProfile(
  sections: { title: string; content: string }[],
  authorPreferences?: string
): Promise<StyleExtractionResult> {
  const start = Date.now()

  let userMessage = 'Analyze the writing style of these approved sections:\n\n'
  for (const sec of sections) {
    userMessage += `--- ${sec.title} ---\n${sec.content}\n\n`
  }

  if (authorPreferences) {
    userMessage += `\nAuthor's style preferences (incorporate these): ${authorPreferences}`
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1000,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson<StyleExtractionResult>(text)
  const duration = Date.now() - start

  console.log(`[style-extractor] sections=${sections.length} duration=${duration}ms`)

  return parsed
}
