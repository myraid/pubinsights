# BookWriter Co-Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a section-level co-authoring system where AI and the author collaborate to write a book one section at a time, with inline editing, highlight-and-comment revision, style profile learning, and DOCX export.

**Architecture:** Context Builder Pattern — stateless API routes assemble context from Firestore on each call using pre-computed summaries. Six Claude-powered agents handle planning, writing, revision, style extraction, and summarization. Three-panel UI (chapter nav, section editor, context panel) with strict linear flow enforcement.

**Tech Stack:** Next.js App Router, Tailwind CSS, shadcn/ui, Firebase Firestore, Tiptap (with highlight extension), Anthropic SDK (Claude Sonnet 4.6 + Haiku 4.5), `docx` npm package

**Spec:** `docs/superpowers/specs/2026-04-28-bookwriter-coauthoring-design.md`

**Note:** This project has no test runner configured. Verification uses `npm run build` and manual testing via `npm run dev`.

---

## File Map

### Files to Create

| File | Responsibility |
|------|---------------|
| `app/lib/agents/anthropic-client.ts` | Shared Anthropic SDK client |
| `app/lib/context/context-builder.ts` | Assembles prompt context from Firestore |
| `app/lib/agents/section-planner-agent.ts` | Breaks chapter into 3-5 sections |
| `app/lib/agents/section-writer-agent.ts` | Generates one section draft |
| `app/lib/agents/revision-agent.ts` | Revises section based on inline comments |
| `app/lib/agents/style-extractor-agent.ts` | Extracts voice/style profile from approved sections |
| `app/lib/agents/section-summarizer-agent.ts` | Summarizes approved section (2-3 sentences) |
| `app/lib/agents/chapter-summarizer-agent.ts` | Summarizes completed chapter (3-5 sentences) |
| `app/api/plan-sections/route.ts` | Section planning endpoint |
| `app/api/write-section/route.ts` | Section generation endpoint |
| `app/api/revise-section/route.ts` | Comment-based revision endpoint |
| `app/api/approve-section/route.ts` | Section approval + summarization |
| `app/api/extract-style/route.ts` | Style profile extraction |
| `app/api/complete-chapter/route.ts` | Chapter assembly + summarization |
| `app/api/export-manuscript/route.ts` | DOCX export endpoint |
| `app/lib/export/html-to-docx.ts` | HTML to DOCX paragraph conversion |
| `components/book-writer/SectionEditor.tsx` | Section-level editor with 4 states |
| `components/book-writer/ContextPanel.tsx` | Right panel: outline, notes, style, revision history |
| `components/book-writer/CommentPopover.tsx` | Popover for adding comments on highlighted text |

### Files to Modify

| File | Change |
|------|--------|
| `app/types/firebase.ts` | Add Section, SectionComment, RevisionEntry, StyleProfile, SectionPlanEntry types. Update ChapterDocument and Manuscript. |
| `app/lib/firebase/services.ts` | Add section CRUD, style profile CRUD, save-manuscript-to-project |
| `firestore.rules` | Add sections subcollection rules under chapters |
| `app/lib/billing/tiers.ts` | Replace `chapters` with `sections` in TierLimits |
| `app/lib/billing/usage.ts` | Replace `'chapters'` with `'sections'` in type union |
| `components/sections/BookWriter.tsx` | Three-panel layout, section-level flow |
| `components/book-writer/ChapterSidebar.tsx` | Section expansion, section-level progress |
| `components/book-writer/ChapterEditor.tsx` | Add comment button to toolbar |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Anthropic SDK, docx, htmlparser2, and Tiptap highlight extension**

```bash
npm install @anthropic-ai/sdk docx htmlparser2 @tiptap/extension-highlight
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add anthropic sdk, docx, htmlparser2, tiptap highlight deps"
```

---

## Task 2: Add Types

**Files:**
- Modify: `app/types/firebase.ts`

- [ ] **Step 1: Add new types and update existing ones**

Add these new interfaces after the existing `ChapterDocument` interface in `app/types/firebase.ts`:

```typescript
export interface SectionComment {
  id: string
  selectedText: string
  startOffset: number
  endOffset: number
  authorFeedback: string
  status: 'pending' | 'resolved'
  createdAt: { seconds: number; nanoseconds: number }
}

export interface RevisionEntry {
  version: number
  content: string
  resolvedComments: string[]
  createdAt: { seconds: number; nanoseconds: number }
}

export interface SectionPlanEntry {
  sectionNumber: number
  title: string
  outlineContext: string
  estimatedWords: number
}

export interface Section {
  id: string
  sectionNumber: number
  title: string
  status: 'not_started' | 'generating' | 'review' | 'approved'
  content: string
  wordCount: number
  outlineContext: string
  estimatedWords: number
  comments: SectionComment[]
  revisionCount: number
  revisionHistory: RevisionEntry[]
  approvedSummary?: string
  lastParagraph?: string
  authorNotes: string
  aiGenerated: boolean
  approvedAt?: { seconds: number; nanoseconds: number }
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}

export interface StyleProfile {
  tone: string
  vocabulary: string
  sentenceStructure: string
  narrativeApproach: string
  pointOfView: string
  extractedFromSections: string[]
  authorOverrides?: string
  lastExtractedAt: { seconds: number; nanoseconds: number }
}

export interface ManuscriptSnapshot {
  manuscriptId: string
  title: string
  totalChapters: number
  totalWordCount: number
  status: 'in_progress' | 'complete'
  chapters: {
    chapterNumber: number
    title: string
    wordCount: number
    status: string
  }[]
  savedAt: { seconds: number; nanoseconds: number }
}
```

- [ ] **Step 2: Update `ChapterDocument` to include section fields**

Replace the existing `ChapterDocument` interface:

```typescript
export interface ChapterDocument {
  chapterNumber: number
  title: string
  status: 'not_started' | 'planning' | 'writing' | 'complete'
  totalSections: number
  completedSections: number
  content: string
  wordCount: number
  outlineContext: { summary: string; keyTopics: string[] }
  chapterSummary?: string
  sectionPlan: SectionPlanEntry[]
  aiGenerated: boolean
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}
```

- [ ] **Step 3: Update `Manuscript` to include styleProfile**

Add `styleProfile?: StyleProfile` to the existing `Manuscript` interface, after `outlineSnapshot`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/types/firebase.ts
git commit -m "feat: add Section, StyleProfile, SectionComment types, update ChapterDocument"
```

---

## Task 3: Anthropic Client

**Files:**
- Create: `app/lib/agents/anthropic-client.ts`

- [ ] **Step 1: Create the shared Anthropic client**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const SONNET_MODEL = 'claude-sonnet-4-6'
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export default anthropic
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/agents/anthropic-client.ts
git commit -m "feat: add shared Anthropic SDK client"
```

---

