# Landing Page Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a click-to-play product demo on the landing page, recorded against the real app and showing the two features just added (right-click commenting, character-by-character AI writing).

**Architecture:** A Playwright script drives the real app end to end and records a raw `.webm`, emitting a `.timings.json` of stage offsets. An ffmpeg script cuts that one take at per-segment speeds — waiting rushed at 14×, payoffs held at 1× — into a single ~65s walkthrough in the hero. It plays only on click and preloads nothing, so a visitor who never presses play downloads only a poster image.

**Tech Stack:** Playwright (devDependency), ffmpeg 9 (local CLI, not a project dep), Next.js 15 App Router, Tiptap, Firebase Admin.

---

## Context

Everything below is already built, verified, and **uncommitted** on `main` (local `b1fa720`):

| File | State |
|---|---|
| `scripts/record-demo.mjs` | works — last take: 13 stages, 177s, zero failures |
| `scripts/edit-demo.sh` | works — per-segment `start:dur:speed` |
| `components/sections/LandingPage.tsx` | click-to-play hero + lazy lightbox (lightbox retired by Task 5) |
| `components/book-writer/SectionBlock.tsx` | right-click to comment |
| `app/lib/typewriter.ts` | character-by-character reveal |
| `public/demo/*` | 6 assets cut from the 2026-09-21T06-06-59 take |

**Why re-record:** the existing cut predates the right-click and typewriter features, so it does not show them. It also films three stale projects (`Meal Prep Masterclass`, `Meal Prep Playbook`, `Meal Prep Demo`) in the My Projects sidebar, which reads as clutter in a marketing asset.

**Decision already taken:** the hero gets the **64s full walkthrough**, not the 25s teaser — click-to-play means the viewer opted in, the 25s cut was built as a loop and ends abruptly when played once, and only the 64s contains the comment/review flow. The 25s cut is dropped.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `scripts/reset-demo.mjs` | Delete a named project and its subcollections from the demo account | **Create** |
| `scripts/record-demo.mjs` | Drive the app, record, emit stage timings | **Modify** — add right-click + typewriter beats |
| `components/sections/LandingPage.tsx` | Hero video | **Modify** — collapse to one video, remove the lightbox |
| `public/demo/*` | Shipped assets | **Replace** |
| `package.json` | Scripts | **Modify** — add `reset:demo` |

---

## Task 1: Demo data reset script

Firestore has no delete UI in `MyProjects`, so cleanup needs the Admin SDK. `app/lib/firebase/admin.ts` already parses `FIREBASE_PRIVATE_KEY` correctly and is lazy, so importing it costs nothing.

**Files:**
- Create: `scripts/reset-demo.mjs`
- Modify: `package.json`

> **STOP — human approval required before running this task's Step 4.**
> This deletes Firestore documents. Confirm with the user which project names may be
> deleted, and that the target is the demo account only. Do not run it otherwise.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Deletes demo projects from the demo account so a recording starts clean.
 *
 *   node --env-file-if-exists=.env.local scripts/reset-demo.mjs "Meal Prep Demo" "Meal Prep Playbook"
 *
 * Destructive and irreversible. Names must be passed explicitly — there is no
 * "delete everything" mode on purpose.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createPrivateKey } from 'node:crypto'

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('usage: reset-demo.mjs "<project name>" ["<project name>" ...]')
  process.exit(1)
}

function parsePrivateKey(raw) {
  if (!raw) return undefined
  const pem = raw.replace(/\\n/g, '\n')
  try {
    return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' })
  } catch {
    return pem
  }
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  }),
})
const db = getFirestore(app)

const email = process.env.DEMO_EMAIL
if (!email) { console.error('DEMO_EMAIL not set'); process.exit(1) }

const users = await db.collection('users').where('email', '==', email).get()
if (users.empty) { console.error(`No user document for ${email}`); process.exit(1) }
const uid = users.docs[0].id
console.log(`demo account: ${uid}`)

