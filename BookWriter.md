# Book Writer Feature — Implementation Plan

## Context

After generating a book outline, users currently have no way to write the actual book. The outline is read-only and cannot be edited. This feature adds a full chapter-by-chapter book writing experience where AI generates drafts, users co-author/edit, and the outline serves as the structure guiding the process.

**Scope**: Core experience only (Phases 1-2). Outline editing, file upload, and inline AI suggestions are deferred to a follow-up session.

## Decisions

- **Placement**: New "Book Writer" nav tab (6th tab)
- **Editor**: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`) — headless, Tailwind-styled
- **AI generation**: Non-streaming — show loading state, display full chapter when complete
- **AI model**: `gpt-4o` for chapter drafts (quality matters for long-form writing)
- **Data model**: Firestore subcollections under projects

---

## Phase 1 — Foundation

### Step 1: Install dependencies
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/pm
```

### Step 2: Add types — `app/types/firebase.ts`
```typescript
interface Manuscript {
  id: string
  projectId: string
  userId: string
  title: string
  status: 'in_progress' | 'complete'
  totalChapters: number
  completedChapters: number
  totalWordCount: number
  outlineSnapshot: {
    Title: string
    Chapters: { Chapter: number; Title: string; Summary?: string; KeyTopics?: string[] }[]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface ChapterDocument {
  chapterNumber: number
  title: string
  status: 'not_started' | 'writing' | 'draft' | 'complete'
  content: string              // HTML string from Tiptap
  wordCount: number
  outlineContext: { summary: string; keyTopics: string[] }
  aiGenerated: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Step 3: Add Firebase CRUD — `app/lib/firebase/services.ts`
Functions to add:
- `createManuscript(projectId, userId, title, outlineSnapshot)` → creates manuscript doc + empty chapter docs
- `getProjectManuscripts(projectId)` → list manuscripts for a project
- `getManuscript(projectId, manuscriptId)` → single manuscript metadata
- `saveChapter(projectId, manuscriptId, chapterNumber, { content, wordCount, status })` → update chapter
- `getChapter(projectId, manuscriptId, chapterNumber)` → single chapter
- `getAllChapters(projectId, manuscriptId)` → all chapters for a manuscript
- `updateManuscriptProgress(projectId, manuscriptId, completedChapters, totalWordCount)` → update counts

### Step 4: Create editor component — `components/book-writer/ChapterEditor.tsx`
- Tiptap editor with minimal toolbar: H1, H2, Bold, Italic, Bullet List, Ordered List, Undo/Redo
- Styled with brand purple palette (#9900CC borders/focus, #F5EEFF backgrounds)
- Debounced autosave (10s of inactivity) — calls `saveChapter()`
- Word count display in footer
- Dynamic import with SSR disabled (follows existing Plotly pattern)
- Placeholder text: "Start writing or use AI to generate a draft..."

### Step 5: Create chapter sidebar — `components/book-writer/ChapterSidebar.tsx`
- Lists all chapters from the manuscript outline
- Each shows: chapter number, title, status badge (color-coded), word count
- Click to switch active chapter
- Status badges: Not Started (gray), Writing (purple), Draft (amber), Complete (green)
- Current chapter highlighted with purple left border

### Step 6: Create BookWriter section — `components/sections/BookWriter.tsx`
**Layout** (two-panel):
- **Left sidebar** (260px): Chapter list + manuscript selector
- **Center** (flex-1): Active chapter editor with title bar

**Flow**:
1. User selects a project that has an outline saved
2. If no manuscript exists → "Start Writing" button creates one from the outline
3. If manuscript exists → loads chapter list, user clicks a chapter to edit
4. Empty chapter shows two options: "AI Write Draft" or "Start Writing Manually"
5. Autosave fires on content changes (debounced)
6. User marks chapter "Complete" via status dropdown, moves to next

**State**:
- `selectedProjectId` — which project
- `manuscript` — current manuscript metadata
- `chapters` — all chapter docs (metadata only, content loaded on select)
- `activeChapter` — currently editing chapter number
- `chapterContent` — active chapter's content (loaded individually)
- `saving` / `generating` — loading states

### Step 7: Register in app — `app/page.tsx`
- Import BookWriter component
- Add to sections array: `{ name: "Book Writer", icon: BookOpenCheck, component: BookWriter }`
- Update grid from `sm:grid-cols-5` to `sm:grid-cols-6`

---

## Phase 2 — AI Chapter Generation

### Step 8: Create writer agent — `app/lib/agents/writer-agent.ts`
**`generateChapterDraft()`**:
- Model: `gpt-4o`
- Temperature: 0.8
- max_tokens: 8000 (~5000 words)
- Input: book title, full outline (all chapter titles + summaries), current chapter details, summaries of previously written chapters
- System prompt: instructs consistent voice, continuity with previous chapters, covers key topics from outline, targets 3000-5000 words
- Returns: HTML-formatted chapter text (paragraphs, headings, lists)
- Logs tokens + duration to `logs/openai/` (follows insights-agent pattern)

**Context strategy** (to stay within token limits):
- Send full outline (compact — titles + summaries only)
- For each previously completed chapter: send only a 2-sentence summary (not full text)
- Current chapter gets full outline details (summary + key topics)

### Step 9: Create API route — `app/api/write-chapter/route.ts`
- POST endpoint
- Accepts: `{ userId, projectId, manuscriptId, chapterNumber, outline, previousSummaries }`
- Calls `generateChapterDraft()` from writer agent
- Returns: `{ content: string, wordCount: number, _tokens: number, _duration_ms: number }`
- Usage check via `checkAndIncrementUsage(userId, 'chapters')`

### Step 10: Wire up "AI Write Draft" in the UI
- Button in ChapterEditor when chapter is empty/not_started
- On click: shows loading overlay with "Writing chapter... This may take 30-60 seconds"
- On complete: loads generated HTML into Tiptap editor, sets status to 'draft'
- Saves to Firestore immediately
- Toast: "Chapter draft generated — review and edit as needed"

### Step 11: Add usage tracking
- `app/lib/billing/tiers.ts`: Add `chapters` to TierLimits (Free: 3/month, Creator: 50/month)
- `app/lib/billing/usage.ts`: Add `'chapters'` to the type union

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/sections/BookWriter.tsx` | Main section component (~400 lines) |
| `components/book-writer/ChapterEditor.tsx` | Tiptap editor with toolbar + autosave |
| `components/book-writer/ChapterSidebar.tsx` | Chapter list with status badges |
| `app/lib/agents/writer-agent.ts` | AI agent for chapter generation |
| `app/api/write-chapter/route.ts` | API route for chapter generation |

