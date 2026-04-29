# BookWriter Co-Authoring System — Detailed Design

**Date**: 2026-04-28
**Scope**: Phases 3-6 of BookWriter PRD — section-level architecture, co-authoring UI, chapter assembly, full agent architecture
**Stack**: Next.js (App Router), Tailwind CSS, shadcn/ui, Firebase Firestore, Tiptap, Claude API (Anthropic SDK)

---

## Design Decisions

These decisions were made during the design process and are not negotiable during implementation:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Author persona | Both first-time and experienced | UI must flex for heavy AI reliance and heavy manual editing |
| Section flow | Strict linear — must approve N before generating N+1 | Guarantees context integrity at the cost of speed |
| Revision model | Inline editing + highlight-and-comment, batch "Apply AI Revisions" | Real co-authoring feel, not a feedback dialog |
| Batch generation | None — one section at a time, no pre-buffering | Quality over speed; author stays close to the frontier |
| Architecture | Context Builder Pattern (Approach C) | Stateless APIs on Vercel, pre-computed summaries avoid redundant reads |
| Custom LLM | No — use style profiles + accumulated context instead | Training cost ($10K-$50K+), data problems, maintenance burden. In-context learning via style profiles gets 90% of the benefit at 1% of the cost |

---

## 1. Data Model

### 1.1 New: `Section` Subcollection

**Path**: `projects/{pid}/manuscripts/{mid}/chapters/{cid}/sections/{sid}`

```typescript
interface Section {
  id: string
  sectionNumber: number              // 1-based within chapter
  title: string                      // e.g., "The Rise of Herbal Medicine"
  status: 'not_started' | 'generating' | 'review' | 'approved'
  content: string                    // HTML from Tiptap
  wordCount: number
  outlineContext: string             // What this section covers (from planner agent)
  estimatedWords: number             // Target word count from planner

  // Comments system (embedded, not subcollection)
  comments: {
    id: string
    selectedText: string             // The highlighted passage
    startOffset: number              // Character position in text-only content
    endOffset: number
    authorFeedback: string           // "Add more data here"
    status: 'pending' | 'resolved'
    createdAt: Timestamp
  }[]

  // Revision tracking (capped at 10 entries)
  revisionCount: number
  revisionHistory: {
    version: number
    content: string
    resolvedComments: string[]       // Comment IDs addressed in this revision
    createdAt: Timestamp
  }[]

  // Pre-computed context (written on approval by summarizer agent)
  approvedSummary?: string           // 2-3 sentence summary
  lastParagraph?: string             // Last paragraph text (for transitions)

  // Author input
  authorNotes: string                // Author's direction for this section

  aiGenerated: boolean
  approvedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Design rationale**:
- Comments embedded (not subcollection) because there are typically 1-10 per section and they must be read atomically with content.
- Revision history embedded but capped at 10. On 11th revision, oldest is dropped. Prevents document bloat — a section with 20 rewrites would accumulate ~100KB of HTML history.
- `approvedSummary` and `lastParagraph` are denormalized — written at approval time to avoid re-reading full content when building context for the next section.
- Status machine is intentionally simple: `not_started -> generating -> review -> approved`. Revision is re-entering `review` after comments are applied, not a separate state.

### 1.2 Updated: `ChapterDocument`

```typescript
interface ChapterDocument {
  chapterNumber: number
  title: string
  status: 'not_started' | 'planning' | 'writing' | 'complete'
  totalSections: number
  completedSections: number          // Count of approved sections
  content: string                    // Assembled from approved sections (read-only composite)
  wordCount: number
  outlineContext: { summary: string; keyTopics: string[] }

  // Pre-computed context (updated on chapter completion)
  chapterSummary?: string

  // Section plan (written by planner agent, stored here not as subdocs)
  sectionPlan: {
    sectionNumber: number
    title: string
    outlineContext: string
    estimatedWords: number
  }[]