for (const name of names) {
  const snap = await db.collection('projects')
    .where('userId', '==', uid).where('name', '==', name).get()
  if (snap.empty) { console.log(`  "${name}" — not found, skipping`); continue }
  for (const doc of snap.docs) {
    // recursiveDelete removes manuscripts/chapters/sections beneath the project.
    await db.recursiveDelete(doc.ref)
    console.log(`  "${name}" — deleted (${doc.id})`)
  }
}
console.log('done')
process.exit(0)
```

- [ ] **Step 2: Add the npm script**

In `package.json`, inside `"scripts"`, after the `"record:demo"` line:

```json
    "reset:demo": "node --env-file-if-exists=.env.local scripts/reset-demo.mjs"
```

- [ ] **Step 3: Verify it refuses to run with no arguments**

Run: `npm run reset:demo`
Expected: `usage: reset-demo.mjs "<project name>" ...` and a non-zero exit. Nothing deleted.

- [ ] **Step 4: Delete the stale projects (AFTER human approval)**

Run:
```bash
npm run reset:demo -- "Meal Prep Demo" "Meal Prep Playbook" "Meal Prep Masterclass" "Meal Prep Blueprint"
```
Expected: `demo account: <uid>` then one `deleted` or `not found, skipping` line per name.

- [ ] **Step 5: Confirm the account is clean**

Sign in as the demo account at `http://localhost:3000`, open **My Projects**.
Expected: the sidebar lists no `Meal Prep *` projects.

- [ ] **Step 6: Commit**

```bash
git add scripts/reset-demo.mjs package.json
git commit -m "add demo account reset script"
```

---

## Task 2: Record the new features in the take

The recorder currently opens the comment popover from the toolbar button and never
pauses on the typewriter. Both new features need screen time.

**Files:**
- Modify: `scripts/record-demo.mjs`

- [ ] **Step 1: Hold on the typewriter as it writes**

In `scripts/record-demo.mjs`, replace this block:

```js
    // The drafted prose arriving in the editor is the payoff shot — hold on it.
    await page.getByText(/draft generated/i).waitFor({ timeout: 180_000 }).catch(() => {})
    await settle(page, 4000)
    mark('draft-done')
```

with:

```js
    // The typewriter reveal is itself the payoff — mark its start so the edit can hold
    // at 1x while text appears, rather than fast-forwarding through it.
    await visible(page.locator('[contenteditable="true"] p')).waitFor({ timeout: 180_000 })
    mark('draft-typing')
    await page.getByText(/draft generated/i).waitFor({ timeout: 180_000 }).catch(() => {})
    await settle(page, 5000)
    mark('draft-done')
```

- [ ] **Step 2: Use right-click to open the comment popover**

In the same file, replace:

```js
    await visible(page.getByRole('button', { name: /^comment$/i })).click()
    await settle(page, 800)
```

with:

```js
    // Right-click the selection — this is the new affordance we want on screen.
    await paragraph.click({ button: 'right' })
    await settle(page, 1200)
```

- [ ] **Step 3: Check the script still parses**

