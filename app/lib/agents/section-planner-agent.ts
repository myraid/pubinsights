import anthropic, { SONNET_MODEL, extractJson } from './anthropic-client'

interface PlanSectionsParams {
  bookTitle: string
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  keyTopics: string[]
  totalChapters: number
  previousChapterTitles: string[]
  /** Per-chapter word budget. Drives section count and per-section word targets. */
  targetChapterWords: number
  /** Optional free-form author guidance applied to every section in the chapter. */
  authorContext?: string
}

interface PlannedSection {
  sectionNumber: number
  title: string
  outlineContext: string
  estimatedWords: number
}

const SYSTEM_PROMPT = `You are a book structure expert. You break a single chapter into a small number of focused sections, sized to the chapter's actual substance.

Sizing philosophy:
- The chapter word target is a BASELINE, not a quota. Use judgment based on the chapter's substance.
- Introductory chapters (Chapter 1, or chapters with few key topics) should be LIGHTER — typically 60-80% of baseline. Orient the reader without over-explaining.
- Conclusion chapters should also be LIGHTER — typically 60-85% of baseline. Synthesize, don't pad.
- Middle "meat" chapters with rich subject matter (4+ key topics, complex frameworks, layered arguments) should be FULLER — 100-180% of baseline as needed for real depth.
- Use the number of key topics, the summary's depth, and the chapter's role in the book to gauge length.

Hard limits (do NOT violate):
- HARD CEILING: total chapter words must never exceed 2× the baseline target.
- HARD FLOOR: total chapter words must be at least 50% of the baseline target.
- No section may exceed 1500 words. No section may be below 400 words.

Section count follows from total chapter length:
- Up to 2000 chapter words → 2-3 sections
- 2000-3500 → 3-4 sections
- 3500-5000 → 3-5 sections
- 5000+ → 4-6 sections (only if subject genuinely warrants it)

Other rules:
- Generate the SMALLEST number of sections needed to cover the key topics well.
- Distribute words by topic complexity, not evenly.
- Every key topic must be covered by at least one section.
- First section introduces the chapter's theme. Last section concludes and bridges to what comes next.
- Section titles must be specific and descriptive (e.g., "The Chemistry of Essential Oils" — NOT "Overview" or "Introduction").
- "outlineContext" is 2-3 sentences describing exactly what the section should cover. Be concrete.

If the author has provided custom context (e.g., voice, length preference, audience), weight that ABOVE these defaults.

Return valid JSON only, no prose, no markdown fences:
{
  "sections": [
    {
      "sectionNumber": 1,
      "title": "Section Title",
      "outlineContext": "2-3 sentences describing what to cover",
      "estimatedWords": 800
    }
  ]
}`

export async function planSections(params: PlanSectionsParams): Promise<PlannedSection[]> {
  const start = Date.now()

  const isFirstChapter = params.chapterNumber === 1
  const isLastChapter = params.chapterNumber === params.totalChapters
  const target = params.targetChapterWords

  // Position cue helps the planner judge whether this is an "intro/conclusion" (lighter)
  // or a "meat of the book" chapter (fuller). Roughly: first ~20% intro, last ~15% conclusion,
  // everything in between is the body.
  const positionRatio = (params.chapterNumber - 1) / Math.max(1, params.totalChapters - 1)
  let positionCue: string
  if (isFirstChapter) {
    positionCue = 'OPENING — orient the reader; lean lighter than baseline.'
  } else if (isLastChapter) {
    positionCue = 'CLOSING — synthesize and conclude; lean lighter than baseline.'
  } else if (positionRatio < 0.2) {
    positionCue = 'EARLY — still establishing context; lighter side of baseline is fine.'
  } else if (positionRatio > 0.85) {
    positionCue = 'LATE — wrapping up themes; trend toward baseline or below.'
  } else {
    positionCue = 'MIDDLE / "MEAT OF THE BOOK" — this is where depth belongs. Expand beyond baseline if the topic warrants it.'
  }

  let userMessage = `Book: "${params.bookTitle}"
Chapter ${params.chapterNumber} of ${params.totalChapters}: "${params.chapterTitle}"

Summary: ${params.chapterSummary || 'No summary provided'}

Key Topics (${params.keyTopics.length}):
${params.keyTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Previous chapters: ${params.previousChapterTitles.join(', ') || 'None (this is the first chapter)'}

CHAPTER POSITION: ${positionCue}

BASELINE WORD TARGET: ~${target} words.
Adjust up or down based on the chapter's substance. Hard limits: minimum ${Math.round(target * 0.5)} words, maximum ${target * 2} words.`

  if (isFirstChapter) {
    userMessage += '\n\nThis is the FIRST chapter. The opening section should orient the reader to the book\'s purpose and scope.'
  }
  if (isLastChapter) {
    userMessage += '\n\nThis is the LAST chapter. The closing section should be concluding and forward-looking.'
  }

  if (params.authorContext) {
    userMessage += `\n\nAUTHOR CONTEXT (overrides defaults — follow this for tone, length, audience, or any other custom direction):\n${params.authorContext}`
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2000,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson<{ sections: PlannedSection[] }>(text)
  const totalEstimated = parsed.sections.reduce((sum, s) => sum + (s.estimatedWords || 0), 0)
  const duration = Date.now() - start

  console.log(
    `[section-planner] chapter=${params.chapterNumber}/${params.totalChapters} sections=${parsed.sections.length} baseline=${target} planned=${totalEstimated} (${Math.round((totalEstimated / target) * 100)}% of baseline) duration=${duration}ms`
  )

  return parsed.sections
}
