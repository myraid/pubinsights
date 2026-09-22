#!/usr/bin/env node
/**
 * Records the landing-page hero demo: login -> research -> outline -> chapter draft.
 *
 * Runs against the real app and real APIs, so a take costs OpenAI + Decodo credits and
 * writes real data to the demo account's Firestore. Nothing is stubbed.
 *
 *   DEMO_EMAIL=... DEMO_PASSWORD=... npm run record:demo
 *
 * Emits recordings/<timestamp>.webm plus a .timings.json marking when each stage
 * finished, so scripts/edit-demo.sh can cut on real offsets instead of guesswork.
 */
import { chromium } from 'playwright'
import { mkdir, writeFile, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.DEMO_EMAIL
const PASSWORD = process.env.DEMO_PASSWORD
const HEADED = process.env.HEADED === '1'
const OUT_DIR = 'recordings'

// What the demo searches for and writes about. Keep it in a niche that returns a
// healthy Amazon result set — a thin one makes the research stage look empty.
const NICHE = process.env.DEMO_NICHE ?? 'meal prep for beginners'
const BOOK_TITLE = process.env.DEMO_TITLE ?? 'The 30-Minute Meal Prep Method'
const PROJECT_NAME = process.env.DEMO_PROJECT ?? 'Meal Prep Demo'

if (!EMAIL || !PASSWORD) {
  console.error('Set DEMO_EMAIL and DEMO_PASSWORD (add them to .env.local, then export them).')
  process.exit(1)
}

const timings = []
let t0 = 0

/** Marks a stage boundary at the current video offset. */
function mark(stage) {
  const at = (Date.now() - t0) / 1000
  timings.push({ stage, at })
  console.log(`  [${at.toFixed(1)}s] ${stage}`)
}

/** Lets the UI settle so the edit has clean frames to cut on. */
const settle = (page, ms = 800) => page.waitForTimeout(ms)

/**
 * Narrows to the one visible match. app/page.tsx keeps every section mounted and hides
 * the inactive ones with display:none, so most labels exist several times in the DOM.
 */
const visible = (locator) => locator.filter({ visible: true }).first()

/** The top nav is a grid of <Card> divs, not buttons — match the label text. */
const navTo = (page, name) => visible(page.getByText(name, { exact: true })).click()

/**
 * Clicks a control only if it shows up quickly. Takes are not run against a fresh
 * account — a manuscript and its section plan persist in Firestore between runs, so
 * these steps are already done on a second take. Returns whether it clicked.
 */
async function clickIfPresent(locator, label, timeout = 10_000) {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    await locator.click()
    console.log(`  · ${label}`)
    return true
  } catch {
    console.log(`  · ${label} — already done, skipping`)
    return false
  }
}

/**
 * Clicks the first locator that resolves. UI copy drifts; this keeps a label change
 * from taking down the whole take, and reports which candidate actually matched.
 */
