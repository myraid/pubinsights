import anthropic, { SONNET_MODEL } from './anthropic-client'
import type { WritingContext } from '@/app/lib/context/context-builder'

interface RevisionResult {
  content: string
  wordCount: number
  changesApplied: string[]
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(' ').length : 0
}

const SYSTEM_PROMPT = `You are revising a section of a non-fiction book based on the author's inline comments. You must output valid JSON.

Rules:
- REVISE, don't rewrite. Preserve everything the author hasn't commented on.
- For each comment: find the selectedText in the content, apply the authorFeedback to that passage only.
- If the author has made manual edits (the content may differ from the AI original), respect those edits — they are intentional.
- After applying all changes, re-read the full section to ensure it flows naturally. Make minimal transition adjustments only.
- If a selectedText is not found in the content (author may have deleted it), skip that comment.

Return JSON:
{
  "content": "<revised HTML>",
  "changesApplied": ["Brief description of change 1", "Brief description of change 2"]
}`

export async function reviseSection(ctx: WritingContext): Promise<RevisionResult> {
  const start = Date.now()
  const sec = ctx.currentSection

  let userMessage = `SECTION: "${sec.title}"\n\nCURRENT CONTENT:\n${sec.currentContent}\n\nCOMMENTS TO ADDRESS:\n`

  for (const c of sec.comments || []) {
    userMessage += `\n- Selected text: "${c.selectedText}"\n  Feedback: ${c.authorFeedback}\n`
  }

  if (ctx.styleProfile) {
    userMessage += `\nMaintain this style: ${ctx.styleProfile.tone}, ${ctx.styleProfile.vocabulary}`
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 8000,
    temperature: 0.6,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)
  const duration = Date.now() - start

  console.log(`[revision-agent] sec="${sec.title}" changes=${parsed.changesApplied.length} duration=${duration}ms`)

  return {
    content: parsed.content,
    wordCount: countWords(parsed.content),
    changesApplied: parsed.changesApplied,
  }
}