## Task 4: Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add sections subcollection rules**

Inside the existing `match /chapters/{chapterId}` block, add:

```
        // Sections — owner only (verified via parent project)
        match /sections/{sectionId} {
          allow read, write: if request.auth != null
            && request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.userId;
          allow create: if request.auth != null
            && request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.userId;
        }
```

- [ ] **Step 2: Deploy rules**

```bash
npx firebase deploy --only firestore:rules
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add firestore rules for sections subcollection"
```

---

## Task 5: Firebase Services for Sections

**Files:**
- Modify: `app/lib/firebase/services.ts`

- [ ] **Step 1: Add section CRUD functions**

Add these functions at the end of `services.ts`, after the existing manuscript/chapter functions:

```typescript
// ── Section CRUD ──

export const createSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sections: { sectionNumber: number; title: string; outlineContext: string; estimatedWords: number }[]
) => {
  const chapRef = db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .collection('chapters').doc(chapterId)

  for (const sec of sections) {
    await chapRef.collection('sections').add({
      sectionNumber: sec.sectionNumber,
      title: sec.title,
      status: 'not_started',
      content: '',
      wordCount: 0,
      outlineContext: sec.outlineContext,
      estimatedWords: sec.estimatedWords,
      comments: [],
      revisionCount: 0,
      revisionHistory: [],
      authorNotes: '',
      aiGenerated: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }
}

export const getAllSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string
) => {
  const snap = await db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .collection('chapters').doc(chapterId)
    .collection('sections')
    .orderBy('sectionNumber', 'asc')
    .get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getSection = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionId: string
) => {
  const doc = await db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .collection('chapters').doc(chapterId)
    .collection('sections').doc(sectionId)
    .get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

export const saveSection = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionId: string,
  data: Record<string, unknown>
) => {
  await db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .collection('chapters').doc(chapterId)
    .collection('sections').doc(sectionId)
    .update({ ...data, updatedAt: Timestamp.now() })
}

export const deleteSections = async (
  projectId: string,
  manuscriptId: string,
  chapterId: string
) => {
  const snap = await db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .collection('chapters').doc(chapterId)
    .collection('sections')
    .get()
  for (const doc of snap.docs) {
    await doc.ref.delete()
  }
}

// ── Style Profile ──

export const saveStyleProfile = async (
  projectId: string,
  manuscriptId: string,
  styleProfile: Record<string, unknown>
) => {
  await db
    .collection('projects').doc(projectId)
    .collection('manuscripts').doc(manuscriptId)
    .update({ styleProfile, updatedAt: Timestamp.now() })
}

// ── Save Manuscript to Project ──

export const saveManuscriptToProject = async (
  projectId: string,
  manuscript: Record<string, unknown>
) => {
  await db.collection('projects').doc(projectId).update({
    manuscript,
    updatedAt: Timestamp.now(),
  })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/firebase/services.ts
git commit -m "feat: add section CRUD, style profile, save-manuscript-to-project services"
```

---

## Task 6: Update Billing (chapters -> sections)

**Files:**
- Modify: `app/lib/billing/tiers.ts`
- Modify: `app/lib/billing/usage.ts`

- [ ] **Step 1: Update tiers.ts**

In `app/lib/billing/tiers.ts`, replace `chapters: number` with `sections: number` in the `TierLimits` interface. Update the `TIER_LIMITS` object:

```typescript
export interface TierLimits {
  insights: number
  outlines: number
  sections: number
  unlimited: boolean
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { insights: 3, outlines: 2, sections: 15, unlimited: false },
  creator: { insights: 25, outlines: 15, sections: 200, unlimited: false },
  beta: { insights: 9999, outlines: 9999, sections: 9999, unlimited: true },
}
```

- [ ] **Step 2: Update usage.ts**

In `app/lib/billing/usage.ts`, replace `'chapters'` with `'sections'` in the type union for the `type` parameter of `checkAndIncrementUsage`:

```typescript
export async function checkAndIncrementUsage(
  userId: string,
  type: 'insights' | 'outlines' | 'sections'
): Promise<UsageCheckResult> {
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/billing/tiers.ts app/lib/billing/usage.ts
git commit -m "feat: replace chapters with sections in billing tiers and usage tracking"
```

---

## Task 7: Context Builder Module

**Files:**
- Create: `app/lib/context/context-builder.ts`

- [ ] **Step 1: Create the context builder**

