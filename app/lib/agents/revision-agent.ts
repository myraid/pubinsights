import anthropic, { HAIKU_MODEL, extractJson } from './anthropic-client'
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

const SYSTEM_PROMPT = `You are revising a specific passage of a book section based on the author's comment. You must output valid JSON.

Rules:
- You receive ONLY the passage that needs revision, plus surrounding context for reference.
- ONLY modify the TARGET PASSAGE. The BEFORE CONTEXT and AFTER CONTEXT are read-only — do not include them in your output.
- Apply the author's feedback precisely to the target passage.
- Preserve the HTML formatting of the target passage.
- If the feedback asks to delete content, return an empty string for revisedPassage.
- Keep the same tone and style as the surrounding context.

Return JSON:
{
  "revisedPassage": "<the revised HTML for the target passage only>",
  "changeDescription": "<brief description of what was changed>"
}`

interface PassageRevision {
  revisedPassage: string
  changeDescription: string
}

/**
 * Extract ~200 words of context before and after the target text.
 * Works on the raw HTML string.
 */
function extractPassageWithContext(
  fullContent: string,
  selectedText: string,
  contextWords: number = 200
): { before: string; target: string; after: string; startIdx: number; endIdx: number } | null {
  const idx = fullContent.indexOf(selectedText)
  if (idx === -1) return null

  const endIdx = idx + selectedText.length

  // Walk backwards to find ~contextWords words
  let beforeStart = idx
  let wordCount = 0
  for (let i = idx - 1; i >= 0 && wordCount < contextWords; i--) {
    if (fullContent[i] === ' ' || fullContent[i] === '\n') wordCount++
    beforeStart = i
  }

  // Walk forwards to find ~contextWords words
  let afterEnd = endIdx
  wordCount = 0
  for (let i = endIdx; i < fullContent.length && wordCount < contextWords; i++) {
    if (fullContent[i] === ' ' || fullContent[i] === '\n') wordCount++
    afterEnd = i + 1
  }

  return {
    before: fullContent.slice(beforeStart, idx),
    target: selectedText,
    after: fullContent.slice(endIdx, afterEnd),
    startIdx: idx,
    endIdx,
  }
}

export async function reviseSection(ctx: WritingContext): Promise<RevisionResult> {
  const start = Date.now()
  const sec = ctx.currentSection
  const comments = sec.comments || []

  if (comments.length === 0) {
    return { content: sec.currentContent || '', wordCount: countWords(sec.currentContent || ''), changesApplied: [] }
  }

  let content = sec.currentContent || ''
  const changesApplied: string[] = []

  // Process each comment independently, in reverse order of position
  // (so earlier splices don't shift later indices)
  const allPassages = comments
    .map(c => {
      const passage = extractPassageWithContext(content, c.selectedText)
      return passage ? { comment: c, passage } : null
    })
    .filter((cp): cp is NonNullable<typeof cp> => cp !== null)
    .sort((a, b) => b.passage.startIdx - a.passage.startIdx)

  // Filter out overlapping comments — when two selections overlap,
  // keep the one that appears later in the document (processed first
  // in reverse order) and skip the earlier one to avoid index corruption
  const commentPassages: typeof allPassages = []
  for (const cp of allPassages) {
    const overlaps = commentPassages.some(existing => {
      const aStart = cp.passage.startIdx, aEnd = cp.passage.endIdx
      const bStart = existing.passage.startIdx, bEnd = existing.passage.endIdx
      return aStart < bEnd && aEnd > bStart
    })
    if (overlaps) {
      changesApplied.push(`Skipped: "${cp.comment.authorFeedback}" (overlaps with another comment — revise separately)`)
    } else {
      commentPassages.push(cp)
    }
  }

  for (const { comment, passage } of commentPassages) {
    const userMessage = [
      `BEFORE CONTEXT (read-only):\n${passage.before}`,
      `TARGET PASSAGE (revise this):\n${passage.target}`,
      `AFTER CONTEXT (read-only):\n${passage.after}`,
      `AUTHOR FEEDBACK: ${comment.authorFeedback}`,
    ].join('\n\n')

    try {
      const response = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const parsed = extractJson<PassageRevision>(text)

      // Splice the revised passage back in
      content = content.slice(0, passage.startIdx) + parsed.revisedPassage + content.slice(passage.endIdx)
      changesApplied.push(parsed.changeDescription)
    } catch (err) {
      console.warn(`[revision-agent] Failed to revise comment "${comment.authorFeedback}":`, err)
      changesApplied.push(`Skipped: "${comment.authorFeedback}" (revision failed)`)
    }
  }

  // Handle comments whose selectedText wasn't found
  const skippedComments = comments.filter(c => !commentPassages.some(cp => cp.comment === c))
  for (const c of skippedComments) {
    changesApplied.push(`Skipped: "${c.authorFeedback}" (selected text not found in content)`)
  }

  const duration = Date.now() - start
  console.log(`[revision-agent] sec="${sec.title}" changes=${changesApplied.length} duration=${duration}ms model=${HAIKU_MODEL}`)

  return {
    content,
    wordCount: countWords(content),
    changesApplied,
  }
}
