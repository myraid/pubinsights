import anthropic, { SONNET_MODEL } from './anthropic-client'
import type { WritingContext } from '@/app/lib/context/context-builder'

interface SectionDraft {
  content: string
  wordCount: number
}

function buildSystemPrompt(ctx: WritingContext): string {
  let prompt = `You are a book co-author. Write one section of a non-fiction book. Output ONLY valid HTML using <h3> for subheadings, <p> for paragraphs, <ul>/<ol> for lists. No meta-commentary, no preamble, no "In this section" introductions.`

  if (ctx.styleProfile) {
    const sp = ctx.styleProfile
    prompt += `\n\nMatch this writing style exactly:
- Tone: ${sp.tone}
- Vocabulary: ${sp.vocabulary}
- Sentence structure: ${sp.sentenceStructure}
- Narrative approach: ${sp.narrativeApproach}
- Point of view: ${sp.pointOfView}`
    if (sp.authorOverrides) {
      prompt += `\n- Author overrides: ${sp.authorOverrides}`
    }
  } else {
    prompt += '\n\nStyle: Professional, accessible non-fiction. Balance data and narrative. Avoid jargon.'
  }

  prompt += '\n\nRules:\n- Be substantive and data-rich. No filler, no jargon padding.\n- If author notes conflict with the outline, follow the author notes.\n- Output only HTML. No markdown, no code fences.'

  return prompt
}

function buildUserMessage(ctx: WritingContext): string {
  let msg = `BOOK: "${ctx.bookTitle}"\n\n`

  // Outline (compact)
  msg += 'OUTLINE:\n'
  for (const ch of ctx.fullOutline) {
    msg += `Ch ${ch.chapterNumber}: ${ch.title} — ${ch.summary}\n`
  }

  // Previous chapters
  if (ctx.previousChapters.length > 0) {
    msg += '\nPREVIOUSLY IN THIS BOOK:\n'
    for (const ch of ctx.previousChapters) {
      msg += `Chapter ${ch.chapterNumber} (${ch.title}): ${ch.chapterSummary}\n`
    }
  }

  // Current chapter
  msg += `\nCURRENT CHAPTER ${ctx.currentChapter.number}: "${ctx.currentChapter.title}"`
  msg += `\nSummary: ${ctx.currentChapter.summary}`
  msg += '\nSection plan:'
  for (const s of ctx.currentChapter.sectionPlan) {
    msg += `\n  ${s.sectionNumber}. ${s.title} (~${s.estimatedWords} words)`
  }

  // Previous sections in this chapter
  if (ctx.previousSectionsInChapter.length > 0) {
    msg += '\n\nPREVIOUS SECTIONS IN THIS CHAPTER:'
    for (const s of ctx.previousSectionsInChapter) {
      msg += `\nSection ${s.sectionNumber} (${s.title}): ${s.approvedSummary}`
      if (s.lastParagraph) {
        msg += `\n[Last paragraph]: ${s.lastParagraph}`
      }
    }
  }

  // Current task
  const sec = ctx.currentSection
  msg += `\n\nYOUR TASK: Write Section ${sec.number}: "${sec.title}"`
  msg += `\nCover: ${sec.outlineContext}`
  msg += `\nTarget: ${sec.estimatedWords} words`

  if (ctx.previousSectionsInChapter.length > 0) {
    msg += '\nTransition smoothly from the previous section.'
  } else if (ctx.previousChapters.length > 0) {
    msg += '\nOpen with a transition from the previous chapter\'s themes.'
  } else {
    msg += '\nThis is the opening of the book. Hook the reader immediately.'
  }

  if (sec.authorNotes) {
    msg += `\n\nAUTHOR NOTES (these take priority): ${sec.authorNotes}`
  }

  return msg
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(' ').length : 0
}

export async function generateSectionDraft(ctx: WritingContext): Promise<SectionDraft> {
  const start = Date.now()

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 8000,
    temperature: 0.7,
    system: buildSystemPrompt(ctx),
    messages: [{ role: 'user', content: buildUserMessage(ctx) }],
  })

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  const wordCount = countWords(content)
  const duration = Date.now() - start

  console.log(`[section-writer] ch=${ctx.currentChapter.number} sec=${ctx.currentSection.number} words=${wordCount} duration=${duration}ms`)

  return { content, wordCount }
}
