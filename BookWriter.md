# BookWriter — Product Requirements Document

## Vision

A co-authoring book writing app where an AI agent and a human author collaborate to write an entire book from an outline. The system breaks the book into chapters and sections, generates drafts section-by-section, presents each to the author for review and unlimited edits, then carries all context forward so every subsequent section builds on what came before — maintaining voice, continuity, and depth throughout the manuscript.

**Stack**: Next.js (App Router), Tailwind CSS, shadcn/ui, Firebase (Firestore + Hosting), Tiptap editor

---

## Core Principles

1. **Section-level granularity** — Don't generate an entire chapter at once. Break each chapter into 3-5 sections (800-1500 words each). Smaller units = better quality, easier review, tighter context.
2. **Human-in-the-loop always** — Every section is presented for review before the system moves on. The author can request unlimited rewrites, edits, or manual changes. Nothing advances without approval.
3. **Context accumulation** — Each agent call receives: the full outline, all previously approved sections (summarized), the current section's outline, and the author's style/tone preferences. Context grows richer as the book progresses.
4. **Consistent voice** — A "style profile" is extracted from the first approved sections and fed to all subsequent generation calls so the book reads as one coherent work.

---

## Current State (Phases 1-2 — Complete)

The foundation is built and working:

- **Tiptap editor** with toolbar (H1, H2, Bold, Italic, Lists, Undo/Redo), debounced autosave (10s), word count
- **Two-panel layout**: chapter sidebar (progress, status badges) + editor
- **Firestore data model**: `projects/{pid}/manuscripts/{mid}/chapters/{cid}`
- **AI generation**: GPT-4o generates full chapters via `/api/write-chapter`
- **Usage tracking**: `chapters` usage type in billing tiers

### What's Missing

- Chapters are generated as monolithic blocks (no section-level breakdown)
- No review/approve workflow — content drops into editor with no gating
- Context is limited to a 500-char summary of the previous chapter only
- No style learning or voice consistency enforcement
- No section-by-section co-authoring flow
- No rewrite/revision commands
- No manuscript export

---

## Phase 3 — Section-Level Architecture

### 3.1 Data Model Changes

**New: `Section` subcollection under chapters**

```
projects/{pid}/manuscripts/{mid}/chapters/{cid}/sections/{sid}
```

