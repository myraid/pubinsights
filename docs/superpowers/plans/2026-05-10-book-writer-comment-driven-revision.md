# Book Writer: Comment-Driven Revision & Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-section regeneration with surgical, comment-driven revision using Haiku, and add a validation step for manual edits.

**Architecture:** Remove the standalone "Regenerate" button. Merge "Apply AI Revisions" and "Regenerate" into a single "Revise with AI" action that only activates when pending comments exist. Switch the revision agent from Sonnet to Haiku. Send only the commented passages + surrounding context (not the full section) to minimize tokens. Add a lightweight validation agent (Haiku) that checks section flow/coherence after manual edits before allowing approval.

**Tech Stack:** Anthropic Claude Haiku 4.5, Tiptap, Next.js API routes, Firestore

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/agents/revision-agent.ts` | Modify | Switch to Haiku, targeted passage revision |
| `app/lib/agents/validation-agent.ts` | Create | Lightweight flow/coherence checker (Haiku) |
| `app/api/validate-section/route.ts` | Create | API endpoint for section validation |
| `app/api/revise-section/route.ts` | Modify | Remove full-section rewrite, pass targeted context |
| `components/book-writer/SectionBlock.tsx` | Modify | Remove Regenerate button, add Validate button, gate revision on comments |
| `components/sections/BookWriter.tsx` | Modify | Add handleValidateSection, remove handleRegenerate |

---

### Task 1: Create Validation Agent

**Files:**
- Create: `app/lib/agents/validation-agent.ts`

This agent checks if a section's content flows well after manual editing. Uses Haiku for minimal cost.

- [ ] **Step 1: Create the validation agent**

```typescript
// app/lib/agents/validation-agent.ts
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit app/lib/agents/validation-agent.ts 2>&1 || echo "Check imports manually"`

---

### Task 2: Create Validation API Endpoint

**Files:**
- Create: `app/api/validate-section/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// app/api/validate-section/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/app/lib/firebase/admin'
import { validateSection } from '@/app/lib/agents/validation-agent'

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, manuscriptId, chapterId, sectionId } = await request.json()

    if (!userId || !projectId || !manuscriptId || !chapterId || !sectionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, projectId, manuscriptId, chapterId, sectionId' },
        { status: 400 }
      )
    }

    // Verify ownership
    const projectDoc = await adminDb.doc(`projects/${projectId}`).get()
    if (!projectDoc.exists || projectDoc.data()!.userId !== userId) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    const basePath = `projects/${projectId}/manuscripts/${manuscriptId}`
    const sectionPath = `${basePath}/chapters/${chapterId}/sections/${sectionId}`

    // Read section
    const secDoc = await adminDb.doc(sectionPath).get()
    if (!secDoc.exists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }
    const sec = secDoc.data()!

    if (!sec.content || sec.content.trim().length === 0) {
      return NextResponse.json({ error: 'Section has no content to validate' }, { status: 400 })
    }

    // Get previous section summary for transition context
    let previousSectionSummary: string | undefined
    if (sec.sectionNumber > 1) {
      const prevSecSnap = await adminDb
        .collection(`${basePath}/chapters/${chapterId}/sections`)
        .where('sectionNumber', '==', sec.sectionNumber - 1)
        .limit(1)
        .get()
      if (!prevSecSnap.empty) {
        const prevSec = prevSecSnap.docs[0].data()
        previousSectionSummary = prevSec.approvedSummary || undefined
      }
    }

    const result = await validateSection(sec.title, sec.content, previousSectionSummary)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[validate-section] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate section' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|failed" | head -5`

---

### Task 3: Switch Revision Agent to Haiku with Targeted Context

**Files:**
- Modify: `app/lib/agents/revision-agent.ts`

The current agent sends the ENTIRE section content to Sonnet. Change it to:
1. Use Haiku instead of Sonnet
2. For each comment, extract only the commented passage + ~200 words of surrounding context
3. Send each passage independently, splice results back into the original

- [ ] **Step 1: Rewrite revision-agent.ts**

Replace the entire file with:

```typescript
// app/lib/agents/revision-agent.ts
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
  const commentPassages = comments
    .map(c => {
      const passage = extractPassageWithContext(content, c.selectedText)
      return passage ? { comment: c, passage } : null
    })
    .filter((cp): cp is NonNullable<typeof cp> => cp !== null)
    .sort((a, b) => b.passage.startIdx - a.passage.startIdx)

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
  const skippedComments = comments.filter(c => !content.includes(c.selectedText) && !commentPassages.some(cp => cp.comment === c))
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|failed" | head -5`

---

### Task 4: Remove Regenerate Button, Add Validate Button in SectionBlock

**Files:**
- Modify: `components/book-writer/SectionBlock.tsx`

Changes:
1. Remove the `onRegenerate` prop and the "Regenerate" button entirely
2. Add `onValidate` prop and "Validate" button (shown when section has content in review status)
3. Rename "Apply AI Revisions" to "Revise with AI" for clarity
4. Validation result display inline

- [ ] **Step 1: Update the SectionBlockProps interface**

In `components/book-writer/SectionBlock.tsx`, change the interface:

```typescript
// REMOVE this line:
onRegenerate: (sectionId: string) => void

// ADD this line:
onValidate: (sectionId: string) => void
validating: boolean
validationResult: { valid: boolean; issues: Array<{ location: string; message: string }>; suggestions: string[] } | null
```

- [ ] **Step 2: Update the destructuring**

```typescript
// REMOVE: onRegenerate
// ADD: onValidate, validating, validationResult
```

- [ ] **Step 3: Remove the Regenerate button**

Find and delete the entire Regenerate button block in the review status action bar:

```tsx
// DELETE this entire block:
<Button
  onClick={() => onRegenerate(section.id)}
  variant="outline"
  size="sm"
  className="border-purple-200 hover:bg-purple-50 text-purple-600 text-xs"
>
  Regenerate
</Button>
```

- [ ] **Step 4: Rename "Apply AI Revisions" to "Revise with AI"**

Change the button text from `Apply AI Revisions` to `Revise with AI`.

- [ ] **Step 5: Add Validate button in the action bar**

Add the Validate button next to the Approve button:

```tsx
<Button
  onClick={() => onValidate(section.id)}
  disabled={validating}
  variant="outline"
  size="sm"
  className="border-purple-200 hover:bg-purple-50 text-purple-600 text-xs"
>
  {validating ? (
    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Validating...</>
  ) : (
    <><Check className="h-3 w-3 mr-1" /> Validate</>
  )}
</Button>
```

- [ ] **Step 6: Add validation result display**

Above the action bar, when `validationResult` is not null, show the results:

```tsx
{validationResult && (
  <div className={`mx-4 mb-2 rounded-lg p-3 text-xs ${validationResult.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
    <div className="flex items-center gap-1.5 font-semibold mb-1">
      {validationResult.valid ? (
        <><Check className="h-3.5 w-3.5 text-emerald-600" /> Flow looks good</>
      ) : (
        <><MessageSquare className="h-3.5 w-3.5 text-amber-600" /> {validationResult.issues.length} issue{validationResult.issues.length !== 1 ? 's' : ''} found</>
      )}
    </div>
    {validationResult.issues.map((issue, i) => (
      <div key={i} className="mt-1.5 pl-5">
        <p className="text-gray-500 italic">&ldquo;{issue.location}&rdquo;</p>
        <p className="text-gray-700 mt-0.5">{issue.message}</p>
      </div>
    ))}
    {validationResult.suggestions.length > 0 && (
      <div className="mt-2 pl-5 text-gray-600">
        {validationResult.suggestions.map((s, i) => (
          <p key={i} className="mt-0.5">{s}</p>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|failed" | head -5`

---

### Task 5: Update BookWriter to Wire Validation and Remove Regeneration

**Files:**
- Modify: `components/sections/BookWriter.tsx`

- [ ] **Step 1: Add validation state**

Add these state variables:

```typescript
const [validatingSectionId, setValidatingSectionId] = useState<string | null>(null)
const [validationResults, setValidationResults] = useState<Record<string, { valid: boolean; issues: Array<{ location: string; message: string }>; suggestions: string[] }>>({})
```

- [ ] **Step 2: Add handleValidateSection**

```typescript
const handleValidateSection = async (sectionId: string) => {
  if (!activeManuscript || !activeChapterId || !user) return
  setValidatingSectionId(sectionId)
  // Clear previous result for this section
  setValidationResults(prev => {
    const next = { ...prev }
    delete next[sectionId]
    return next
  })
  try {
    const response = await fetch('/api/validate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        projectId: selectedProject!.id,
        manuscriptId: activeManuscript.id,
        chapterId: activeChapterId,
        sectionId,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Validation failed')
    setValidationResults(prev => ({ ...prev, [sectionId]: data }))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Validation failed')
  } finally {
    setValidatingSectionId(null)
  }
}
```

- [ ] **Step 3: Remove handleRegenerate**

Delete the `handleRegenerate` function entirely. It should look like this currently:

```typescript
const handleRegenerate = async (sectionId: string) => {
  // ... calls /api/write-section with regenerate: true
}
```

Delete the entire function.

- [ ] **Step 4: Clear validation results when section content changes**

In `handleSaveSectionContent`, clear validation for that section:

```typescript
const handleSaveSectionContent = async (sectionId: string, html: string, wordCount: number) => {
  // Add at the top of the function:
  setValidationResults(prev => {
    const next = { ...prev }
    delete next[sectionId]
    return next
  })
  // ... rest of existing code
}
```

- [ ] **Step 5: Update UnifiedChapterView props**

In the JSX where `UnifiedChapterView` is rendered, remove `onRegenerate` and add validation props. The section block rendering inside UnifiedChapterView needs updating.

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|failed" | head -5`

---

### Task 6: Update UnifiedChapterView Props

**Files:**
- Modify: `components/book-writer/UnifiedChapterView.tsx`

- [ ] **Step 1: Update the interface**

Remove `onRegenerate` from the props interface. Add:

```typescript
onValidate: (sectionId: string) => void
validatingSectionId: string | null
validationResults: Record<string, { valid: boolean; issues: Array<{ location: string; message: string }>; suggestions: string[] }>
```

- [ ] **Step 2: Pass new props to SectionBlock**

In the SectionBlock rendering, remove `onRegenerate` and add:

```tsx
onValidate={onValidate}
validating={validatingSectionId === sec.id}
validationResult={validationResults[sec.id] || null}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|failed" | head -5`

---

### Task 7: Final Verification

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build with no errors.

- [ ] **Step 2: Verify Regenerate button is gone**

Search codebase: `grep -r "Regenerate" components/book-writer/ components/sections/BookWriter.tsx`
Expected: No results (the button and handler are removed).

- [ ] **Step 3: Verify Haiku is used for revisions**

Search: `grep -r "HAIKU_MODEL\|SONNET_MODEL" app/lib/agents/revision-agent.ts app/lib/agents/validation-agent.ts`
Expected: Both files use `HAIKU_MODEL` only.

- [ ] **Step 4: Commit**

```bash
git add app/lib/agents/revision-agent.ts app/lib/agents/validation-agent.ts app/api/validate-section/route.ts components/book-writer/SectionBlock.tsx components/book-writer/UnifiedChapterView.tsx components/sections/BookWriter.tsx
git commit -m "feat: comment-driven revision with Haiku, add validation, remove regenerate

- Switch revision agent from Sonnet to Haiku for cost efficiency
- Targeted passage revision: only send commented text + context, not full section
- Remove standalone Regenerate button (revision requires comments)
- Add Validate button to check section flow after manual edits
- Create validation agent using Haiku for structural coherence checks"
```

---

## Summary of Behavioral Changes

| Before | After |
|--------|-------|
| "Regenerate" rewrites entire section from scratch using Sonnet | Removed entirely |
| "Apply AI Revisions" sends full section to Sonnet | "Revise with AI" sends only commented passages + 200-word context to Haiku |
| No validation step for manual edits | "Validate" button checks flow/coherence using Haiku |
| Revision cost: ~8K tokens per revision (full section) | Revision cost: ~500-1K tokens per comment (passage only) |
| Uncommented text could be changed by AI | Uncommented text never touched — surgical splice |