Run: `node --check scripts/record-demo.mjs`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/record-demo.mjs
git commit -m "record right-click commenting and the typewriter reveal"
```

---

## Task 3: Record a clean take

**Files:** none modified — this produces `recordings/*.webm`.

- [ ] **Step 1: Build and serve production**

Recording against `next dev` films the dev indicator and shares `.next` with any other
server, which corrupts both. Use a production build, started from a terminal **outside**
this session — background servers here get reaped under memory pressure.

```bash
rm -rf .next && npm run build
npm start
```
Expected: `✓ Compiled successfully`, then `✓ Ready in ~200ms`.

- [ ] **Step 2: Confirm the app renders**

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000`
Expected: `200`. (The landing page is client-rendered, so `curl` showing no hero text is
normal — do not treat that as a failure.)

- [ ] **Step 3: Record**

```bash
DEMO_BASE_URL=http://localhost:3000 DEMO_PROJECT="Meal Prep Playbook" npm run record:demo
```
Expected: stage marks printed in order, ending `revised`, then
`Wrote recordings/<stamp>.webm`. A clean take runs 170–200s. No `Take failed`.

- [ ] **Step 4: Confirm every stage was captured**

Run: `cat recordings/*.timings.json`
Expected: 14 stages — `landing, logged-in, project-created, research-done,
research-score, research-saved, outline-done, outline-saved, manuscript-ready,
sections-planned, draft-typing, draft-done, comment-added, revised`.

If `start new manuscript — already done, skipping` appears, the project already had a
manuscript: re-run Step 3 with a different `DEMO_PROJECT` name, or delete it via Task 1.

`createProject` in `app/lib/firebase/services.ts:33` throws `A project with this name
already exists` on a name collision, which surfaces as an error toast and leaves the
take without a project. So `DEMO_PROJECT` must name a project that does **not** exist —
Task 1 having deleted it counts.

---

## Task 4: Cut the walkthrough

**Files:** replaces `public/demo/hero-demo.*`; deletes the 25s/`demo-full` split.

- [ ] **Step 1: Read the stage offsets**

Run: `cat recordings/<stamp>.timings.json`
Write down the `at` value for each stage — the segment starts below are derived from
them and **must** be recomputed for the new take. Offsets from the previous take will cut
into the wrong moments.

- [ ] **Step 2: Cut**

Segment format is `start:duration:speed`. Start from the command below, which is tuned
for the 2026-09-21T06-06-59 take (`project-created` 10.5, `research-done` 78.4,
`research-score` 87.4, `outline-done` 111.3, `sections-planned` 130.4, `draft-done`
159.3, `revised` 176.9).

If the new take's offsets differ, shift each segment start by the difference at that
stage. Example: if `research-done` lands at 71.0 instead of 78.4, the research segment
start moves from `76` to `68.6` (−7.4), and every later start shifts by its own stage's
delta — the deltas accumulate, so do not apply one offset to all of them.

```bash
NAME=hero-demo \
SEGMENTS="1.5:5:1.5 5.5:6:1.5 13:9:2 22:54:14 76:13:1 89:22:7 108:6:1 114:16:6 129:3:1 132:26:4 157:4:1 159:10:1.4 169:8:1.2" \
./scripts/edit-demo.sh recordings/<stamp>.webm
```

Note `132:26:4` — the drafting segment runs at 4× rather than the previous 9×, so the
typewriter reads as writing rather than a blur.

Expected: a per-segment table, then `Duration: 60-70s` and three files listed.

- [ ] **Step 3: Check the typewriter and right-click actually landed on screen**

```bash
ffmpeg -v error -y -ss 44 -i public/demo/hero-demo.mp4 -frames:v 1 -q:v 3 /tmp/check-typing.jpg
ffmpeg -v error -y -ss 55 -i public/demo/hero-demo.mp4 -frames:v 1 -q:v 3 /tmp/check-comment.jpg
```
Open both. Expected: one frame showing a partially written paragraph; one showing the
"Comment for AI" popover. If either is missing, adjust that segment's start and re-run
Step 2 — re-cutting takes seconds and needs no re-recording.

- [ ] **Step 4: Confirm no stale projects are visible**

```bash
ffmpeg -v error -y -ss 6 -i public/demo/hero-demo.mp4 -frames:v 1 -q:v 3 /tmp/check-projects.jpg
```
Expected: the My Projects sidebar shows only the one project created in this take.

- [ ] **Step 5: Remove the retired 25s/full split**

```bash
rm -f public/demo/demo-full.mp4 public/demo/demo-full.webm public/demo/demo-full-poster.jpg
ls public/demo/
```
Expected: exactly `hero-demo.mp4`, `hero-demo.webm`, `hero-demo-poster.jpg`.

---

## Task 5: Collapse the landing page to one video

With one video there is no second thing to click, so the lightbox and its trigger go.

**Files:**
- Modify: `components/sections/LandingPage.tsx`

- [ ] **Step 1: Delete the lightbox trigger**

Remove this block (it sits directly after the hero video's closing `</div>`):

```tsx
        <button
          onClick={() => setShowFullDemo(true)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: BRAND.primary }}
        >
          <Play className="w-4 h-4" />
          Watch the full walkthrough (1 min)
        </button>
```

- [ ] **Step 2: Delete the lightbox itself**

Remove the whole `{showFullDemo && ( ... )}` block near the end of the component (it
begins with the comment `{/* Full walkthrough — mounted only when opened ... */}`).

- [ ] **Step 3: Delete the now-unused state and Escape handler**

Remove:

```tsx
  const [showFullDemo, setShowFullDemo] = useState(false)