```typescript
interface Section {
  id: string
  sectionNumber: number           // 1-based within chapter
  title: string                   // e.g., "The Rise of Herbal Medicine"
  status: 'not_started' | 'generating' | 'review' | 'revision' | 'approved'
  content: string                 // HTML from Tiptap
  wordCount: number
  outlineContext: string          // What this section should cover (from outline)
  revisionHistory: {              // Track all AI generations for this section
    version: number
    content: string
    feedback?: string             // Author's revision request
    createdAt: Timestamp
  }[]
  authorNotes: string             // Author's notes/direction for this section
  aiGenerated: boolean
  approvedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Updated: `ChapterDocument`**

```typescript
interface ChapterDocument {
  chapterNumber: number
  title: string
  status: 'not_started' | 'writing' | 'review' | 'complete'
  totalSections: number
  completedSections: number
  content: string                 // Assembled from approved sections (read-only composite)
  wordCount: number
  outlineContext: { summary: string; keyTopics: string[] }
  aiGenerated: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**New: `StyleProfile` on Manuscript**

```typescript
interface StyleProfile {
  tone: string                    // e.g., "conversational but authoritative"
  vocabulary: string              // e.g., "accessible, avoids jargon, uses analogies"
  sentenceStructure: string       // e.g., "mix of short punchy and longer flowing"
  narrativeApproach: string       // e.g., "opens with anecdotes, uses data to support"
  extractedFrom: string[]        // IDs of sections used to derive this
  authorOverrides?: string        // Manual author notes on voice
  updatedAt: Timestamp
}
```

Add `styleProfile: StyleProfile` to the `Manuscript` interface.

### 3.2 Outline → Sections Breakdown

When a manuscript is created from an outline, each chapter gets auto-split into sections:

**New agent: `section-planner-agent.ts`**

```typescript
generateSectionPlan(params: {
  bookTitle: string
  chapterTitle: string
  chapterSummary: string
  keyTopics: string[]
  totalChapters: number
  chapterNumber: number
  targetWordCount: number         // per chapter (default 3000-5000)
}): Promise<{
  sections: {
    sectionNumber: number
    title: string
    outlineContext: string         // 2-3 sentences describing what to cover
    estimatedWords: number
  }[]
}>
```

- Model: Claude Sonnet 4.6
- Generates 3-5 sections per chapter
- Each section has a clear scope and estimated word count
- Sections are ordered to build logically within the chapter

**API route: `POST /api/plan-sections`**

### 3.3 Section Generation Agent

**Updated agent: `writer-agent.ts` → `section-writer-agent.ts`**

Generates one section at a time (not a full chapter).

```typescript
generateSectionDraft(params: {
  // Book context
  bookTitle: string
  fullOutline: OutlineSnapshot       // All chapter titles + summaries
  styleProfile?: StyleProfile        // Voice/tone to maintain

  // Chapter context
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  totalSectionsInChapter: number

  // Section context
  sectionNumber: number
  sectionTitle: string
  sectionOutlineContext: string       // What this section should cover

  // Accumulated context (THE KEY DIFFERENTIATOR)
  previousSectionsInChapter: {       // All approved sections in this chapter so far
    title: string
    summary: string                  // 2-3 sentence summary
    lastParagraph: string            // Last paragraph for seamless transitions
  }[]
  previousChapterSummaries: {        // All completed chapters
    chapterNumber: number
    title: string
    summary: string                  // 3-5 sentence summary
    keyPointsCovered: string[]
  }[]

  // Author input
  authorNotes?: string               // Author's specific direction for this section
  revisionFeedback?: string          // If this is a rewrite, what to change
}): Promise<{
  content: string                    // HTML
  wordCount: number
  transitionSentence: string         // Opening that connects to previous section
}>
```

**Context strategy** (to stay within token limits):
- Full outline: always included (compact form)
- Style profile: always included
- Previous sections in current chapter: full summary + last paragraph (for transitions)
- Previous chapters: 3-5 sentence summary each
- Current section: full outline context + author notes
- Total context window budget: ~4000 tokens for context, rest for generation

**System prompt emphasis**:
- Match the style profile exactly
- Open with a transition from the previous section (or chapter intro if first section)
- Cover everything specified in the section outline context
- Be substantive and data-rich — no filler, no jargon padding
- Target the estimated word count for this section
- End with a natural lead-in to the next section (unless last section)

### 3.4 API Routes

```
POST /api/plan-sections
  Body: { projectId, manuscriptId, chapterId, chapterTitle, chapterSummary, keyTopics }
  Returns: { sections: Section[] }

POST /api/write-section
  Body: { projectId, manuscriptId, chapterId, sectionId, ...generationContext }
  Returns: { content, wordCount }

POST /api/revise-section
  Body: { projectId, manuscriptId, chapterId, sectionId, feedback, currentContent }
  Returns: { content, wordCount }

POST /api/extract-style
  Body: { projectId, manuscriptId, approvedSectionIds[] }
  Returns: { styleProfile: StyleProfile }
```

---

## Phase 4 — Co-Authoring Workflow UI

### 4.1 The Writing Flow

This is the core user experience. The author works through the book linearly (but can jump around):

```
[Select Chapter] → [View Section Plan] → [Generate/Write Section 1]
    → [Review & Edit] → [Approve or Request Revision] → [Section 2] → ...
    → [All Sections Approved] → [Chapter Complete] → [Next Chapter]
```

**States per section**:

| Status | What the author sees |
|--------|---------------------|
| `not_started` | "Generate Draft" button + optional author notes input |
| `generating` | Loading overlay with progress indicator |
| `review` | Full editor with content + "Approve" / "Request Revision" / "Edit Manually" buttons |
| `revision` | Author writes feedback → AI regenerates → back to `review` |
| `approved` | Green checkmark, content locked (click to unlock for further edits) |

### 4.2 Layout Update

**Three-panel layout** (replaces current two-panel):

```
+------------------+---------------------------+-------------------+
|  Chapter List    |   Section Editor          |  Context Panel    |
|  (240px)         |   (flex-1)                |  (280px)          |
|                  |                           |                   |
|  Ch 1 [====]     |  [Section Title]          |  Outline Context  |
|  Ch 2 [==  ]     |  [Tiptap Editor]          |  ─────────────    |
|  Ch 3 [    ]     |                           |  "This section    |
|  ...             |  [Approve] [Revise]       |   should cover    |
|                  |  [Edit]   [Next →]        |   the history..." |
|                  |                           |                   |
|  ───────         |  Section 1 ✅ | 2 📝 | 3 |  Author Notes     |
|  Word Count      |                           |  [textarea]       |
|  Progress        |                           |                   |
|                  |                           |  Style Profile    |
|                  |                           |  "Tone: casual..."│
+------------------+---------------------------+-------------------+
```

**Left panel — Chapter & Section Navigator**:
- Chapter list with progress bars (sections completed / total)
- Click chapter → expands to show sections
- Each section shows status icon + title + word count
- Active section highlighted

**Center panel — Section Editor**:
- Section title bar with chapter context
- Tiptap editor (existing, enhanced)
- Action bar below editor:
  - **"Approve & Next"** — marks section approved, auto-advances to next section
  - **"Request Revision"** — opens feedback textarea, regenerates with feedback
  - **"Edit Manually"** — unlocks editor for direct typing
  - **"Regenerate"** — full regeneration with same context
- Section navigation tabs at bottom (Section 1 | 2 | 3 | 4)

**Right panel — Context Panel** (collapsible on mobile):
- **Outline Context**: What this section should cover (from section plan)
- **Author Notes**: Textarea for author to add direction before/during generation
- **Style Profile**: Current voice/tone settings (editable)
- **Revision History**: Previous versions of this section (expandable)
- **Chapter Progress**: Mini progress indicator

### 4.3 Section Approval Flow

1. AI generates section → status = `review`
2. Author reads in editor. Three choices:
   - **Approve**: Section content is locked. Summary is generated and added to context for next section. Status = `approved`.
   - **Request Revision**: Author types feedback (e.g., "Make it more conversational", "Add more data about market size", "The opening doesn't connect well to the previous section"). AI regenerates with this feedback + original context. Previous version saved to `revisionHistory`. Back to `review`.
   - **Edit Manually**: Author edits directly in Tiptap. Can then approve or request AI revision on their edited version.
3. After approval, context is updated:
   - Section summary generated (2-3 sentences) via a lightweight summarization call
   - Last paragraph captured for transition context
   - Manuscript word count updated
4. System auto-advances to next section (or next chapter if last section)

### 4.4 Revision System

The revision system is the core of co-authoring:

```typescript
// Author provides feedback
interface RevisionRequest {
  sectionId: string
  feedback: string                 // Natural language: "Make it more data-driven"
  keepParts?: string               // "Keep the opening anecdote but rewrite the rest"
  currentContent: string           // The content being revised (may have manual edits)
}
```

The revision agent receives:
- Original section outline context
- Current content (which may include author's manual edits)
- Author's feedback
- Style profile
- Previous sections context (same as initial generation)

It generates a new version that addresses the feedback while preserving what works. The old version is saved in `revisionHistory` so the author can revert.

**No limit on revisions** — the author can revise as many times as needed.

### 4.5 Style Profile Extraction

After the first 2-3 sections are approved, the system extracts a style profile:

**Agent: `style-extractor-agent.ts`**

```typescript
extractStyleProfile(params: {
  approvedSections: { title: string; content: string }[]
  authorPreferences?: string       // Optional author input on desired style
}): Promise<StyleProfile>
```

- Analyzes the approved content for tone, vocabulary, sentence structure, narrative approach
- Returns a structured `StyleProfile` that gets attached to the manuscript
- Re-extracted periodically (every 5 approved sections) to stay current with evolving style
- Author can manually override any field

This profile is included in every subsequent generation call, ensuring voice consistency across the entire book.

---

## Phase 5 — "Write Entire Book" Automation

### 5.1 Batch Generation Mode

For authors who want faster first drafts, offer a "Write All" mode:

1. Author clicks **"Auto-Draft Remaining"** on any chapter or the full manuscript
2. System queues all unstarted sections in order
3. Each section generates sequentially (not parallel — context must accumulate)
4. After each section generates, it goes to `review` status
5. Author can review/approve/revise at their own pace while generation continues
6. If author hasn't approved section N, generation pauses at section N+2 (max 2 sections ahead)

**This prevents runaway generation** — the author stays close to the frontier, ensuring context stays accurate.

### 5.2 Chapter Assembly

When all sections in a chapter are approved:

1. Sections are concatenated in order into the chapter's `content` field
2. A transition-smoothing pass runs (optional): lightweight AI call that checks transitions between sections and suggests minor edits
3. Chapter status → `complete`
4. Chapter summary generated for use in subsequent chapter context
5. Manuscript progress updated

### 5.3 Manuscript Completion

When all chapters are complete:

1. Manuscript status → `complete`
2. Front matter generation offered (dedication, acknowledgments, foreword)
3. Export options enabled (see Phase 7)

---

## Phase 6 — Agent Architecture

### 6.1 Agent Roster

| Agent | Model | Purpose | Input Context |
|-------|-------|---------|---------------|
| `section-planner-agent` | Claude Sonnet 4.6 | Break chapter into sections | Chapter outline + full book outline |
| `section-writer-agent` | Claude Sonnet 4.6 | Generate section draft | Full accumulated context (see 3.3) |
| `revision-agent` | Claude Sonnet 4.6 | Revise section with feedback | Current content + feedback + context |
| `style-extractor-agent` | Claude Sonnet 4.6 | Extract voice/style profile | 2-3 approved sections |
| `section-summarizer-agent` | Claude Haiku | Summarize approved section | Section content (lightweight) |
| `transition-smoother-agent` | Claude Haiku | Polish section transitions | Adjacent section endings/openings |

### 6.2 Context Window Management

The key challenge is fitting enough context into each generation call. Budget per call (~100K tokens for Sonnet):

| Context Component | Token Budget | Strategy |
|---|---|---|
| System prompt + style profile | ~1,500 | Static per call |
| Full book outline | ~2,000 | All chapter titles + summaries |
| Previous chapter summaries | ~3,000 | 3-5 sentences per completed chapter |
| Previous sections (this chapter) | ~4,000 | Summary + last paragraph per section |
| Current section context | ~1,000 | Outline context + author notes + revision feedback |
| **Generation space** | ~88,500 | Remaining for output (~5000 words max) |

For a 20-chapter book at chapter 15, previous chapter summaries use ~2,100 tokens (14 chapters x 150 tokens each). Well within budget.

### 6.3 Consistency Mechanisms

1. **Style profile** in every call → consistent voice
2. **Previous section last paragraph** → seamless transitions
3. **Chapter summaries** → no contradictions or repeated content
4. **Section outline context** → stays on-topic per the plan
5. **Revision feedback loop** → author catches drift early

---

## Phase 7 — Export & Polish

### 7.1 Export Formats

- **Markdown** — concatenate all approved section content, strip HTML to Markdown
- **DOCX** — use `docx` npm package to generate formatted Word document with proper headings, page breaks between chapters
- **PDF** — generate via server-side rendering (puppeteer or react-pdf)
- **EPUB** — use `epub-gen` for e-reader format

### 7.2 Export API

```
POST /api/export-manuscript
  Body: { projectId, manuscriptId, format: 'md' | 'docx' | 'pdf' | 'epub' }
  Returns: binary file download
```

### 7.3 Table of Contents

Auto-generated from chapter titles + section titles. Included in all export formats.

---

## Phase 8 — Advanced Co-Authoring Features (Future)

- **Inline AI commands**: Select text → "Expand this", "Rewrite in simpler terms", "Add data/examples", "Make this more concise"
- **Research integration**: Link to Book Research tab — pull in market data, competitor analysis, trending topics
- **Collaboration**: Multiple authors on one manuscript (Firestore real-time listeners)
- **Version branches**: Fork a section to try different approaches, compare side-by-side
- **AI continuity check**: After all sections approved, run a full-manuscript consistency check that flags contradictions, repeated content, or tone shifts

---

## Files to Create (Phases 3-7)

| File | Purpose |
|------|---------|
| `app/lib/agents/section-planner-agent.ts` | Break chapters into sections |
| `app/lib/agents/section-writer-agent.ts` | Generate individual section drafts |
| `app/lib/agents/revision-agent.ts` | Revise sections with author feedback |
| `app/lib/agents/style-extractor-agent.ts` | Extract voice/style profile |
| `app/lib/agents/section-summarizer-agent.ts` | Lightweight section summaries |
| `app/api/plan-sections/route.ts` | Section planning endpoint |
| `app/api/write-section/route.ts` | Section generation endpoint |
| `app/api/revise-section/route.ts` | Section revision endpoint |
| `app/api/extract-style/route.ts` | Style extraction endpoint |
| `app/api/export-manuscript/route.ts` | Manuscript export endpoint |
| `components/book-writer/SectionEditor.tsx` | Section-level Tiptap editor with approve/revise |
| `components/book-writer/SectionNavigator.tsx` | Section tabs within a chapter |
| `components/book-writer/ContextPanel.tsx` | Right panel: outline, notes, style, history |
| `components/book-writer/RevisionDialog.tsx` | Feedback input for revision requests |
| `components/book-writer/StyleProfileEditor.tsx` | View/edit style profile |

## Files to Modify

| File | Change |
|------|--------|
| `components/sections/BookWriter.tsx` | Three-panel layout, section-level flow, batch mode |
| `components/book-writer/ChapterSidebar.tsx` | Add section expansion, section-level progress |
| `components/book-writer/ChapterEditor.tsx` | Delegate to SectionEditor, add approve/revise actions |
| `app/types/firebase.ts` | Add Section, StyleProfile, RevisionHistory types |
| `app/lib/firebase/services.ts` | Add section CRUD, style profile CRUD, section summaries |
| `firestore.rules` | Add sections subcollection rules under chapters |
| `app/lib/billing/tiers.ts` | Add `sections` usage type |
| `app/lib/billing/usage.ts` | Add `'sections'` to type union |

---

## Implementation Priority

| Priority | Phase | What | Why |
|----------|-------|------|-----|
| P0 | 3 | Section data model + planner agent | Foundation for everything |
| P0 | 4.1-4.3 | Section editor + approve/revise workflow | Core co-authoring experience |
| P0 | 4.4 | Revision system | Unlimited changes = key differentiator |
| P1 | 4.5 | Style profile extraction | Voice consistency across book |
| P1 | 6 | Full agent architecture | Quality + context management |
| P1 | 5 | Batch generation + chapter assembly | Productivity feature |
| P2 | 7 | Export (DOCX, PDF, EPUB, MD) | Users need to get their book out |
| P3 | 8 | Inline AI, research integration, collab | Power user features |

---

## Verification Checklist

1. Create manuscript from outline → verify sections auto-planned for each chapter
2. Generate Section 1 of Chapter 1 → verify content appears in editor
3. Request revision with feedback → verify new version addresses feedback, old version in history
4. Approve section → verify status updates, context accumulates
5. Generate Section 2 → verify it transitions smoothly from Section 1
6. Approve first 3 sections → verify style profile extracted
7. Generate Section 4 → verify it matches the style profile
8. Complete all sections in a chapter → verify chapter assembled and marked complete
9. Move to Chapter 2 → verify Chapter 1 summary is in context
10. Export manuscript as DOCX → verify formatting, headings, page breaks
11. Test "Auto-Draft Remaining" → verify sequential generation with pause at +2 ahead
12. Edit approved section → verify re-approval required, downstream context not corrupted

---

## Previous Implementation (Phases 1-2) — Reference

<details>
<summary>Phase 1-2 implementation details (completed)</summary>

### Phase 1 — Foundation (Complete)

- **Step 1**: Installed Tiptap dependencies (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/pm`) ✅
- **Step 2**: Added `Manuscript` and `ChapterDocument` types to `app/types/firebase.ts` ✅
- **Step 3**: Added Firebase CRUD (`createManuscript`, `getProjectManuscripts`, `getAllChapters`, `saveChapter`, `updateManuscriptProgress`) to `services.ts` ✅
- **Step 4**: Created `ChapterEditor.tsx` — Tiptap editor with toolbar, debounced autosave, `immediatelyRender: false` for SSR compat ✅
- **Step 5**: Created `ChapterSidebar.tsx` — chapter list with status badges, progress bar ✅
- **Step 6**: Created `BookWriter.tsx` — two-panel layout, project/outline selection, manuscript creation flow ✅
- **Step 7**: Registered BookWriter in `app/page.tsx` as 6th nav tab ✅

### Phase 2 — AI Chapter Generation (Complete)

- **Step 8**: Created `writer-agent.ts` — GPT-4o chapter generation (to be switched to Claude Sonnet 4.6) ✅
- **Step 9**: Created `/api/write-chapter/route.ts` — POST endpoint for chapter generation ✅
- **Step 10**: Wired "AI Write Draft" button with loading overlay ✅
- **Step 11**: Added `chapters` usage type to billing tiers ✅

### Known Issues from Phases 1-2

- `/api/write-chapter` does not call `checkAndIncrementUsage()` — no billing guard
- `updateManuscriptProgress()` always sets `status: 'in_progress'` — no completion logic
- Writer agent declares `response_format: { type: 'json_object' }` but prompts for HTML output (mismatch)
- Previous chapter context limited to 500-char truncation

</details>
