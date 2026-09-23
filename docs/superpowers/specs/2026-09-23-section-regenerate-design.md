# Regenerate a section

**Status:** approved, not yet implemented
**Date:** 2026-09-23

## Problem

A section reached `review` with zero words and no way out. The footer offered
only *Revise with AI* — disabled, because it requires pending comments — and
*Approve*. The only available action was to approve an empty section.

Two independent defects produced that state.

**No regenerate affordance.** `SectionBlock.tsx` exposes generation only under
`status === "not_started"`. Once a section is in `review`, the footer renders
*Revise with AI* / *Approve* and nothing else. There is no path back to
generation, whether the draft is empty or merely bad.

**An empty draft is persisted as a finished one.** `/api/write-section` writes
`status: 'review'` on any successful `generateSectionDraft` call, without
checking that the content is non-empty. Its `genError` path is careful — it
resets to `sec.content ? 'review' : 'not_started'` — but an empty-yet-successful
generation is not an error, so it strands the section.

## What already exists

Worth stating plainly, because it shrinks the work:

- `/api/write-section` **already accepts a `regenerate` flag**. It bypasses the
  `status === 'review'` guard and increments `revisionCount`. The UI has simply
  never sent it.
- `handleGenerateDraft(sectionId, authorNotes?)` **already forwards author
  notes**, which the route injects into `ctx.currentSection.authorNotes`.
- An **Author notes** textarea already exists, placeholder *"Direction for AI
  generation or revision…"* — but it is hidden behind the collapsed **Details**
  drawer, so a user has to know to go looking for it.

This is wiring, not new capability.

## Design

### 1. Inline regenerate panel — `SectionBlock.tsx`

A *Regenerate* button joins the review footer beside *Revise with AI* and
*Approve*. Clicking it expands an inline panel in the footer:

```
What should the AI focus on? (optional)
┌──────────────────────────────────────┐
│                                      │
└──────────────────────────────────────┘
Replaces the current draft.          ← only when the section has content
[ Regenerate ]  [ Cancel ]
```

The panel opens for **both** empty and non-empty sections. Direction is most
valuable precisely when the first attempt produced nothing — a thin brief is a
plausible reason it came back empty.

The panel is the confirmation *and* the instruction input: one mechanism, not a
toast plus a separate notes field. Its shape mirrors the existing `not_started`
card, which already pairs a textarea with a *Generate AI Draft* button.

The "Replaces the current draft." line appears only when the section has
content, so a 0-word section carries no false warning.

**The textarea edits the same `authorNotes` value as the Details drawer**,
prefilled from it. A second, parallel notes concept would mean direction typed
in the drawer is silently ignored by regenerate.

Editing the panel's textarea goes through the existing `handleNotesChange`, the
same debounced path the drawer uses, so the two views never disagree and the
value persists whether or not the user goes on to confirm.

Confirming calls the existing `onGenerateDraft(section.id, notes || undefined)`.
No new prop is threaded through `UnifiedChapterView`.

### 2. Send the flag — `BookWriter.tsx`

`handleGenerateDraft` derives `regenerate` rather than taking it as an argument:

```ts
const regenerate = sections.find(s => s.id === sectionId)?.status === 'review'
```

This is the server's own rule (`route.ts:56`) expressed once on the client, so
the two cannot drift, and the prop signature is untouched.

### 3. Refuse to persist an empty draft — `app/api/write-section/route.ts`

After `generateSectionDraft`, treat blank content as a failure: do not write it,
reset status the way the existing `genError` path does — `sec.content ? 'review'
: 'not_started'` — and return an error. The client already surfaces errors as a
toast.

Blank means no text after stripping tags and trimming, not merely
`wordCount === 0`, so markup-only output is caught too.

### 4. Mirror the server on client-side failure — `BookWriter.tsx`

The `catch` block currently reverts to `not_started` unconditionally. That is
correct today only because generation can run solely from `not_started`. Once
regenerate exists, a failed regenerate on a section that *has* content would
wrongly blank its status while Firestore still says `review`.

It must match the server: revert to `review` when content survives, else
`not_started`.

## Non-goals

- Regenerating an **approved** section. The route already returns 409 for it,
  and reopening approved work would invalidate sections unlocked behind it.
- Any per-section revision history or diff of the replaced draft.
- Investigating *why* this particular generation returned empty. Item 3 makes
  the symptom impossible to persist regardless of cause.

## Verification

No test runner is configured in this repo, so verification is:

1. `npm run verify` (lint + typecheck) and `npm run build`.
2. Driving the real app against the demo account:
   - the *Regenerate* button appears on a section in review;
   - the panel opens for both empty and non-empty sections, and the
     "Replaces the current draft." line appears only for the latter;
   - *Cancel* leaves the draft untouched;
   - confirming replaces the draft, and typed direction visibly influences it;
   - the notes shown match what the Details drawer holds.
3. An empty generation cannot be induced on demand through the UI. Item 3 is
   verified by temporarily forcing `generateSectionDraft` to return empty
   content in a local run, confirming the section stays out of `review` and the
   error surfaces, then reverting the stub. Not by inspection alone.