```

and:

```tsx
  useEffect(() => {
    if (!showFullDemo) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowFullDemo(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showFullDemo])
```

- [ ] **Step 4: Drop the now-unused imports**

`useEffect`, `Play` and `X` are no longer referenced. Change:

```tsx
import { useEffect, useState } from "react"
```
to:
```tsx
import { useState } from "react"
```

and remove `, Play, X` from the `lucide-react` import.

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: exit 0. Only the two pre-existing `BookResearch.tsx` warnings
(`PHASES`, `scoreColor`). Any `no-unused-vars` error naming `Play`, `X`, `useEffect` or
`showFullDemo` means a removal in Steps 1–4 was missed.

- [ ] **Step 6: Commit**

```bash
git add components/sections/LandingPage.tsx
git commit -m "show one demo video on the landing page"
```

---

## Task 6: Verify in a browser

**Files:** none.

- [ ] **Step 1: Rebuild and serve**

```bash
rm -rf .next && npm run build && npm start
```
Expected: `✓ Compiled successfully`, `✓ Ready`.

- [ ] **Step 2: Check load weight and playback**

```bash
node -e '
import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const hits = [];
  p.on("request", r => { if (/\/demo\//.test(r.url())) hits.push(r.url().split("/").pop()); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(6000);
  const v = p.locator("video").first();
  console.log("video present :", await v.isVisible());
  console.log("paused on load:", await v.evaluate(el => el.paused));
  console.log("fetched       :", hits.join(", ") || "(none)");
  await b.close();
});'
```
Expected:
```
video present : true
paused on load: true
fetched       : hero-demo-poster.jpg
```
`paused on load: false` means autoplay crept back in. Any `.webm`/`.mp4` in `fetched`
means `preload="none"` was lost — both are regressions of what the user asked for.

- [ ] **Step 3: Check it at phone width**

```bash
node -e '
import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(5000);
  console.log("h-overflow:", await p.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await b.close();
});'
```
Expected: `h-overflow: false`.

- [ ] **Step 4: Watch it**

Open `http://localhost:3000`, press play, watch all of it.
Expected: no stale project names; the typewriter reads as writing; the right-click
popover is legible. This is a judgement call — if the pacing is wrong, re-run Task 4
Step 2 with different speeds. No re-recording needed.

---

## Task 7: Ship

**Files:** none modified.

- [ ] **Step 1: Review exactly what will enter history**

```bash
git status --short
du -ch public/demo/* | tail -1
```
Expected: `~2.5M total`. These are binaries — they stay in git history permanently. If
that is unwanted, stop here and move them to a CDN instead.

- [ ] **Step 2: Final verify and build**

```bash
npm run verify && rm -rf .next && npm run build
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "add product demo video to the landing page

Records the real app end to end with Playwright and cuts one take into a
click-to-play walkthrough. Nothing autoplays and the video preloads nothing,
so a visitor who does not press play downloads only the poster.

Also adds right-click commenting and character-by-character AI writing, both
of which the walkthrough shows."
```
The pre-commit hook runs `npm run verify`; expect its output before the commit lands.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Expected: `b1fa720..<new>  main -> main`. This triggers a Firebase App Hosting rollout.

- [ ] **Step 5: Confirm the rollout**

Watch the App Hosting build. Expected: `Node.js v22`, `✓ Compiled successfully`, and a
successful rollout. If it fails, get the error before changing anything — a green local
build has not always meant a green CI build in this repo.

- [ ] **Step 6: Confirm the live page**

Load the deployed URL logged out. Expected: the video shows its poster, plays on click,
and does not autoplay.

---

## Notes and risks

- **Memory pressure.** Long-running servers started as background tasks in this session
  get killed. Run `npm start` from your own terminal.
- **`.next` has one owner.** Never run `npm run build` while a `next dev` is serving the
  same directory — it corrupts both, and the symptom is blank pages, not an error.
- **Third-party flakiness.** The Amazon/Trends call stalls occasionally; the recorder
  retries research 3× before failing. A failed take costs API credits, not correctness.
- **Re-cutting is cheap, re-recording is not.** Pacing changes need only Task 4 Step 2.
- **The demo account email** (`demo.play@demo.com`) is visible in the video. That is
  accepted.