```typescript
import { adminDb } from '@/app/lib/firebase/admin'
import type { StyleProfile, SectionPlanEntry } from '@/app/types/firebase'

export interface WritingContext {
  bookTitle: string
  fullOutline: { chapterNumber: number; title: string; summary: string }[]
  styleProfile: StyleProfile | null

  currentChapter: {
    number: number
    title: string
    summary: string
    keyTopics: string[]
    sectionPlan: SectionPlanEntry[]
  }

  currentSection: {
    number: number
    title: string
    outlineContext: string
    estimatedWords: number
    currentContent?: string
    comments?: { selectedText: string; authorFeedback: string }[]
    authorNotes?: string
  }

  previousSectionsInChapter: {
    sectionNumber: number
    title: string
    approvedSummary: string
    lastParagraph: string
  }[]

  previousChapters: {
    chapterNumber: number
    title: string
    chapterSummary: string
  }[]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

export class ContextBuilder {
  static async forSectionGeneration(
    projectId: string,
    manuscriptId: string,
    chapterId: string,
    sectionNumber: number
  ): Promise<WritingContext> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read 1: Manuscript
    const msDoc = await adminDb.doc(basePath).get()
    const ms = msDoc.data()!
    const bookTitle = ms.outlineSnapshot.Title || ms.title
    const fullOutline = (ms.outlineSnapshot.Chapters || []).map((ch: Record<string, unknown>) => ({
      chapterNumber: ch.Chapter as number,
      title: ch.Title as string,
      summary: (ch.Summary as string) || '',
    }))
    const styleProfile: StyleProfile | null = ms.styleProfile || null

    // Read 2: Current chapter
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    const chap = chapDoc.data()!
    const currentChapter = {
      number: chap.chapterNumber,
      title: chap.title,
      summary: chap.outlineContext?.summary || '',
      keyTopics: chap.outlineContext?.keyTopics || [],
      sectionPlan: chap.sectionPlan || [],
    }

    // Find current section from plan
    const sectionPlanEntry = currentChapter.sectionPlan.find(
      (s: SectionPlanEntry) => s.sectionNumber === sectionNumber
    )
    const currentSection = {
      number: sectionNumber,
      title: sectionPlanEntry?.title || `Section ${sectionNumber}`,
      outlineContext: sectionPlanEntry?.outlineContext || '',
      estimatedWords: sectionPlanEntry?.estimatedWords || 1000,
    }

    // Read 3: Approved sections in this chapter
    const approvedSnap = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .where('status', '==', 'approved')
      .orderBy('sectionNumber', 'asc')
      .get()

    const previousSectionsInChapter = approvedSnap.docs
      .filter(d => d.data().sectionNumber < sectionNumber)
      .map(d => {
        const data = d.data()
        let summary = data.approvedSummary || ''
        if (!summary && data.content) {
          summary = truncateToWords(stripHtml(data.content), 200)
        }
        return {
          sectionNumber: data.sectionNumber,
          title: data.title,
          approvedSummary: summary,
          lastParagraph: data.lastParagraph || '',
        }
      })

    // Read 4: Completed chapters before this one
    const completedSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .where('status', '==', 'complete')
      .orderBy('chapterNumber', 'asc')
      .get()

    let previousChapters = completedSnap.docs
      .filter(d => d.data().chapterNumber < currentChapter.number)
      .map(d => {
        const data = d.data()
        return {
          chapterNumber: data.chapterNumber,
          title: data.title,
          chapterSummary: data.chapterSummary || '',
        }
      })

    // Overflow: if > 20 chapters, compress oldest to title-only, keep last 5 full
    if (previousChapters.length > 20) {
      const cutoff = previousChapters.length - 5
      previousChapters = previousChapters.map((ch, i) => {
        if (i < cutoff) {
          return { ...ch, chapterSummary: ch.title }
        }
        return ch
      })
    }

    return {
      bookTitle,
      fullOutline,
      styleProfile,
      currentChapter,
      currentSection,
      previousSectionsInChapter,
      previousChapters,
    }
  }

  static async forRevision(
    projectId: string,
    manuscriptId: string,
    chapterId: string,
    sectionId: string
  ): Promise<WritingContext> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read section to get its number, content, and comments
    const secDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}/sections/${sectionId}`).get()
    const sec = secDoc.data()!

    // Reuse forSectionGeneration for the base context
    const ctx = await this.forSectionGeneration(
      projectId, manuscriptId, chapterId, sec.sectionNumber
    )

    // Augment with current content and comments
    ctx.currentSection.currentContent = sec.content
    ctx.currentSection.comments = (sec.comments || [])
      .filter((c: Record<string, unknown>) => c.status === 'pending')
      .map((c: Record<string, unknown>) => ({
        selectedText: c.selectedText as string,
        authorFeedback: c.authorFeedback as string,
      }))
    ctx.currentSection.authorNotes = sec.authorNotes || undefined

    return ctx
  }

  static async forStyleExtraction(
    projectId: string,
    manuscriptId: string,
    sectionIds: string[]
  ): Promise<{ sections: { title: string; content: string }[] }> {
    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Need to find sections across all chapters
    const chapSnap = await adminDb.collection(`${basePath}/chapters`).get()
    const sections: { title: string; content: string }[] = []

    for (const chapDoc of chapSnap.docs) {
      for (const sectionId of sectionIds) {
        const secDoc = await adminDb
          .doc(`${basePath}/chapters/${chapDoc.id}/sections/${sectionId}`)
          .get()
        if (secDoc.exists) {
          const data = secDoc.data()!
          sections.push({ title: data.title, content: data.content })
        }
      }
    }

    return { sections }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/context/context-builder.ts
git commit -m "feat: add ContextBuilder module for assembling agent prompt context"
```

---

## Task 8: Section Planner Agent

**Files:**
- Create: `app/lib/agents/section-planner-agent.ts`

- [ ] **Step 1: Create the planner agent**

```typescript
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/agents/section-planner-agent.ts
git commit -m "feat: add section planner agent (Claude Sonnet)"
```

---

## Task 9: Section Writer Agent

**Files:**
- Create: `app/lib/agents/section-writer-agent.ts`

- [ ] **Step 1: Create the writer agent**

```typescript
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/agents/section-writer-agent.ts
git commit -m "feat: add section writer agent with full context assembly"
```

---

## Task 10: Revision Agent

**Files:**
- Create: `app/lib/agents/revision-agent.ts`

- [ ] **Step 1: Create the revision agent**

```typescript
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/agents/revision-agent.ts
git commit -m "feat: add revision agent for comment-based section revision"
```

---

## Task 11: Style Extractor Agent

**Files:**
- Create: `app/lib/agents/style-extractor-agent.ts`

- [ ] **Step 1: Create the style extractor**

```typescript
import anthropic, { SONNET_MODEL } from './anthropic-client'

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
  const parsed = JSON.parse(text)
  const duration = Date.now() - start

  console.log(`[style-extractor] sections=${sections.length} duration=${duration}ms`)

  return parsed
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/agents/style-extractor-agent.ts
git commit -m "feat: add style extractor agent"
```

---

## Task 12: Summarizer Agents

**Files:**
- Create: `app/lib/agents/section-summarizer-agent.ts`
- Create: `app/lib/agents/chapter-summarizer-agent.ts`

- [ ] **Step 1: Create section summarizer**

```typescript
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
```

- [ ] **Step 2: Create chapter summarizer**

```typescript
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
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/agents/section-summarizer-agent.ts app/lib/agents/chapter-summarizer-agent.ts
git commit -m "feat: add section and chapter summarizer agents (Claude Haiku)"
```

---

## Task 13: API — Plan Sections

**Files:**
- Create: `app/api/plan-sections/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { planSections } from '@/app/lib/agents/section-planner-agent'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId } = await req.json()

    if (!userId || !projectId || !manuscriptId || !chapterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Verify ownership
    const projectDoc = await adminDb.doc(`projects/${projectId}`).get()
    if (!projectDoc.exists || projectDoc.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Read chapter
    const chapDoc = await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()
    if (!chapDoc.exists) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    const chap = chapDoc.data()!

    // Cross-chapter enforcement
    if (chap.chapterNumber > 1) {
      const chapSnap = await adminDb
        .collection(`${basePath}/chapters`)
        .where('chapterNumber', '==', chap.chapterNumber - 1)
        .get()
      if (!chapSnap.empty) {
        const prevChap = chapSnap.docs[0].data()
        if (prevChap.status !== 'complete') {
          return NextResponse.json(
            { error: `Chapter ${chap.chapterNumber - 1} must be completed first` },
            { status: 403 }
          )
        }
      }
    }

    // Check if sections already exist
    const existingSnap = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .limit(1)
      .get()
    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'Chapter already has sections. Delete existing sections first.' },
        { status: 409 }
      )
    }

    // Read manuscript for book title + outline
    const msDoc = await adminDb.doc(basePath).get()
    const ms = msDoc.data()!

    // Get previous chapter titles
    const allChapsSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .where('chapterNumber', '<', chap.chapterNumber)
      .orderBy('chapterNumber', 'asc')
      .get()
    const previousChapterTitles = allChapsSnap.docs.map(d => d.data().title)

    // Call planner agent
    const sections = await planSections({
      bookTitle: ms.outlineSnapshot.Title || ms.title,
      chapterNumber: chap.chapterNumber,
      chapterTitle: chap.title,
      chapterSummary: chap.outlineContext?.summary || '',
      keyTopics: chap.outlineContext?.keyTopics || [],
      totalChapters: ms.totalChapters,
      previousChapterTitles,
    })

    // Write section plan to chapter doc
    await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
      sectionPlan: sections,
      totalSections: sections.length,
      completedSections: 0,
      status: 'writing',
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Create empty section subdocs
    for (const sec of sections) {
      await adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .add({
          sectionNumber: sec.sectionNumber,
          title: sec.title,
          status: 'not_started',
          content: '',
          wordCount: 0,
          outlineContext: sec.outlineContext,
          estimatedWords: sec.estimatedWords,
          comments: [],
          revisionCount: 0,
          revisionHistory: [],
          authorNotes: '',
          aiGenerated: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
    }

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('[plan-sections] error:', error)
    return NextResponse.json(
      { error: 'Failed to plan sections', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/plan-sections/route.ts
git commit -m "feat: add /api/plan-sections endpoint"
```

---

## Task 14: API — Write Section

**Files:**
- Create: `app/api/write-section/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { generateSectionDraft } from '@/app/lib/agents/section-writer-agent'
import { checkAndIncrementUsage } from '@/app/lib/billing/usage'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId, authorNotes, regenerate } = await req.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const secPath = `projects/${projectId}/manuscripts/${manuscriptId}/chapters/${chapterId}/sections/${sectionId}`

    // Read section
    const secDoc = await adminDb.doc(secPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    // Status check
    if (sec.status === 'approved') {
      return NextResponse.json({ error: 'Section is approved. Click "Make Changes" first.' }, { status: 409 })
    }
    if (sec.status === 'review' && !regenerate) {
      return NextResponse.json({ error: 'Section already has content. Use regenerate: true or revise-section.' }, { status: 409 })
    }
    if (sec.status === 'generating') {
      return NextResponse.json({ error: 'Section is already being generated.' }, { status: 409 })
    }

    // Linear flow enforcement
    if (sec.sectionNumber > 1) {
      const allSecs = await adminDb
        .collection(`projects/${projectId}/manuscripts/${manuscriptId}/chapters/${chapterId}/sections`)
        .where('sectionNumber', '==', sec.sectionNumber - 1)
        .get()
      if (!allSecs.empty) {
        const prev = allSecs.docs[0].data()
        if (prev.status !== 'approved') {
          return NextResponse.json(
            { error: `Section ${sec.sectionNumber - 1} must be approved first` },
            { status: 403 }
          )
        }
      }
    }

    // Check usage (don't increment yet)
    const usageCheck = await checkAndIncrementUsage(userId, 'sections')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'Monthly section generation limit reached', tier: usageCheck.tier, limit: usageCheck.limit },
        { status: 429 }
      )
    }

    // If regenerating, save current content to revision history
    if (regenerate && sec.content) {
      const history = sec.revisionHistory || []
      if (history.length >= 10) history.shift()
      history.push({
        version: (sec.revisionCount || 0) + 1,
        content: sec.content,
        resolvedComments: [],
        createdAt: new Date(),
      })
      await adminDb.doc(secPath).update({
        revisionHistory: history,
        revisionCount: (sec.revisionCount || 0) + 1,
        comments: [],
      })
    }

    // Set status to generating
    await adminDb.doc(secPath).update({
      status: 'generating',
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Build context and generate
    const ctx = await ContextBuilder.forSectionGeneration(
      projectId, manuscriptId, chapterId, sec.sectionNumber
    )
    if (authorNotes) ctx.currentSection.authorNotes = authorNotes

    const draft = await generateSectionDraft(ctx)

    // Write result
    await adminDb.doc(secPath).update({
      content: draft.content,
      wordCount: draft.wordCount,
      status: 'review',
      aiGenerated: true,
      authorNotes: authorNotes || sec.authorNotes || '',
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Warning check
    let warning: string | undefined
    if (draft.wordCount < sec.estimatedWords * 0.5) {
      warning = `Section is shorter than expected (${draft.wordCount} words vs ${sec.estimatedWords} target)`
    } else if (draft.wordCount > sec.estimatedWords * 2) {
      warning = `Section is longer than expected (${draft.wordCount} words vs ${sec.estimatedWords} target)`
    }

    return NextResponse.json({ content: draft.content, wordCount: draft.wordCount, warning })
  } catch (error) {
    console.error('[write-section] error:', error)
    return NextResponse.json(
      { error: 'Failed to generate section', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/write-section/route.ts
git commit -m "feat: add /api/write-section endpoint with linear flow enforcement"
```

---

## Task 15: API — Revise Section

**Files:**
- Create: `app/api/revise-section/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { reviseSection } from '@/app/lib/agents/revision-agent'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId, comments } = await req.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return NextResponse.json({ error: 'At least one comment is required' }, { status: 400 })
    }

    const secPath = `projects/${projectId}/manuscripts/${manuscriptId}/chapters/${chapterId}/sections/${sectionId}`
    const secDoc = await adminDb.doc(secPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    if (sec.status !== 'review') {
      return NextResponse.json({ error: 'Section must be in review status to revise' }, { status: 409 })
    }

    // Build context with current content + comments
    const ctx = await ContextBuilder.forRevision(projectId, manuscriptId, chapterId, sectionId)

    const result = await reviseSection(ctx)

    // Check if content actually changed
    if (result.content === sec.content) {
      return NextResponse.json({
        content: result.content,
        wordCount: result.wordCount,
        changesApplied: ['No changes were needed based on the feedback provided.'],
      })
    }

    // Save old content to revision history (cap at 10)
    const history = sec.revisionHistory || []
    if (history.length >= 10) history.shift()
    history.push({
      version: (sec.revisionCount || 0) + 1,
      content: sec.content,
      resolvedComments: comments.map((_: unknown, i: number) => `comment-${i}`),
      createdAt: new Date(),
    })

    // Mark comments as resolved, write new content
    const updatedComments = (sec.comments || []).map((c: Record<string, unknown>) => {
      const wasAddressed = comments.some(
        (rc: Record<string, unknown>) => rc.selectedText === c.selectedText && rc.authorFeedback === c.authorFeedback
      )
      return wasAddressed ? { ...c, status: 'resolved' } : c
    })

    await adminDb.doc(secPath).update({
      content: result.content,
      wordCount: result.wordCount,
      revisionCount: FieldValue.increment(1),
      revisionHistory: history,
      comments: updatedComments,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      content: result.content,
      wordCount: result.wordCount,
      changesApplied: result.changesApplied,
    })
  } catch (error) {
    console.error('[revise-section] error:', error)
    return NextResponse.json(
      { error: 'Failed to revise section', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/revise-section/route.ts
git commit -m "feat: add /api/revise-section endpoint for comment-based revision"
```

---

## Task 16: API — Approve Section

**Files:**
- Create: `app/api/approve-section/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { summarizeSection } from '@/app/lib/agents/section-summarizer-agent'
import { summarizeChapter } from '@/app/lib/agents/chapter-summarizer-agent'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId } = await req.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`
    const secPath = `${basePath}/chapters/${chapterId}/sections/${sectionId}`

    const secDoc = await adminDb.doc(secPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    if (sec.status !== 'review') {
      return NextResponse.json({ error: 'Section must be in review status to approve' }, { status: 409 })
    }

    // Summarize (non-fatal on failure)
    let approvedSummary = ''
    let lastParagraph = ''
    try {
      const summaryResult = await summarizeSection(sec.title, sec.content)
      approvedSummary = summaryResult.summary
      lastParagraph = summaryResult.lastParagraph
    } catch (err) {
      console.error('[approve-section] summarizer failed (non-fatal):', err)
    }

    // Update section
    await adminDb.doc(secPath).update({
      status: 'approved',
      approvedSummary,
      lastParagraph,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Update chapter progress
    const allSecs = await adminDb
      .collection(`${basePath}/chapters/${chapterId}/sections`)
      .get()
    const approvedCount = allSecs.docs.filter(d => {
      const s = d.data()
      return s.status === 'approved' || d.id === sectionId
    }).length
    const totalWords = allSecs.docs.reduce((sum, d) => sum + (d.data().wordCount || 0), 0)
    const totalSections = allSecs.size
    const isLastSection = approvedCount >= totalSections

    await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
      completedSections: approvedCount,
      wordCount: totalWords,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // If last section, complete chapter
    let chapterComplete = false
    if (isLastSection) {
      // Assemble chapter content
      const orderedSecs = await adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .orderBy('sectionNumber', 'asc')
        .get()
      const assembledContent = orderedSecs.docs.map(d => d.data().content).join('\n')
      const sectionSummaries = orderedSecs.docs.map(d => ({
        title: d.data().title,
        summary: d.data().approvedSummary || '',
      }))

      let chapterSummary = ''
      try {
        const chapResult = await summarizeChapter(
          (await adminDb.doc(`${basePath}/chapters/${chapterId}`).get()).data()!.title,
          sectionSummaries
        )
        chapterSummary = chapResult.chapterSummary
      } catch (err) {
        console.error('[approve-section] chapter summarizer failed (non-fatal):', err)
      }

      await adminDb.doc(`${basePath}/chapters/${chapterId}`).update({
        content: assembledContent,
        chapterSummary,
        status: 'complete',
        updatedAt: FieldValue.serverTimestamp(),
      })

      chapterComplete = true

      // Update manuscript progress
      const allChaps = await adminDb.collection(`${basePath}/chapters`).get()
      const completedChapters = allChaps.docs.filter(d => {
        const ch = d.data()
        return ch.status === 'complete' || d.id === chapterId
      }).length
      const manuscriptWordCount = allChaps.docs.reduce((sum, d) => sum + (d.data().wordCount || 0), 0)

      const msUpdate: Record<string, unknown> = {
        completedChapters,
        totalWordCount: manuscriptWordCount,
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (completedChapters >= allChaps.size) {
        msUpdate.status = 'complete'
      }
      await adminDb.doc(basePath).update(msUpdate)
    }

    // Style profile trigger: at 3 approved sections, then every 5th
    const totalApprovedAcrossManuscript = await countTotalApprovedSections(basePath)
    const shouldExtractStyle = totalApprovedAcrossManuscript === 3 || totalApprovedAcrossManuscript % 5 === 0

    return NextResponse.json({
      summary: approvedSummary,
      isLastSection,
      chapterComplete,
      shouldExtractStyle,
    })
  } catch (error) {
    console.error('[approve-section] error:', error)
    return NextResponse.json(
      { error: 'Failed to approve section', details: String(error) },
      { status: 500 }
    )
  }
}

async function countTotalApprovedSections(basePath: string): Promise<number> {
  const chaps = await adminDb.collection(`${basePath}/chapters`).get()
  let total = 0
  for (const chap of chaps.docs) {
    const secs = await adminDb
      .collection(`${basePath}/chapters/${chap.id}/sections`)
      .where('status', '==', 'approved')
      .get()
    total += secs.size
  }
  return total
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/approve-section/route.ts
git commit -m "feat: add /api/approve-section with chapter completion and style trigger"
```

---

## Task 17: API — Extract Style

**Files:**
- Create: `app/api/extract-style/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ContextBuilder } from '@/app/lib/context/context-builder'
import { extractStyleProfile } from '@/app/lib/agents/style-extractor-agent'
import { adminDb } from '@/app/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, sectionIds } = await req.json()

    if (!userId || !projectId || !manuscriptId || !sectionIds || sectionIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 section IDs required' }, { status: 400 })
    }

    // Read existing author overrides
    const msDoc = await adminDb.doc(`projects/${projectId}/manuscripts/${manuscriptId}`).get()
    const ms = msDoc.data()!
    const authorOverrides = ms.styleProfile?.authorOverrides

    // Get section content
    const { sections } = await ContextBuilder.forStyleExtraction(projectId, manuscriptId, sectionIds)

    if (sections.length < 2) {
      return NextResponse.json({ error: 'Could not find enough approved sections' }, { status: 400 })
    }

    const result = await extractStyleProfile(sections, authorOverrides)

    const styleProfile = {
      ...result,
      extractedFromSections: sectionIds,
      authorOverrides: authorOverrides || '',
      lastExtractedAt: FieldValue.serverTimestamp(),
    }

    await adminDb.doc(`projects/${projectId}/manuscripts/${manuscriptId}`).update({
      styleProfile,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ styleProfile: result })
  } catch (error) {
    console.error('[extract-style] error:', error)
    return NextResponse.json(
      { error: 'Failed to extract style', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/extract-style/route.ts
git commit -m "feat: add /api/extract-style endpoint"
```

---

## Task 18: API — Complete Chapter

**Files:**
- Create: `app/api/complete-chapter/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { summarizeChapter } from '@/app/lib/agents/chapter-summarizer-agent'
import { FieldValue } from 'firebase-admin/firestore'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId } = await req.json()

    if (!userId || !projectId || !manuscriptId || !chapterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`
    const chapPath = `${basePath}/chapters/${chapterId}`

    // Read all sections
    const secsSnap = await adminDb
      .collection(`${chapPath}/sections`)
      .orderBy('sectionNumber', 'asc')
      .get()

    // Verify all approved
    const unapproved = secsSnap.docs.filter(d => d.data().status !== 'approved')
    if (unapproved.length > 0) {
      return NextResponse.json({ error: 'All sections must be approved first' }, { status: 403 })
    }

    // Assemble content
    const assembledContent = secsSnap.docs.map(d => d.data().content).join('\n')
    const totalWords = secsSnap.docs.reduce((sum, d) => sum + (d.data().wordCount || 0), 0)

    // Summarize
    const chapDoc = await adminDb.doc(chapPath).get()
    const chapTitle = chapDoc.data()!.title
    const sectionSummaries = secsSnap.docs.map(d => ({
      title: d.data().title,
      summary: d.data().approvedSummary || '',
    }))

    let chapterSummary = ''
    try {
      const result = await summarizeChapter(chapTitle, sectionSummaries)
      chapterSummary = result.chapterSummary
    } catch (err) {
      console.error('[complete-chapter] summarizer failed (non-fatal):', err)
    }

    // Update chapter
    await adminDb.doc(chapPath).update({
      content: assembledContent,
      wordCount: totalWords,
      chapterSummary,
      status: 'complete',
      completedSections: secsSnap.size,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Update manuscript
    const allChaps = await adminDb.collection(`${basePath}/chapters`).get()
    const completedChapters = allChaps.docs.filter(d =>
      d.data().status === 'complete' || d.id === chapterId
    ).length
    const msWordCount = allChaps.docs.reduce((sum, d) => {
      if (d.id === chapterId) return sum + totalWords
      return sum + (d.data().wordCount || 0)
    }, 0)

    const msUpdate: Record<string, unknown> = {
      completedChapters,
      totalWordCount: msWordCount,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (completedChapters >= allChaps.size) {
      msUpdate.status = 'complete'
    }
    await adminDb.doc(basePath).update(msUpdate)

    return NextResponse.json({ chapterSummary, totalWordCount: totalWords })
  } catch (error) {
    console.error('[complete-chapter] error:', error)
    return NextResponse.json(
      { error: 'Failed to complete chapter', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/complete-chapter/route.ts
git commit -m "feat: add /api/complete-chapter endpoint with assembly and summarization"
```

---

## Task 19: HTML-to-DOCX Converter

**Files:**
- Create: `app/lib/export/html-to-docx.ts`

- [ ] **Step 1: Create the converter**

```typescript
import { Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import * as htmlparser2 from 'htmlparser2'

interface TextFragment {
  text: string
  bold: boolean
  italics: boolean
}

export function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let currentFragments: TextFragment[] = []
  let bold = false
  let italics = false
  let currentHeading: HeadingLevel | null = null
  let inList = false
  let isOrderedList = false
  let listItemNumber = 0

  function flushParagraph() {
    if (currentFragments.length === 0) return
    const runs = currentFragments.map(
      f => new TextRun({ text: f.text, bold: f.bold, italics: f.italics })
    )

    const options: Record<string, unknown> = { children: runs }
    if (currentHeading) options.heading = currentHeading
    if (inList) {
      options.numbering = isOrderedList
        ? { reference: 'ordered-list', level: 0 }
        : { reference: 'bullet-list', level: 0 }
    }

    paragraphs.push(new Paragraph(options as ConstructorParameters<typeof Paragraph>[0]))
    currentFragments = []
    currentHeading = null
  }

  const parser = new htmlparser2.Parser({
    onopentag(name) {
      switch (name) {
        case 'h1': currentHeading = HeadingLevel.HEADING_1; break
        case 'h2': currentHeading = HeadingLevel.HEADING_2; break
        case 'h3': currentHeading = HeadingLevel.HEADING_3; break
        case 'strong': case 'b': bold = true; break
        case 'em': case 'i': italics = true; break
        case 'ul': inList = true; isOrderedList = false; listItemNumber = 0; break
        case 'ol': inList = true; isOrderedList = true; listItemNumber = 0; break
        case 'li': listItemNumber++; break
        case 'p': break
        case 'br':
          currentFragments.push({ text: '\n', bold, italics })
          break
      }
    },
    ontext(text) {
      const trimmed = text.replace(/\s+/g, ' ')
      if (trimmed && trimmed !== ' ') {
        currentFragments.push({ text: trimmed, bold, italics })
      }
    },
    onclosetag(name) {
      switch (name) {
        case 'h1': case 'h2': case 'h3': case 'p': case 'li':
          flushParagraph()
          break
        case 'strong': case 'b': bold = false; break
        case 'em': case 'i': italics = false; break
        case 'ul': case 'ol': inList = false; break
      }
    },
  })

  parser.write(html)
  parser.end()
  flushParagraph()

  return paragraphs
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/export/html-to-docx.ts
git commit -m "feat: add HTML to DOCX paragraph converter"
```

---

## Task 20: API — Export Manuscript

**Files:**
- Create: `app/api/export-manuscript/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Footer, PageNumber, NumberFormat, AlignmentType } from 'docx'
import { htmlToDocxParagraphs } from '@/app/lib/export/html-to-docx'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, draft } = await req.json()

    if (!userId || !projectId || !manuscriptId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`

    // Read manuscript
    const msDoc = await adminDb.doc(basePath).get()
    if (!msDoc.exists) {
      return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 })
    }
    const ms = msDoc.data()!

    if (ms.status !== 'complete' && !draft) {
      return NextResponse.json(
        { error: 'Manuscript must be complete to export. Pass draft: true for partial export.' },
        { status: 403 }
      )
    }

    // Read chapters
    const chapSnap = await adminDb
      .collection(`${basePath}/chapters`)
      .orderBy('chapterNumber', 'asc')
      .get()

    // Get author name from user profile
    const userDoc = await adminDb.doc(`users/${userId}`).get()
    const authorName = userDoc.exists ? (userDoc.data()?.displayName || 'Author') : 'Author'

    const bookTitle = ms.outlineSnapshot?.Title || ms.title

    // Build chapter sections
    const chapterSections = chapSnap.docs
      .filter(d => draft || d.data().status === 'complete')
      .filter(d => d.data().content)
      .map(d => {
        const ch = d.data()
        return {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: `Chapter ${ch.chapterNumber}: ${ch.title}`, bold: true, size: 48, font: 'Georgia' })],
              heading: HeadingLevel.HEADING_1,
              pageBreakBefore: true,
              spacing: { after: 400 },
            }),
            ...htmlToDocxParagraphs(ch.content),
          ],
        }
      })

    // Title page
    const titleSection = {
      properties: {},
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          children: [new TextRun({ text: bookTitle, bold: true, size: 72, font: 'Georgia' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: authorName, size: 36, font: 'Georgia' })],
          alignment: AlignmentType.CENTER,
        }),
        ...(draft ? [
          new Paragraph({ spacing: { before: 800 } }),
          new Paragraph({
            children: [new TextRun({ text: 'DRAFT', bold: true, size: 28, font: 'Georgia', color: '999999' })],
            alignment: AlignmentType.CENTER,
          }),
        ] : []),
      ],
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Georgia', size: 24 },
            paragraph: { spacing: { after: 200, line: 360 } },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: 'bullet-list',
            levels: [{ level: 0, format: NumberFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
          {
            reference: 'ordered-list',
            levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
        ],
      },
      sections: [titleSection, ...chapterSections],
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = bookTitle.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    })
  } catch (error) {
    console.error('[export-manuscript] error:', error)
    return NextResponse.json(
      { error: 'Failed to export manuscript', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/export-manuscript/route.ts
git commit -m "feat: add /api/export-manuscript DOCX export endpoint"
```

---

## Task 21: CommentPopover Component

**Files:**
- Create: `components/book-writer/CommentPopover.tsx`

- [ ] **Step 1: Create the comment popover**

```tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CommentPopoverProps {
  position: { top: number; left: number }
  selectedText: string
  onSubmit: (feedback: string) => void
  onClose: () => void
}

export default function CommentPopover({ position, selectedText, onSubmit, onClose }: CommentPopoverProps) {
  const [feedback, setFeedback] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!feedback.trim()) return
    onSubmit(feedback.trim())
    setFeedback("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <div
      className="absolute z-50 w-72 bg-white rounded-lg shadow-xl border border-purple-200 p-3"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
          <MessageSquare className="h-3.5 w-3.5" />
          Add Comment
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-xs text-gray-500 bg-yellow-50 rounded px-2 py-1 mb-2 line-clamp-2 italic">
        &ldquo;{selectedText}&rdquo;
      </div>
      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What should change? e.g., 'Add more data here'"
        className="w-full text-sm border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
        rows={3}
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!feedback.trim()}
          className="text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white"
        >
          Add Comment
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/book-writer/CommentPopover.tsx
git commit -m "feat: add CommentPopover component for inline commenting"
```

---

## Task 22: ContextPanel Component

**Files:**
- Create: `components/book-writer/ContextPanel.tsx`

- [ ] **Step 1: Create the context panel**

```tsx
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText, PenLine, Palette, History, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Section, StyleProfile, SectionComment } from "@/app/types/firebase"

interface ContextPanelProps {
  section: (Section & { id: string }) | null
  styleProfile: StyleProfile | null
  onAuthorNotesChange: (notes: string) => void
  onDeleteComment: (commentId: string) => void
  onScrollToComment: (commentId: string) => void
  onStyleReextract: () => void
  onRestoreVersion: (content: string) => void
  saving: boolean
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3.5 w-3.5 text-purple-500" />
        {title}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

export default function ContextPanel({
  section,
  styleProfile,
  onAuthorNotesChange,
  onDeleteComment,
  onScrollToComment,
  onStyleReextract,
  onRestoreVersion,
  saving,
}: ContextPanelProps) {
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localNotes, setLocalNotes] = useState(section?.authorNotes || "")

  useEffect(() => {
    setLocalNotes(section?.authorNotes || "")
  }, [section?.id, section?.authorNotes])

  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      onAuthorNotesChange(value)
    }, 10000)
  }, [onAuthorNotesChange])

  if (!section) {
    return (
      <div className="w-[280px] border-l border-gray-200 bg-gray-50/50 flex items-center justify-center">
        <p className="text-xs text-gray-400 px-4 text-center">Select a section to see context</p>
      </div>
    )
  }

  const pendingComments = (section.comments || []).filter(c => c.status === "pending")

  return (
    <div className="w-[280px] border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
      <CollapsibleSection title="Outline Context" icon={FileText} defaultOpen={true}>
        <p className="text-xs text-gray-600 leading-relaxed">
          {section.outlineContext || "No outline context provided."}
        </p>
        {section.estimatedWords > 0 && (
          <p className="text-xs text-gray-400 mt-2">Target: ~{section.estimatedWords} words</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Author Notes" icon={PenLine} defaultOpen={true}>
        <textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add direction for AI generation..."
          className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 min-h-[80px]"
        />
        <p className="text-xs text-gray-400 mt-1">
          {saving ? "Saving..." : "Auto-saves after 10s"}
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Style Profile" icon={Palette} defaultOpen={false}>
        {styleProfile ? (
          <div className="space-y-2">
            {(["tone", "vocabulary", "sentenceStructure", "narrativeApproach", "pointOfView"] as const).map(field => (
              <div key={field}>
                <span className="text-xs font-medium text-gray-500 capitalize">{field.replace(/([A-Z])/g, " $1")}:</span>
                <p className="text-xs text-gray-700">{styleProfile[field]}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={onStyleReextract} className="text-xs h-6 text-purple-600">
              Re-extract
            </Button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Not yet extracted. Available after 3 sections are approved.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={`Revision History (${section.revisionHistory?.length || 0})`} icon={History} defaultOpen={false}>
        {(section.revisionHistory || []).length === 0 ? (
          <p className="text-xs text-gray-400">No revisions yet.</p>
        ) : (
          <div className="space-y-2">
            {[...section.revisionHistory].reverse().map((rev) => (
              <div key={rev.version} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Version {rev.version}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestoreVersion(rev.content)}
                  className="text-xs h-5 text-purple-600"
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {section.status === "review" && (
        <CollapsibleSection title={`Comments (${pendingComments.length})`} icon={MessageSquare} defaultOpen={true}>
          {pendingComments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments. Highlight text and click the comment button to add feedback.</p>
          ) : (
            <div className="space-y-2">
              {pendingComments.map((c) => (
                <div
                  key={c.id}
                  className="bg-yellow-50 rounded p-2 cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => onScrollToComment(c.id)}
                >
                  <p className="text-xs text-gray-500 italic line-clamp-1">&ldquo;{c.selectedText}&rdquo;</p>
                  <p className="text-xs text-gray-700 mt-1">{c.authorFeedback}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteComment(c.id) }}
                    className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/book-writer/ContextPanel.tsx
git commit -m "feat: add ContextPanel component with outline, notes, style, history, comments"
```

---

## Task 23: SectionEditor Component

**Files:**
- Create: `components/book-writer/SectionEditor.tsx`

This is the largest UI component — the center panel with 4 states. Due to its complexity, the implementing agent should read the full spec Section 5.3 and 5.4 from `docs/superpowers/specs/2026-04-28-bookwriter-coauthoring-design.md` before building.

- [ ] **Step 1: Create SectionEditor with all 4 states**

Build `components/book-writer/SectionEditor.tsx` implementing:

**State A (not_started):** Shows section title, author notes textarea, "Generate AI Draft" and "Write Manually" buttons.

**State B (generating):** Loading overlay with spinner and cancel button.

**State C (review):** Full Tiptap editor with toolbar including comment button (Cmd+Shift+M shortcut). Action bar with "Apply AI Revisions (N)", "Approve & Next →", "Regenerate" buttons. Uses `@tiptap/extension-highlight` for comment highlights. Integrates CommentPopover for adding comments on selected text.

**State D (approved):** Read-only content display with "Make Changes" button and confirmation dialog.

**Props interface:**
```typescript
interface SectionEditorProps {
  section: (Section & { id: string }) | null
  chapterTitle: string
  chapterNumber: number
  totalSections: number
  sections: (Section & { id: string })[]
  onGenerateDraft: (authorNotes?: string) => void
  onSaveContent: (html: string, wordCount: number) => void
  onApprove: () => void
  onApplyRevisions: () => void
  onRegenerate: () => void
  onMakeChanges: () => void
  onAddComment: (comment: { selectedText: string; startOffset: number; endOffset: number; authorFeedback: string }) => void
  onSelectSection: (sectionId: string) => void
  generating: boolean
  revising: boolean
  saving: boolean
}
```

The editor should:
- Use `useEditor` with `immediatelyRender: false`, StarterKit, Placeholder, and Highlight extensions
- Debounce autosave at 10 seconds (reuse pattern from existing ChapterEditor)
- Show section navigation tabs at the bottom (§ 1 ✅ | § 2 📝 | § 3 🔒 | § 4 🔒)
- Show word count and save status in footer

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/book-writer/SectionEditor.tsx
git commit -m "feat: add SectionEditor component with 4 states, comments, and section tabs"
```

---

## Task 24: Update ChapterSidebar

**Files:**
- Modify: `components/book-writer/ChapterSidebar.tsx`

- [ ] **Step 1: Add section expansion to sidebar**

Update `ChapterSidebar.tsx` to:
- Accept new props: `sections`, `activeSectionId`, `onSelectSection`, `onPlanSections`
- When a chapter is clicked, expand it to show its sections below
- Each section row shows: status icon (Lock/Circle/Spinner/PenLine/CheckCircle), section number, title (truncated 30 chars), word count
- Active section highlighted with purple left border
- Locked sections (sectionNumber > current + 1 and not approved) show lock icon and are non-clickable
- Chapters without a section plan show a "Plan Sections" button
- Chapter rows show progress bar based on `completedSections / totalSections`
- Only one chapter expanded at a time (accordion behavior)

**Updated props interface:**
```typescript
interface ChapterSidebarProps {
  chapters: (ChapterDocument & { id: string })[]
  activeChapterId: string | null
  sections: (Section & { id: string })[]
  activeSectionId: string | null
  onSelectChapter: (id: string) => void
  onSelectSection: (id: string) => void
  onPlanSections: (chapterId: string) => void
  totalWordCount: number
  completedCount: number
  planningChapterId: string | null
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/book-writer/ChapterSidebar.tsx
git commit -m "feat: update ChapterSidebar with section expansion and progress tracking"
```

---

## Task 25: Update BookWriter Main Component

**Files:**
- Modify: `components/sections/BookWriter.tsx`

This is the largest change — rewiring the main component from chapter-level to section-level flow with three-panel layout. The implementing agent should read the full spec Sections 5.1-5.8 and the existing `BookWriter.tsx` before building.

- [ ] **Step 1: Rewrite BookWriter with three-panel layout**

Update `components/sections/BookWriter.tsx` to:

**Layout:** Three-panel layout — ChapterSidebar (240px) | SectionEditor (flex-1) | ContextPanel (280px). Mobile: left/right panels collapse.

**New state:**
```typescript
sections: (Section & { id: string })[]
activeSectionId: string | null
planningChapterId: string | null
revising: boolean
```

**New handlers:**
- `handlePlanSections(chapterId)` — calls `/api/plan-sections`, loads created sections
- `handleGenerateDraft(authorNotes?)` — calls `/api/write-section`, updates section state
- `handleApproveSection()` — calls `/api/approve-section`, auto-advances to next section, triggers style extraction if `shouldExtractStyle` is true
- `handleApplyRevisions()` — calls `/api/revise-section` with pending comments from active section
- `handleRegenerate()` — calls `/api/write-section` with `regenerate: true`
- `handleMakeChanges()` — updates section status from `approved` to `review` via `saveSection`
- `handleAddComment(comment)` — adds comment to active section's `comments[]` array in Firestore
- `handleDeleteComment(commentId)` — removes comment from array
- `handleSaveSectionContent(html, wordCount)` — debounced save to Firestore
- `handleAuthorNotesChange(notes)` — saves author notes to section doc
- `handleExportDocx()` — calls `/api/export-manuscript`, triggers file download
- `handleSaveToProject()` — calls `saveManuscriptToProject` with summary snapshot

**Section loading:** When a chapter is selected and has a section plan, load all sections via `getAllSections`. When a section is selected, set `activeSectionId`.

**Stale generation cleanup:** On section load, if status is `generating` and `updatedAt` is older than 3 minutes, reset to `not_started` and show toast.

**Dynamic imports:** SectionEditor and ContextPanel should be dynamically imported with `ssr: false`.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/sections/BookWriter.tsx
git commit -m "feat: rewrite BookWriter with three-panel layout and section-level co-authoring"
```

---

## Task 26: Verify Full Build & Manual Testing

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Fix any type errors or import issues.

- [ ] **Step 2: Start dev server and manual test**

```bash
npm run dev
```

Test the following flow:
1. Navigate to Book Writer tab
2. Select a project with an outline
3. Create a new manuscript
4. Click a chapter → click "Plan Sections" → verify sections appear
5. Click Section 1 → add author notes → click "Generate AI Draft"
6. Wait for generation → verify content appears in editor
7. Add a comment via text selection → verify highlight appears
8. Click "Apply AI Revisions" → verify revision applies
9. Click "Approve & Next →" → verify auto-advance to Section 2
10. Verify Section 2 can be generated (linear flow works)

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from full integration"
```

---

## Dependency Order

```
Task 1 (deps)
  → Task 2 (types)
  → Task 3 (anthropic client)
  → Task 4 (firestore rules)
  → Task 5 (firebase services)
  → Task 6 (billing)
  → Task 7 (context builder) — depends on Task 2, 3, 5
  → Tasks 8-12 (agents) — depend on Task 3, 7 — can run in parallel
  → Tasks 13-18 (API routes) — depend on agents + context builder — sequential
  → Tasks 19-20 (export) — depend on Task 2, 5 — can run in parallel with API routes
  → Task 21 (CommentPopover) — no backend dependency
  → Task 22 (ContextPanel) — no backend dependency
  → Task 23 (SectionEditor) — depends on Task 21
  → Task 24 (ChapterSidebar update) — depends on Task 2
  → Task 25 (BookWriter rewrite) — depends on all previous tasks
  → Task 26 (verification) — depends on all
```