  aiGenerated: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Why `sectionPlan` lives on the chapter doc**: It's small metadata (typically 3-5 entries, ~500 bytes). Storing it here avoids an extra subcollection read when displaying the chapter's section list. The actual section *content* lives in the subcollection.

### 1.3 New: `StyleProfile` on Manuscript

```typescript
interface StyleProfile {
  tone: string                       // "conversational but authoritative"
  vocabulary: string                 // "accessible, uses analogies over jargon"
  sentenceStructure: string          // "mix of short punchy and longer flowing"
  narrativeApproach: string          // "opens with anecdotes, supports with data"
  pointOfView: string               // "second person (you/your)"
  extractedFromSections: string[]    // Section IDs used to derive this
  authorOverrides?: string           // Manual author notes on voice
  lastExtractedAt: Timestamp
}
```

Added to `Manuscript` interface as `styleProfile?: StyleProfile`.

### 1.4 Firestore Path Summary

```
projects/{pid}/
  manuscripts/{mid}/
    - ...manuscript fields + styleProfile
    chapters/{cid}/
      - ...chapter fields + sectionPlan
      sections/{sid}/
        - ...section fields + comments[] + revisionHistory[]
```

### 1.5 Security Rules

```
match /chapters/{chapterId} {
  // ...existing rules...
  match /sections/{sectionId} {
    allow read, write: if request.auth != null
      && request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.userId;
    allow create: if request.auth != null
      && request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.userId;
  }
}
```

### 1.6 Data Model Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Revision history at cap (10 entries) | Drop oldest entry before appending new one. Log the drop. |
| `approvedSummary` missing (summarizer failed) | Context Builder falls back to truncating section's full content to 200 words. Requires one extra Firestore read for that section. |
| Section plan needs regeneration | Overwrite `sectionPlan` on chapter doc. Delete and recreate all section subdocs. Only allowed if no sections are approved. |
| Assembled chapter content exceeds 500KB | Firestore doc limit is 1MB. A 30K word chapter is ~180KB HTML. If somehow exceeded, skip assembly and generate on-demand from sections. |
| Author edits approved section | Section status reverts to `review`. Chapter status reverts from `complete` to `writing`. Downstream sections remain locked until re-approval. |

---

## 2. Context Builder Module

**File**: `app/lib/context/context-builder.ts`

Single responsibility: given IDs, read Firestore and return a structured context object ready for any agent.

### 2.1 WritingContext Interface

```typescript
interface WritingContext {
  // Book-level
  bookTitle: string
  fullOutline: { chapterNumber: number; title: string; summary: string }[]
  styleProfile: StyleProfile | null

  // Chapter-level
  currentChapter: {
    number: number
    title: string
    summary: string
    keyTopics: string[]
    sectionPlan: SectionPlanEntry[]
  }

  // Section-level
  currentSection: {
    number: number
    title: string
    outlineContext: string
    estimatedWords: number
    currentContent?: string          // If revising
    comments?: Comment[]             // If applying revisions
    authorNotes?: string
  }

  // Accumulated context
  previousSectionsInChapter: {
    sectionNumber: number
    title: string
    approvedSummary: string          // Pre-computed on approval
    lastParagraph: string            // For transitions
  }[]
  previousChapters: {
    chapterNumber: number
    title: string
    chapterSummary: string           // Pre-computed on chapter completion
  }[]
}
```

### 2.2 Firestore Read Strategy

At most 4 reads per call, regardless of book length:

| Read | Document(s) | Fields Used |
|------|-------------|-------------|
| 1 | Manuscript doc | title, outlineSnapshot, styleProfile |
| 2 | Current chapter doc | sectionPlan, outlineContext |
| 3 | Approved sections in current chapter (query: `status == 'approved'`, order by `sectionNumber`) | approvedSummary, lastParagraph only |
| 4 | Completed chapter docs (query: `status == 'complete'`, order by `chapterNumber`) | chapterSummary only |

Read #3 and #4 return denormalized summary fields, not full content. Small documents.

### 2.3 Public API

```typescript
// For generating a new section
ContextBuilder.forSectionGeneration(
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionNumber: number
): Promise<WritingContext>

// For applying revisions (includes current content + comments)
ContextBuilder.forRevision(
  projectId: string,
  manuscriptId: string,
  chapterId: string,
  sectionId: string
): Promise<WritingContext>

// For style extraction (reads full content of specified sections)
ContextBuilder.forStyleExtraction(
  projectId: string,
  manuscriptId: string,
  sectionIds: string[]
): Promise<{ sections: { title: string; content: string }[] }>
```

### 2.4 Token Budget Enforcement

Hard limits per context component to prevent overflow:

| Component | Token Budget | Strategy |
|-----------|-------------|----------|
| System prompt + style profile | 1,500 | Static per call |
| Full book outline | 2,000 | All chapter titles + one-line summaries |
| Previous chapter summaries | 3,000 | ~150 tokens per chapter x 20 max |
| Previous sections (current chapter) | 2,500 | ~200 tokens per section x ~12 max |
| Current section context | 1,500 | Outline context + author notes + comments |
| **Generation space** | **~90,000** | Remaining for output (~5000 words max) |

**Overflow handling**: If previous chapter summaries exceed 3,000 tokens (25+ chapters), truncate oldest chapters to one-sentence summaries. Last 3 chapters always keep full summaries. The outline always provides structural backbone regardless.

### 2.5 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Chapter 1, Section 1 (no previous context) | Empty arrays for previousSections and previousChapters. styleProfile is null. Agent gets outline + section context only. |
| Missing approvedSummary (summarizer failed) | Fall back to truncating section's full content to 200 words. One extra Firestore read for that section only. |
| Style profile not yet extracted | Return `styleProfile: null`. Writer agent uses fallback: "Professional, accessible non-fiction style." |
| Very long books (30+ chapters) | Keep last 5 chapters with full summaries, compress earlier to title-only. Outline always included. |
| Concurrent writes (two tabs) | No caching across requests. Builder always reads fresh. Last-write-wins. Autosave timestamps allow future conflict detection. |

---

## 3. Agent Architecture

Six agents, each with a single responsibility. All Claude models via the Anthropic SDK.

### 3.1 Agent Roster

| Agent | File | Model | Max Tokens Out | Temperature | Purpose |
|-------|------|-------|---------------|-------------|---------|
| Section Planner | `section-planner-agent.ts` | Claude Sonnet 4.6 | 2,000 | 0.5 | Break chapter into 3-5 sections |
| Section Writer | `section-writer-agent.ts` | Claude Sonnet 4.6 | 8,000 | 0.7 | Generate one section draft |
| Revision Agent | `revision-agent.ts` | Claude Sonnet 4.6 | 8,000 | 0.6 | Revise section based on comments |
| Style Extractor | `style-extractor-agent.ts` | Claude Sonnet 4.6 | 1,000 | 0.3 | Extract voice/style profile |
| Section Summarizer | `section-summarizer-agent.ts` | Claude Haiku 4.5 | 500 | 0.2 | Summarize approved section |
| Chapter Summarizer | `chapter-summarizer-agent.ts` | Claude Haiku 4.5 | 500 | 0.2 | Summarize completed chapter |

Lower temperature for analytical tasks (style extraction, summarization). Higher for creative writing.

### 3.2 Section Planner Agent

**Input**:
```typescript
{
  bookTitle: string
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  keyTopics: string[]
  totalChapters: number
  previousChapterTitles: string[]
}
```

**Output** (JSON mode):
```typescript
{
  sections: {
    sectionNumber: number
    title: string
    outlineContext: string           // 2-3 sentences describing what to cover
    estimatedWords: number           // 600-1500
  }[]
}
```

**System prompt rules**:
- Generate 3-5 sections per chapter
- First section introduces the chapter's theme and connects to the previous chapter
- Last section concludes and sets up the next chapter
- Every key topic from the outline must be covered by at least one section
- Distribute word count by topic complexity, not evenly
- Section titles must be specific and descriptive ("The Chemistry of Essential Oils" not "Overview")

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Short chapter (1-2 key topics) | Minimum 2 sections. Even simple chapters need intro + substance. |
| Long chapter (8+ key topics) | Maximum 7 sections. Group related topics. |
| First chapter of book | System prompt adds: include a section orienting the reader to the book's purpose and scope. |
| Last chapter of book | System prompt adds: include a concluding/forward-looking section. |

### 3.3 Section Writer Agent

**Input**: Full `WritingContext` from Context Builder.

**Output** (raw HTML, not JSON mode):
```typescript
{
  content: string                    // HTML with <h3>, <p>, <ul>, <ol>
  wordCount: number
}
```

**System prompt structure** (ordered by placement priority — role first, task last):

```
1. Role: "You are a book co-author..."
2. Style profile (if available): "Match this voice: {tone}, {vocabulary}..."
3. Book outline (compact): chapter titles + one-line summaries
4. Previous chapter summaries: "Previously: Ch1 covered X, Ch2 covered Y..."
5. Current chapter context: title, summary, full section plan
6. Previous sections in this chapter: summary + last paragraph of each
7. CURRENT TASK: "Write Section {N}: {title}. Cover: {outlineContext}. Target: {estimatedWords} words."
8. Author notes (if any): "The author has requested: {notes}"
9. Constraints: HTML format, no meta-commentary, transition from previous, substantive only
```

**Rationale for order**: LLMs attend most strongly to beginning and end of context. Role/style goes first (persistent instructions). Specific task goes last (immediate focus). Middle is reference material.

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| First section of first chapter | No previous context. Prompt: "This is the opening of the book. Hook the reader immediately." |
| First section of later chapters | Empty previous sections, but previous chapters have summaries. Prompt: "Open with a transition from the previous chapter's themes." |
| No style profile yet | Fallback: "Professional, accessible non-fiction. Balance data and narrative. Avoid jargon." |
| Author notes conflict with outline | Author notes take priority. Prompt: "Author's notes override outline context where they conflict." |
| Output too short (< 50% of target) | API returns warning flag. Author decides whether to accept or regenerate. No auto-retry. |
| Output too long (> 200% of target) | Same — flag, don't truncate. Author decides. |

### 3.4 Revision Agent

**Input**:
```typescript
{
  context: WritingContext
  currentContent: string             // Section's current HTML
  comments: {
    selectedText: string
    authorFeedback: string
  }[]
}
```

**Output**:
```typescript
{
  content: string                    // Revised HTML
  wordCount: number
  changesApplied: string[]           // Brief description of each change
}
```

**System prompt rules**:
- Revise, don't rewrite. Preserve everything not commented on.
- For each comment: find `selectedText`, apply `authorFeedback` to that passage only.
- If author made manual edits (content differs from last AI version), respect those edits — they are intentional.
- After applying changes, re-read full section to ensure natural flow. Make minimal transition adjustments only.
- Return `changesApplied` so the UI can show the author what changed.

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Selected text no longer exists (author deleted it) | Skip that comment. Include in changesApplied: "Skipped: selected text not found." |
| Contradictory comments (one says formal, another says casual) | Apply each locally to its passage. Don't reconcile globally. |
| Comment with no selected text (general feedback) | Treat as whole-section directive. Apply globally. |
| Agent returns identical content (no changes) | Return with changesApplied: ["No changes were needed."]. Don't save to revision history. |
| 10+ comments in one batch | Process all. No limit. Token budget sufficient. |

### 3.5 Style Extractor Agent

**Input**:
```typescript
{
  sections: { title: string; content: string }[]
  authorPreferences?: string
}
```

**Output** (JSON mode):
```typescript
{
  tone: string
  vocabulary: string
  sentenceStructure: string
  narrativeApproach: string
  pointOfView: string
}
```

**Trigger schedule**:
- After 3rd section approved (first extraction)
- Every 5th approved section thereafter (re-extraction)
- Manually via "Re-extract" button

**Key behavior**:
- Analyzes approved content (including author's manual edits) — learns the *author's* voice, not the AI's default.
- Describes style in concrete, actionable terms: "uses second-person address, short paragraphs of 2-3 sentences, opens sections with rhetorical questions."
- If sections are stylistically inconsistent, notes the inconsistency in each field. Writer agent gravitates toward the more recent style.
- Author overrides (manual text field) are appended to the prompt and take priority over analysis.

### 3.6 Summarizer Agents

**Section Summarizer** — Input/Output:
```typescript
// Input
{ sectionTitle: string; content: string }

// Output (JSON mode)
{ summary: string; lastParagraph: string }
// summary: 2-3 sentences
// lastParagraph: text of the last <p> tag (for transitions)
```

**Chapter Summarizer** — Input/Output:
```typescript
// Input
{ chapterTitle: string; sectionSummaries: { title: string; summary: string }[] }

// Output (JSON mode)
{ chapterSummary: string; keyPointsCovered: string[] }
// chapterSummary: 3-5 sentences
// keyPointsCovered: list of main topics addressed
```

**Triggers**:
- Section summarizer: immediately on section approval (async, non-blocking to the approval response)
- Chapter summarizer: when last section in chapter is approved

**Failure handling**: Non-fatal. `approvedSummary` stays empty. Context Builder falls back to content truncation (see Section 2.5). Approval still succeeds.

**Re-summarization**: If author edits an approved section and re-approves, summarizer runs again. Old summary overwritten. Downstream sections that used the old summary are not re-generated — acceptable drift since summaries are compressed context.

---

## 4. API Routes

Seven routes covering the full section lifecycle. All stateless, all use the Context Builder.

### 4.1 Route Overview

| Route | Method | Agent | Usage Charged |
|-------|--------|-------|---------------|
| `/api/plan-sections` | POST | section-planner | No (planning is free) |
| `/api/write-section` | POST | section-writer | Yes (1 unit per generation) |
| `/api/revise-section` | POST | revision-agent | No (revisions are unlimited) |
| `/api/approve-section` | POST | section-summarizer | No |
| `/api/extract-style` | POST | style-extractor | No |
| `/api/complete-chapter` | POST | chapter-summarizer | No |
| `/api/write-chapter` | POST | writer-agent (legacy) | Yes (backward compat) |

### 4.2 `POST /api/plan-sections`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  chapterId: string
}
```

**Response 200**:
```typescript
{
  sections: {
    sectionNumber: number
    title: string
    outlineContext: string
    estimatedWords: number
  }[]
}
```

**Flow**:
1. Validate all IDs exist
2. Read chapter doc (outline context: summary, keyTopics)
3. Read manuscript doc (book title, full outline)
4. Read completed chapter docs (previous chapter titles for structural awareness)
5. Call `planSections()` agent
6. Write `sectionPlan` to chapter doc
7. Create empty section subdocs for each planned section
8. Set chapter status `not_started` -> `writing`
9. Return section plan

**Auth**: Verify `userId` matches project owner via Admin SDK.

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Chapter already has sections | Return 409 Conflict. Client must provide `replan: true` flag which wipes and recreates. |
| Outline has no summary/keyTopics | Planner works from chapter title only. Lower quality. UI warns user their outline is thin. |
| Planner returns invalid JSON | Retry once. If still invalid, return 500. |
| Previous chapter not complete (cross-chapter enforcement) | Return 403: "Chapter {N-1} must be completed first." Exception: chapter 1 always allowed. |

### 4.3 `POST /api/write-section`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  chapterId: string
  sectionId: string
  authorNotes?: string
  regenerate?: boolean              // If true, replaces existing content (section must be in 'review')
}
```

**Response 200**:
```typescript
{
  content: string
  wordCount: number
  warning?: string
}
```

**Flow**:
1. Validate all IDs
2. Enforce linear flow: verify previous section is `approved` (or this is section 1)
3. Verify section status is `not_started` OR (`review` and request includes `regenerate: true`)
4. If regenerating: save current content to `revisionHistory`, clear comments
5. Set section status to `generating`
6. Check usage limit (but don't increment yet)
7. `ContextBuilder.forSectionGeneration(...)` — assemble context
8. Call `generateSectionDraft()` agent
9. Increment usage (only after successful generation)
10. Write content, wordCount, status=`review`, aiGenerated=true to section doc
11. Check word count vs estimated: if < 50% or > 200%, set warning
12. Return content + wordCount + warning

**`maxDuration`**: 120 seconds.

**Linear flow enforcement**:
```typescript
async function enforceLinearFlow(chapterId, sectionNumber) {
  if (sectionNumber === 1) return
  const sections = await getAllSections(projectId, manuscriptId, chapterId)
  const prev = sections.find(s => s.sectionNumber === sectionNumber - 1)
  if (!prev || prev.status !== 'approved') {
    throw new ApiError(403, `Section ${sectionNumber - 1} must be approved first`)
  }
}
```

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Previous section not approved | Return 403 with message. |
| Section in `review` without `regenerate: true` | Return 409. Must use revise-section or pass `regenerate: true`. |
| Section in `approved` status | Return 409. Author must click "Make Changes" first (sets to `review`), then regenerate. |
| Generation fails after usage check | Usage not incremented (increment happens after success only). |
| Author cancels mid-generation (AbortController) | Claude API call completes server-side, response dropped. Section stuck in `generating`. |
| Stale `generating` status (>3 min old) | On next client read, if `generating` and `updatedAt > 3 min ago`, reset to `not_started`. Toast: "Previous generation timed out." |

### 4.4 `POST /api/revise-section`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  chapterId: string
  sectionId: string
  comments: {
    selectedText: string
    authorFeedback: string
  }[]
}
```

**Response 200**:
```typescript
{
  content: string
  wordCount: number
  changesApplied: string[]
}
```

**Flow**:
1. Validate all IDs
2. Verify section status is `review`
3. Read current section content
4. `ContextBuilder.forRevision(...)` — includes content + comments
5. Call `reviseSection()` agent
6. Save old content to `revisionHistory` (append, cap at 10 — drop oldest if at cap)
7. Write new content, increment `revisionCount`, mark processed comments as `resolved`
8. Status stays `review`
9. Return revised content + changes summary

**Usage**: Free. No charge for revisions. Unlimited revisions are a key selling point.

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Empty comments array | Return 400. |
| Revision history at cap (10) | Drop oldest, append new. |
| Selected text appears multiple times | Match first occurrence. Client can send `startOffset` for disambiguation in future. |
| Agent returns identical content | Return with changesApplied: ["No changes needed."]. Don't save to history. |

### 4.5 `POST /api/approve-section`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  chapterId: string
  sectionId: string
}
```

**Response 200**:
```typescript
{
  summary: string
  isLastSection: boolean
  chapterComplete: boolean
}
```

**Flow**:
1. Validate IDs, verify section status is `review`
2. Read section content
3. Call `summarizeSection()` (Haiku) — get summary + last paragraph
4. Write: status=`approved`, approvedSummary, lastParagraph, approvedAt
5. Update chapter: increment `completedSections`, update `wordCount`
6. Check if all sections approved -> if yes, `isLastSection=true`
7. If last section: trigger chapter completion inline
8. Update manuscript progress (completedChapters, totalWordCount)
9. **Style profile trigger**: if total approved sections across manuscript is 3 (first time) or divisible by 5, fire style extraction async (non-blocking)
10. Return summary + completion flags

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Summarizer fails | Non-fatal. `approvedSummary` = empty. Approval succeeds. Context Builder has fallback. |
| Author wants to undo approval | No explicit unapprove. Author edits the section (sets it back to `review`). Must re-approve. |
| Last section of last chapter | Triggers both chapter completion and manuscript completion. Manuscript status -> `complete`. |

### 4.6 `POST /api/extract-style`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  sectionIds: string[]
}
```

**Response 200**:
```typescript
{
  styleProfile: StyleProfile
}
```

**Flow**:
1. Validate IDs
2. `ContextBuilder.forStyleExtraction(...)` — reads full content of specified sections
3. Read existing author overrides from manuscript
4. Call `extractStyleProfile()` agent
5. Write style profile to manuscript doc
6. Return profile

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Fewer than 2 sections | Return 400. Need 2+ for meaningful extraction. |
| Sections from different chapters | Fine — better for cross-chapter consistency. |
| Author has existing overrides | Passed to agent. Agent incorporates rather than overwriting. |

### 4.7 `POST /api/complete-chapter`

**Request**:
```typescript
{
  userId: string
  projectId: string
  manuscriptId: string
  chapterId: string
}
```

**Response 200**:
```typescript
{
  chapterSummary: string
  totalWordCount: number
}
```

**Flow**:
1. Verify all sections approved
2. Read all section contents in order
3. Concatenate into chapter `content` field (assembled HTML)
4. Read all section summaries
5. Call `summarizeChapter()` (Haiku)
6. Write: content (assembled), chapterSummary, status=`complete`, wordCount
7. Update manuscript progress
8. Return summary + word count

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Not all sections approved | Return 403. |
| Chapter already complete | Return 409. To re-complete, author must unapprove at least one section. |

### 4.8 Cross-Chapter Linear Enforcement

```typescript
async function enforceChapterOrder(manuscriptId, chapterNumber) {
  if (chapterNumber === 1) return
  const chapters = await getAllChapters(projectId, manuscriptId)
  const prev = chapters.find(c => c.chapterNumber === chapterNumber - 1)
  if (!prev || prev.status !== 'complete') {
    throw new ApiError(403, `Chapter ${chapterNumber - 1} must be completed first`)
  }
}
```

Applied in `/api/plan-sections` before allowing a new chapter to be planned.

**Cascading edit scenario**: Author edits approved section in Chapter 2 -> section drops to `review` -> Chapter 2 status reverts to `writing` -> Chapter 3 blocked until Chapter 2 re-completed. This ensures context integrity.

---

## 5. Co-Authoring UI

### 5.1 Three-Panel Layout

```
+--------------------+--------------------------------+--------------------+
|  CHAPTER NAV       |  SECTION EDITOR                |  CONTEXT PANEL     |
|  (240px, fixed)    |  (flex-1, min-w-0)             |  (280px, fixed)    |
+--------------------+--------------------------------+--------------------+
```

**Mobile**: Left and right panels collapse. Chapter/section navigation becomes a dropdown at top. Context panel becomes a slide-out drawer triggered by an info button.

### 5.2 Left Panel — Chapter & Section Navigator

**Component**: Updated `ChapterSidebar.tsx`

**Chapter rows**: number, title, status icon, progress bar (sections completed / total).
- Click chapter -> expands section list beneath it. Other chapters collapse.
- Only active chapter expanded by default.

**Section rows**: number, title (truncated 30 chars), status icon.
- Active section: purple left border.
- Locked sections (unreachable due to linear flow): lock icon, non-clickable.

**Status icons**:

| Status | Icon | Color |
|--------|------|-------|
| `not_started` (locked) | Lock | Gray |
| `not_started` (next up) | Circle | Gray |
| `generating` | Spinner | Purple |
| `review` | PenLine | Amber |
| `approved` | CheckCircle | Green |

**Chapter status derived from sections**:
- All `not_started` -> chapter `not_started`
- Has section plan, no sections approved -> `writing`
- All sections approved -> `complete`

**Edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Chapter with no section plan | Show "Plan Sections" button instead of section list. |
| Author clicks approved section | Opens in read-only mode with "Make Changes" button. |
| 20+ chapters | Sidebar scrolls independently. Scroll position preserved. |
| Very long chapter titles | Truncate at 30 chars with ellipsis. Full title in hover tooltip. |

### 5.3 Center Panel — Section Editor

**Component**: New `SectionEditor.tsx` (wraps enhanced Tiptap editor)

**Four editor states**:

**State A — Not Started (next up)**:
- Section title displayed
- Optional author notes textarea: "Add direction before generating"
- Two buttons: "Generate AI Draft" and "Write Manually"
- Author notes saved to section doc, passed to writer agent

**State B — Generating**:
- Loading overlay: "Writing Section N... This may take 30-60 seconds"
- Cancel button (fires AbortController)

**State C — Review** (main editing state):
- Full Tiptap editor with content
- Toolbar: H1, H2, Bold, Italic, Bullet List, Ordered List, Undo, Redo, **Comment button**, Save
- Action bar below editor:
  - **"Apply AI Revisions (N)"**: Shows pending comment count. Disabled if 0. Calls `/api/revise-section`.
  - **"Approve & Next ->"**: Calls `/api/approve-section`. Auto-advances to next section.
  - **"Regenerate"**: Confirmation dialog ("This replaces current content. Edits and comments will be lost.") then calls `/api/write-section`.
  - Word count + save status bottom-right.

**State D — Approved** (read-only):
- Content displayed, not editable.
- "Make Changes" button -> confirmation dialog: "Editing requires re-approval. Sections after this will be locked." -> On confirm, status reverts to `review`.

### 5.4 Comment System

**Workflow**:
1. Author selects text in Tiptap editor
2. Clicks Comment button (or Cmd+Shift+M)
3. Small popover anchored to selection with textarea
4. Author types feedback: "Add more data about compound X"
5. Enter or "Add Comment" -> selected text gets yellow highlight
6. Comment appears in right panel's comment list
7. Author adds multiple comments across the section
8. Clicks "Apply AI Revisions" -> all comments processed in one batch

**Implementation**: Comments stored on section document, not as Tiptap marks. On editor load, `comments[]` is iterated, `selectedText` matched in HTML, highlight decorations applied. Uses `@tiptap/extension-highlight` for rendering.

**Anchoring edge cases**:

| Edge Case | Handling |
|-----------|----------|
| Author edits commented text | Highlight follows Tiptap decoration tracking. Shrinks if text partially deleted. |
| Author fully deletes commented text | Comment becomes orphaned. Shows "(text deleted)" in list. Revision agent receives original `selectedText` and interprets feedback. |
| Same text appears multiple times | Store `startOffset`/`endOffset` for disambiguation. Fall back to first occurrence if positions shifted. |
| Comment spans across HTML tags | Tiptap handles multi-node selections. Store plain-text extract. Revision agent matches on text, not HTML structure. |

### 5.5 Right Panel — Context Panel

**Component**: New `ContextPanel.tsx`

Five collapsible sections:

| Section | Default State | Content |
|---------|---------------|---------|
| Outline Context | Expanded | Read-only display of section's `outlineContext` |
| Author Notes | Expanded | Textarea, debounced save (10s), persists to section doc |
| Style Profile | Collapsed | Current profile fields. "Edit Profile" opens modal. "Re-extract" button. Shows "Not yet extracted" if null. |
| Revision History | Collapsed | List of previous versions with timestamps. Click to preview (read-only modal). "Restore" button replaces content, sets status to `review`. |
| Comments | Visible in review | List of pending comments. Click -> scroll editor to highlight. Delete button removes comment + highlight. |

### 5.6 Section Navigation Tabs

Bottom of center panel:

```
  section 1 checkmark  |  section 2 pen  |  section 3 lock  |  section 4 lock
