# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint via next lint
```

There are no tests. No test runner is configured.

## Architecture

### Entry Point & Navigation
`app/page.tsx` is the entire app shell. It renders a 4-card nav (My Projects, Book Research, Book Outline, Social Media) and mounts all section components simultaneously — toggling visibility with `display: block/none`, not routing. All sections are always mounted.

### Auth
`app/context/AuthContext.tsx` wraps the app via `app/layout.tsx`. It exposes `{ user, loading, signIn, signUp, signInWithGoogle, signOut }`. User documents are created in Firestore on first sign-in. All authenticated API calls rely on `user.uid` from this context.

### API Routes (`app/api/`)
Server-side Next.js route handlers. Each calls an agent and returns JSON.

| Route | Agent | Notes |
|---|---|---|
| `/api/insights` | `insights-agent.ts` | GPT-4o, market analysis |
| `/api/generate-outline` | `outline-agent.ts` | GPT-4o-mini, chapter outline |
| `/api/social-media` | `social-agent.ts` | GPT-4o-mini, ad copy + organic posts |
| `/api/amazon-books/search` | `amazon-scraper.ts` | Decodo API, no auth check |
| `/api/trends` | google-trends-api | No auth check |
| `/api/generate-website` | — | Unimplemented stub |
| `/api/checkout` | Stripe | Stub |

**Important:** `/api/amazon-books/search` and `/api/trends` have no authentication guard — they will call external paid APIs for any unauthenticated request.

### AI Agents (`app/lib/agents/`)
All agents use a shared OpenAI client (`openai-client.ts`). The exported `MODEL` constant is `gpt-4o-mini` — `insights-agent.ts` overrides this locally with `INSIGHTS_MODEL = 'gpt-4o'`. All agents use `response_format: { type: 'json_object' }` and return typed structs.

**`InsightsResult` shape** (from `insights-agent.ts`):
```ts
{
  rating: number               // 0–10 market opportunity score
  insights: string[]           // 4–5 key findings
  pros: string[]               // 3–5 opportunities
  cons: string[]               // 3–5 risks
  verdict: 'Explore' | 'Proceed with Caution' | 'Avoid'
  verdict_reason: string       // one-sentence explanation
  keyword_suggestions: string[] // 4–6 related keywords
  title_suggestion?: string    // optional
  subtitle_suggestion?: string // optional, only with title
}
```

The `/api/insights` route enriches each book with an `is_indie` flag (computed server-side from publisher/manufacturer name overlap) before sending to the agent. This gives the model explicit indie/traditional signals without the frontend needing to re-derive them.

### Firebase
- **Client SDK**: `app/lib/firebase/` — initialized once, re-exported
- **Admin SDK**: `app/lib/firebase/admin.ts` — used only in API routes
- **All Firestore CRUD**: `app/lib/firebase/services.ts` — single file for all reads/writes

**Known data issue**: `addMarketResearchToProject` and `addOutlineToProject` in `services.ts` overwrite the entire `research[]` / `outlines[]` array rather than appending. Each project can only hold one research entry and one outline at a time despite the UI iterating over plurals.

### UI Components
- **Shadcn** (`components/ui/`) — base components (Button, Card, Input, etc.). Use this exclusively — do not mix with Tremor Button/TextInput in the same component.
- **Tremor** (`@tremor/react`) — still present as a dependency but being phased out of section components
- **Plotly** (`react-plotly.js`) — trend charts; imported dynamically with SSR disabled (`dynamic(() => import('react-plotly.js'), { ssr: false })`)
- **Sonner** — toast notifications; use `toast()` everywhere, never `alert()` or `window.confirm()`

### Fonts
Fonts are loaded via `next/font/google` in `app/layout.tsx` and injected as CSS variables on `<body>`:
- `--font-playfair` — Playfair Display (700, 900) — display/heading use
- `--font-dm-sans` — DM Sans (300–600) — body text

**Never use `<style>@import</style>` inside a client component** — it causes React hydration errors and Fast Refresh crashes in Next.js. Always load fonts at the layout level.

### Firestore Collections
- `users` — profile + premium status
- `projects` — main data container; nested `research[]`, `outlines[]`, `socialContent[]`
- `searchHistory`, `outlineHistory`, `generationLogs` — audit/history

### Key Types
All shared TypeScript interfaces live in `app/types/firebase.ts`. The `types/` directory at root contains Amazon/Trends-specific types.

## Environment Variables

Two Firebase configs are needed — client-side (`NEXT_PUBLIC_*`) and server-side admin:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY          # Stored with literal \n, replaced at runtime
OPENAI_API_KEY
SCRAPPER_AUTHORIZATION_KEY    # Decodo API key
SOCIAL_MEDIA_WEBHOOK_URL      # Make.com webhook (optional)
INSIGHTS_WEBHOOK_URL          # Make.com webhook (optional)
BANNERBEAR_API_KEY            # Optional, ad image generation
```

## BookResearch Component Notes

`components/sections/BookResearch.tsx` has been fully rebuilt. Key patterns to preserve:

**Fetch flow** — Amazon books and Google Trends run in parallel via `Promise.allSettled`. Market intelligence is triggered only after both complete:
```
setPhase("searching") → Promise.allSettled([books, trends]) → setPhase("analyzing") → /api/insights → setPhase("done")
```

**Indie detection** (`detectIndie`) — two rules only:
1. Publisher contains `"independently published"`
2. Author name (`manufacturer` field — Amazon stores author here for books) substantially overlaps publisher name via word matching

Do not reintroduce hardcoded publisher lists.

**AbortController** — `abortRef.current` is set at the start of every `analyze()` call and cancels any previous in-flight request. Always preserve this pattern when modifying the fetch logic.

**Color scheme** — purple palette matching the brand: background `#f5eeff`, primary `purple-600`/`purple-700`, CSS variables `--font-playfair` and `--font-dm-sans` for typography.

## Active Work

`SocialMedia.tsx` currently shows a "Coming Soon" placeholder. The backend is fully built — `app/lib/agents/social-agent.ts` exports `generateAdCopy()` and `generateSocialPost()`, and `/api/social-media` accepts `{ title, description, contentType: 'ad' | 'post' }`. The UI needs a form wired to this endpoint with per-platform results display and a "Save to Project" action calling `addSocialContentToProject` in `services.ts`.

## Known Bugs (not yet fixed)

- **`addMarketResearchToProject` and `addOutlineToProject`** in `services.ts` overwrite the entire array instead of appending. Every new search or outline silently deletes all previous ones. Fix: use `arrayUnion` or fetch-then-append before writing.
- **Outline title bug** in `BookOutline.tsx`: `setTitle('')` is called before `saveOutlineHistory`, so history always saves with an empty title.
- **No rate limiting** on `/api/amazon-books/search` and `/api/trends` — unauthenticated requests hit paid external APIs.
