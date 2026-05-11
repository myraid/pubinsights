import anthropic, { HAIKU_MODEL, extractJson } from './anthropic-client'

interface ValidationResult {
  valid: boolean
  issues: Array<{ location: string; message: string }>
  suggestions: string[]
}

const SYSTEM_PROMPT = `You are a book section editor. Review the section content for structural quality after manual edits. You must output valid JSON.

Check for:
- Logical flow between paragraphs (do ideas connect naturally?)
- Abrupt transitions or orphaned sentences
- Consistency in tone and voice
- Missing context or dangling references
- Paragraph-level coherence

Do NOT check grammar, spelling, or style preferences. Focus only on structural flow.

Return JSON:
{
  "valid": true/false,
  "issues": [
    { "location": "<quote the problematic sentence or phrase>", "message": "<what's wrong and how to fix it>" }
  ],
  "suggestions": ["<optional improvement suggestion>"]
}

If the content flows well, return valid: true with empty issues.`

export async function validateSection(
  sectionTitle: string,
  content: string,
  previousSectionSummary?: string
): Promise<ValidationResult> {
  const start = Date.now()

  let userMessage = `SECTION: "${sectionTitle}"\n\nCONTENT:\n${content}`
  if (previousSectionSummary) {
    userMessage += `\n\nPREVIOUS SECTION SUMMARY (for transition context):\n${previousSectionSummary}`
  }

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson<ValidationResult>(text)
  const duration = Date.now() - start

  console.log(`[validation-agent] sec="${sectionTitle}" valid=${parsed.valid} issues=${parsed.issues.length} duration=${duration}ms`)

  return parsed
}