async function clickFirst(page, candidates, label) {
  for (const make of candidates) {
    const locator = make()
    try {
      await locator.first().waitFor({ state: 'visible', timeout: 15_000 })
      await locator.first().click()
      return
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`Could not find a control for "${label}" — update its selector in scripts/record-demo.mjs`)
}

/** Fills and submits the login form. Two "Sign in" controls exist; the form owns submit. */
async function submitLogin(page) {
  await page.getByRole('button', { name: /already have an account/i }).click()
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
}

/** Signs in on the current page. */
async function signIn(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await submitLogin(page)
  await visible(page.getByText('Book Research', { exact: true })).waitFor({ timeout: 60_000 })
}

/**
 * Reloads and lands in the app whichever way auth resolves.
 *
 * Sections cache their project list in a useEffect keyed on [user], so a reload is the
 * only way to surface a project created mid-session. But app/page.tsx renders null while
 * AuthContext is loading, and reloading shortly after sign-in can outrun Firebase
 * persisting its credential — leaving a blank page, or the landing page. Handle both.
 */
async function reloadIntoApp(page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  const nav = visible(page.getByText('Book Research', { exact: true }))
  const landing = page.getByRole('button', { name: /already have an account/i })
  try {
    await nav.waitFor({ timeout: 45_000 })
  } catch {
    // Session did not survive the reload — sign in again.
    await landing.waitFor({ timeout: 30_000 })
    await submitLogin(page)
    await nav.waitFor({ timeout: 60_000 })
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  t0 = Date.now()

  const page = await context.newPage()
  // The AI stages legitimately take minutes; the default 30s would abort mid-take.
  page.setDefaultTimeout(180_000)

  // Hide Next's dev-mode indicator so it never lands in the frame when recording
  // against `next dev`. Harmless against a production build, where it doesn't exist.
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = 'nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }'
    document.addEventListener('DOMContentLoaded', () => document.head.append(style))
  })

  try {
    // ── 1. Landing + login ────────────────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await settle(page, 1500)
    mark('landing')

    await signIn(page)
    await settle(page)
    mark('logged-in')

    // ── 2. Create the project, on camera ──────────────────────────────────
    await navTo(page, 'My Projects')
    await settle(page, 1200)
    await visible(page.getByPlaceholder(/new project name/i)).click()
    // Typed rather than filled so the viewer sees it being entered.
    await visible(page.getByPlaceholder(/new project name/i)).pressSequentially(PROJECT_NAME, { delay: 70 })
    await settle(page, 600)
    await visible(page.getByPlaceholder(/new project name/i)).press('Enter')
    await visible(page.getByText(PROJECT_NAME, { exact: true })).waitFor({ timeout: 30_000 })
    await settle(page, 1800)
    mark('project-created')

    // Every section loads its project list in a useEffect keyed on [user], so the new
    // project is invisible to them until a reload. Cut out in the edit.
    await reloadIntoApp(page)
    await settle(page, 600)

    // ── 3. Book Research ──────────────────────────────────────────────────
    await navTo(page, 'Book Research')
    await settle(page, 600)

    // The Amazon scraper and Trends API are third-party and occasionally hang, which
    // leaves the UI parked on "Scanning the market…" forever. Retry rather than lose
    // the whole take — everything downstream depends on this stage.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const field = visible(page.getByPlaceholder(/meal prep for beginners/i))
      await field.click()
      await field.fill('')
      // Typed, not filled — the viewer should see the niche being entered.
      await field.pressSequentially(NICHE, { delay: 65 })
      await settle(page, 600)
      await visible(page.getByRole('button', { name: /analyze market/i })).click()
      try {
        // Waits out both phases: books+trends, then /api/insights.
        await visible(page.getByRole('button', { name: /save to project/i }))
          .waitFor({ timeout: 75_000 })
        break
      } catch {
        if (attempt === 3) throw new Error('Research stalled 3× — upstream Amazon/Trends is not responding')
        console.log(`  · research stalled, retry ${attempt}/2`)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await navTo(page, 'Book Research')
        await settle(page, 1000)
      }
    }
    await settle(page, 1500)
    mark('research-done')

    // Hold on the opportunity score and verdict — this is the claim the hero headline
    // makes, so it needs long enough on screen to actually be read.
    const score = visible(page.locator('span.tabular-nums').filter({ hasText: /^\d+\.\d$/ }))
    await score.scrollIntoViewIfNeeded().catch(() => {})
    await settle(page, 5000)
    mark('research-score')

    // Opens a Radix dropdown of existing projects; the save happens on the menu item.
    await visible(page.getByRole('button', { name: /save to project/i })).click()
    await settle(page, 600)
    await page.getByRole('menuitem', { name: PROJECT_NAME }).click()
    await settle(page, 1200)
    mark('research-saved')

    // ── 3. Book Outline ───────────────────────────────────────────────────
    await navTo(page, 'Book Outline')
    await settle(page, 600)

    await visible(page.getByPlaceholder(/enter your book title/i)).fill(BOOK_TITLE)
    await settle(page, 400)
    await visible(page.getByRole('button', { name: /generate outline/i })).click()

    // Chapter rows only exist once the outline lands.
    await visible(page.getByPlaceholder(/chapter title/i)).waitFor({ timeout: 180_000 })
    await settle(page, 1500)
    mark('outline-done')

    // Book Writer reads outlines off the project, so attach it (same dropdown pattern).
    await visible(page.getByRole('button', { name: /save to project/i })).click()
    await settle(page, 600)
    await page.getByRole('menuitem', { name: PROJECT_NAME }).click()
    await settle(page, 1200)
    mark('outline-saved')

    // ── 4. Book Writer ────────────────────────────────────────────────────
    // Requires subscriptionTier 'creator' or 'beta' on the demo user (app/page.tsx:89),
    // otherwise this lands on BookWriterGate and the next step will not be found.
    // BookWriter derives projectsWithOutlines in a useEffect keyed on [user], so the
    // outline we just attached is invisible to it. Reload to refetch — this lands
    // between edit segments, so it never appears in the cut.
    // Not networkidle: Firestore holds a WebChannel open, so the network is never idle
    // once signed in and the wait would run to timeout.
    await reloadIntoApp(page)
    await settle(page, 800)

    await navTo(page, 'Book Writer')
    await settle(page, 800)

    // Step 1: pick the project. The outline auto-selects when the project has exactly
    // one (BookWriter.tsx:121), which is the case for a fresh demo project.
    await visible(page.getByRole('button', { name: /choose a project/i })).click()
    await settle(page, 600)
    await page.getByRole('menuitem', { name: PROJECT_NAME }).click()
    await settle(page, 1200)

    // A manuscript from an earlier take persists and auto-opens (manuscripts.length > 0
    // in BookWriter.tsx), in which case this button never renders.
    await clickIfPresent(
      visible(page.getByRole('button', { name: /start new manuscript/i })),
      'start new manuscript',
    )
    await settle(page, 1500)
    mark('manuscript-ready')

    // Likewise the section plan survives between takes.
    if (await clickIfPresent(
      visible(page.getByRole('button', { name: /plan sections/i })),
      'plan sections',
    )) {
      await visible(page.getByRole('button', { name: /generate ai draft/i }))
        .waitFor({ timeout: 180_000 })
    }
    await settle(page, 1200)
    mark('sections-planned')

    await visible(page.getByRole('button', { name: /generate ai draft/i })).click()

    // Split the wait from the reveal: everything up to draft-typing is a spinner and
    // can be rushed; from there the typewriter is writing and must play near real time.
    await visible(page.locator('[contenteditable="true"] p')).waitFor({ timeout: 180_000 })
    mark('draft-typing')
    await page.getByText(/draft generated/i).waitFor({ timeout: 180_000 }).catch(() => {})
    await settle(page, 5000)
    mark('draft-done')

    // ── 6. Comment and revise ─────────────────────────────────────────────
    // The review loop is the part that shows the author staying in control, so it is
    // worth screen time. A comment needs a real selection in the Tiptap editor —
    // triple-click selects a whole paragraph.
    // `.{60,}` is "a paragraph with at least 60 characters" — note \w{60,} would demand
    // 60 consecutive word chars with no spaces, which no prose ever satisfies.
    const paragraph = visible(
      page.locator('[contenteditable="true"] p, .ProseMirror p').filter({ hasText: /.{60,}/ }),
    )
    await paragraph.scrollIntoViewIfNeeded().catch(() => {})
    await settle(page, 1200)
    await paragraph.click({ clickCount: 3 })
    await settle(page, 1200)

    // Pressing the right button lands a real mousedown first, which collapses the
    // triple-click selection to the word under the cursor before contextmenu fires.
    // Dispatch the event instead so the passage we selected is the one commented on.
    const selected = await page.evaluate(() => (window.getSelection()?.toString() ?? '').length)
    if (selected < 40) throw new Error(`Selection collapsed before commenting (${selected} chars)`)
    await paragraph.dispatchEvent('contextmenu')
    await settle(page, 1200)

    const feedback = visible(page.getByPlaceholder(/tell the ai what to change/i))
    await feedback.pressSequentially('Make this opening punchier and cut it to two sentences.', { delay: 45 })
    await settle(page, 900)
    await visible(page.getByRole('button', { name: /add comment/i })).click()
    await settle(page, 2000)
    mark('comment-added')

    await visible(page.getByRole('button', { name: /revise \d+ comment/i })).click()
    mark('revise-started')
    // Revision is another AI round-trip.
    await visible(page.getByRole('button', { name: /revise with ai|approve/i })
      .first()).waitFor({ timeout: 180_000 }).catch(() => {})
    await settle(page, 5000)
    mark('revised')
  } catch (error) {
    // Still close cleanly: a partial video is usually worth inspecting.
    console.error(`\nTake failed: ${error.message}`)
    // Capture what was actually on screen — a failed take is otherwise opaque.
    await page.screenshot({ path: join(OUT_DIR, 'failure.png'), fullPage: true }).catch(() => {})
    const onscreen = await page.locator('body').innerText().catch(() => '')
    await writeFile(join(OUT_DIR, 'failure.txt'), onscreen).catch(() => {})
    console.error('Screen at failure: recordings/failure.png (and .txt)')
    process.exitCode = 1
  } finally {
    const video = page.video()
    await context.close() // video is only flushed to disk on close
    await browser.close()

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (video) {
      const raw = await video.path()
      await rename(raw, join(OUT_DIR, `${stamp}.webm`)).catch(() => {})
    }
    await writeFile(
      join(OUT_DIR, `${stamp}.timings.json`),
      JSON.stringify({ stamp, niche: NICHE, title: BOOK_TITLE, timings }, null, 2),
    )
    console.log(`\nWrote ${OUT_DIR}/${stamp}.webm`)
    console.log(`Stage offsets in ${OUT_DIR}/${stamp}.timings.json — feed these to scripts/edit-demo.sh`)
    console.log(`\nAll takes:\n  ${(await readdir(OUT_DIR)).join('\n  ')}`)
  }
}

main()