## Files to Modify

| File | Change |
|------|--------|
| `app/page.tsx` | Add Book Writer to nav sections, update grid cols |
| `app/types/firebase.ts` | Add Manuscript + ChapterDocument interfaces |
| `app/lib/firebase/services.ts` | Add manuscript/chapter CRUD functions |
| `package.json` | Add Tiptap dependencies |
| `app/lib/billing/tiers.ts` | Add `chapters` usage type |
| `app/lib/billing/usage.ts` | Add `'chapters'` to type union |

## Key Patterns to Reuse

- `app/lib/agents/openai-client.ts` — shared OpenAI client (import `openai` from here)
- `app/lib/agents/insights-agent.ts` — pattern for logging, token tracking, variant support
- Dynamic import with SSR disabled: `dynamic(() => import(...), { ssr: false })`
- `AbortController` pattern from BookResearch for canceling in-flight requests
- Brand palette: `BRAND = { deep: "#8400B8", primary: "#9900CC", bg: "#F5EEFF", accent: "#AA00DD" }`

## Deferred to Follow-up

- Outline editing (view/edit toggle in BookOutline.tsx)
- File upload (.txt/.docx draft import)
- Inline AI suggestions (continue, rewrite, expand)
- Cross-section navigation (BookOutline → Book Writer)
- Export manuscript as .txt/.docx
- Mobile responsive layout polish

## Verification

1. Navigate to Book Writer tab → select a project with an outline → click "Start Writing"
2. Verify manuscript + empty chapter docs created in Firestore
3. Click a chapter → click "AI Write Draft" → wait for completion → verify text appears in editor
4. Edit text in Tiptap → wait 10s → verify autosave updates Firestore
5. Mark chapter as "Complete" → verify sidebar badge updates to green
6. Switch chapters → verify content loads correctly for each
7. Check server logs for token usage: `[writer-agent] tokens=XXXX duration=XXXXms`