```

- Approved: green check, clickable (opens read-only)
- Current: amber pen, active styling
- Locked: lock icon, non-clickable, grayed
- Section number only in tab, title in hover tooltip

### 5.7 UI State Transitions

**Flow 1: First time entering a chapter**
1. Click chapter (no section plan) -> center shows "Plan this chapter" with outline preview
2. Click "Plan Sections" -> loading -> section plan appears
3. Section tabs appear. Section 1 auto-selected in State A.

**Flow 2: Generating a section**
1. State A. Optionally type author notes.
2. Click "Generate AI Draft" -> State B
3. 30-60s -> State C with content

**Flow 3: Revision cycle**
1. Add comments via highlight + feedback
2. Click "Apply AI Revisions (N)" -> loading overlay (10-30s)
3. Revised content. Comments resolved. `changesApplied` shown as toast.
4. Can add more comments, edit manually, or approve.

**Flow 4: Approval and advance**
1. Click "Approve & Next ->"
2. Brief loading (summarizer)
3. Section -> approved. Tabs update.
4. Auto-advance to next section in State A.
5. If last section -> chapter completion -> advance to next chapter.

**Flow 5: Editing an approved section**
1. Click approved section -> read-only view
2. Click "Make Changes" -> confirmation dialog
3. On confirm: status -> `review`. Subsequent sections locked.
4. Edit, add comments, approve again.

### 5.8 UI Error Handling

| Error | UI Response |
|-------|-------------|
| Network error during generation | Error toast. Reset to `not_started`. Author retries. |
| Network error during revision | Error toast. Content unchanged. Comments remain pending. |
| Network error during approval | Error toast. Status stays `review`. Author retries. |
| Tab closed during generation | On next load: if `generating` and `updatedAt > 3 min`, reset to `not_started`. Toast: "Previous generation timed out." |
| Unsaved edits on navigate away | Debounced autosave fires on unmount (existing pattern). |
| Two tabs on same section | Last-write-wins. No conflict detection (single-author MVP). |
| Very long section (5000+ words) | Tiptap handles it. No special treatment. |

---

## 6. Chapter Assembly & Manuscript Completion

### 6.1 Chapter Assembly

When all sections in a chapter are approved (triggered by `/api/approve-section` detecting last section, or explicitly via `/api/complete-chapter`):

1. Read all section contents ordered by `sectionNumber`
2. Concatenate HTML: section 1 content + section 2 content + ... + section N content
3. Write assembled HTML to chapter `content` field
4. Sum all section word counts -> chapter `wordCount`
5. Call chapter summarizer agent -> `chapterSummary`
6. Set chapter status -> `complete`
7. Update manuscript: increment `completedChapters`, update `totalWordCount`

No transition-smoothing pass between sections. The writer agent already handles transitions via the `lastParagraph` context from the previous section. If transitions feel rough, the author can edit before approving.

### 6.2 Manuscript Completion

When the last chapter is completed:

1. Set manuscript status -> `complete`
2. Calculate final totals: total word count, total chapters completed
3. No auto-generated front matter (dedication, foreword) in this scope

### 6.3 Edge Case: Re-opening a Completed Chapter

1. Author clicks approved section in completed chapter
2. Clicks "Make Changes"
3. Section -> `review`. Chapter -> `writing`. Manuscript -> `in_progress`.
4. All chapters after this one remain as they are (content not invalidated) but generating new content in later chapters is blocked until this chapter is re-completed.
5. Author re-approves section -> chapter re-completes -> later chapters unblocked.

---

## 7. Usage & Billing

### 7.1 What Costs Money

| Action | Usage Unit | Charged? |
|--------|-----------|----------|
| Plan sections | - | Free |
| Generate section | `sections` | Yes (1 per generation) |
| Revise section | - | Free (unlimited) |
| Approve section | - | Free |
| Extract style | - | Free |
| Complete chapter | - | Free |
| Regenerate section | `sections` | Yes (counts as new generation) |

### 7.2 Tier Limits

```typescript
// Updated from 'chapters' to 'sections'
{
  free:    { insights: 3, outlines: 2, sections: 15, unlimited: false },
  creator: { insights: 25, outlines: 15, sections: 200, unlimited: false },
  beta:    { insights: 9999, outlines: 9999, sections: 9999, unlimited: true },
}
```

**Rationale**: A 12-chapter book with 4 sections per chapter = 48 sections. Free tier (15) lets a user write ~3 chapters to try the product. Creator (200) covers ~4 full books per month with room for regenerations.

### 7.3 Usage Increment Timing

Usage is checked before generation (to reject if over limit) but incremented only after successful generation. A failed API call does not consume a usage unit.

---

## 8. Migration from Current System

### 8.1 Backward Compatibility

The existing `/api/write-chapter` route and monolithic chapter generation remain functional. Existing manuscripts (created under the current system) continue to work — they simply don't have sections.

### 8.2 New Manuscripts Only

The section-level workflow applies only to newly created manuscripts. No migration of existing manuscripts is needed. The UI detects whether a manuscript has section-based chapters (check for `sectionPlan` on chapter doc) and renders accordingly:
- If `sectionPlan` exists -> new section-based workflow
- If `sectionPlan` is empty/missing -> legacy chapter-based workflow

### 8.3 Deprecation Path

After the section-based system is stable:
1. New manuscripts always use section-based flow
2. Legacy manuscripts remain readable/editable but "Start Writing" creates section-based manuscripts
3. `/api/write-chapter` remains as a fallback but is not exposed in new UI

---

## 9. Files Summary

### Files to Create

| File | Purpose |
|------|---------|
| `app/lib/context/context-builder.ts` | Assembles prompt context from Firestore |
| `app/lib/agents/section-planner-agent.ts` | Breaks chapters into sections |
| `app/lib/agents/section-writer-agent.ts` | Generates section drafts |
| `app/lib/agents/revision-agent.ts` | Revises sections from comments |
| `app/lib/agents/style-extractor-agent.ts` | Extracts voice/style profile |
| `app/lib/agents/section-summarizer-agent.ts` | Summarizes approved sections |
| `app/lib/agents/chapter-summarizer-agent.ts` | Summarizes completed chapters |
| `app/api/plan-sections/route.ts` | Section planning endpoint |
| `app/api/write-section/route.ts` | Section generation endpoint |
| `app/api/revise-section/route.ts` | Comment-based revision endpoint |
| `app/api/approve-section/route.ts` | Section approval + summarization |
| `app/api/extract-style/route.ts` | Style profile extraction |
| `app/api/complete-chapter/route.ts` | Chapter assembly + summarization |
| `components/book-writer/SectionEditor.tsx` | Section-level editor with 4 states |
| `components/book-writer/ContextPanel.tsx` | Right panel: outline, notes, style, history |
| `components/book-writer/CommentPopover.tsx` | Popover for adding comments on selected text |

### Files to Modify

| File | Change |
|------|--------|
| `components/sections/BookWriter.tsx` | Three-panel layout, section-level flow |
| `components/book-writer/ChapterSidebar.tsx` | Section expansion, section-level progress |
| `components/book-writer/ChapterEditor.tsx` | Add comment button to toolbar, delegate to SectionEditor |
| `app/types/firebase.ts` | Add Section, StyleProfile types. Update ChapterDocument. |
| `app/lib/firebase/services.ts` | Add section CRUD, style profile CRUD |
| `firestore.rules` | Add sections subcollection rules |
| `app/lib/billing/tiers.ts` | Replace `chapters` with `sections` usage type |
| `app/lib/billing/usage.ts` | Replace `'chapters'` with `'sections'` in type union |
