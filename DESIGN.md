# PubInsights — Design Document

**Date**: March 14, 2026
**Status**: Active Development

---

## Overview

PubInsights is a SaaS platform for indie book authors and publishers. It aggregates market data (Amazon listings, Google Trends) with AI-generated analysis to help users identify profitable niches, structure books, and create platform-ready marketing content — all in one workflow.

---

## Problem Statement

Indie authors spend significant time manually:
- Researching whether a niche is saturated or underserved on Amazon
- Analyzing trend data across web and YouTube
- Structuring a book from scratch
- Writing platform-specific social media copy for each channel

PubInsights collapses this into a single, guided workflow.

---

## User Flow

```
Sign In → Create Project → Research Keyword → Generate Outline → Generate Social Content
```

1. **Sign In** — Firebase Auth (email/password + Google OAuth)
2. **Create Project** — named container stored in Firestore
3. **Research Keyword** — concurrent fetch of:
   - ~30 Amazon books via Decodo scraper API
   - 6-month Google Trends (web + YouTube)
   - GPT-4o market analysis: niche score, insights, pros/cons, title suggestion
4. **Generate Outline** — title → GPT-4o-mini → 8–12 chapter structure with key topics
5. **Generate Social Content** — book details → GPT-4o-mini → ads or organic posts per platform (Facebook, Instagram, Twitter, LinkedIn)

All data is persisted to the project in Firestore.

---

## Architecture

### Frontend
- **Next.js 15** (App Router), React 18, TypeScript, Tailwind CSS
- Single-page dashboard (`app/page.tsx`) routes between section components
- Section components: `BookResearch`, `BookOutline`, `MyProjects`, `SocialMedia`

### Backend (Next.js API Routes)
| Route | Purpose |
|---|---|
| `/api/research` | Concurrent Amazon + Trends + GPT-4o analysis |
| `/api/generate-outline` | GPT-4o-mini chapter outline |
| `/api/social-media` | GPT-4o-mini ad copy or organic posts |
| `/api/generate-website` | Stub — not implemented |

### AI Agents (`app/lib/agents/`)
| Agent | Model | Purpose |
|---|---|---|
| `insights-agent.ts` | gpt-4o | Deep market analysis from book + trend data |
| `outline-agent.ts` | gpt-4o-mini | Structured chapter outline from title |
| `social-agent.ts` | gpt-4o-mini | Platform-specific ad copy + organic posts |

### Data Layer
- **Firebase Auth** — user identity
- **Firestore** — projects, search history, outline history, generation logs

### External APIs
- **Decodo** — Amazon book scraping
- **google-trends-api** (npm) — trend data
- **OpenAI** — GPT-4o / GPT-4o-mini

---

## Data Model

### `projects` collection
```
Project {
  id, name, description, userId
  createdAt, updatedAt
  research[]: { keyword, trendData, books[], marketIntelligence? }
  outlines[]:  { title, outline: { Title, Chapters[] } }
  socialContent[]: { title, contentType, items[]: { type, platform, content } }
}
```

### Supporting collections
- `users` — profile, premium status, operation count
- `searchHistory` — past keyword searches
- `outlineHistory` — generated outlines log
- `generationLogs` — audit trail for all AI generations

---

## Feature Status

| Feature | Status |
|---|---|
| Auth (email + Google) | Done |
| Project CRUD | Done |
| Amazon book search | Done |
| Google Trends integration | Done |
| GPT-4o market insights | Done |
| Book outline generation | Done |
| Social media backend | Done |
| Social media UI | **In Progress** — shows "Coming Soon" |
| Stripe payments | Not started |
| Website generation | Stub only |
| Firebase Cloud Functions | Code exists, not deployed |

---

## Active Work: Social Media UI

The backend (`social-agent.ts`, `/api/social-media`) is complete and accepts:
- `title` — book title
- `description` — book description
- `contentType` — `"ad"` or `"post"`

`SocialMedia.tsx` needs:
1. Form with title, description, content type selector
2. POST to `/api/social-media` on submit
3. Display results grouped by platform
4. "Save to Project" — persist `ProjectSocialContent` to Firestore

---

## Next Priorities

1. **Social Media UI** — wire `SocialMedia.tsx` to existing API
2. **Stripe** — subscription checkout for premium tier
3. **Firebase Cloud Functions** — deploy existing functions
4. **Website Generation** — implement `/api/generate-website` stub

---

## Code Assessment (2026-03-15)

Full honest review of the codebase. To be revisited before moving to production.

### Strengths
- Clean separation of concerns: agents, services, components
- Modern stack, good TypeScript coverage overall
- Tremor + Shadcn UI polish is solid
- Research workflow (parallel Amazon + Trends + GPT-4o) is well-designed

### Critical Bugs (fix before any production use)

**1. Firestore data overwrite — silent data loss** (`services.ts`)
`addMarketResearchToProject` and `addOutlineToProject` replace the entire array instead of appending. Every new search or outline wipes all previous ones. The UI iterates over `outlines[]` plural, so users believe history is saved — it isn't.

**2. Outline title not saved** (`BookOutline.tsx:131`)
`setTitle('')` is called before `saveOutlineHistory`, so outline history always saves with an empty title string.

**3. Race condition in BookResearch** (`BookResearch.tsx`)
`fetchData` has no `AbortController` and no unmount guard. Rapid keyword changes or navigating away mid-search causes stale responses to overwrite current state. Phase stepper hides on a hardcoded 1500ms timeout regardless of actual load state.

**4. AuthContext Firestore error is silent** (`AuthContext.tsx:40–51`)
`setDoc` for new user document creation has no try/catch. If it fails, the user is left in a broken half-authenticated state with no feedback.

### Security Issues

**5. Unauthenticated API routes**
`/api/amazon-books/search` and `/api/trends` have no Firebase auth check. Any unauthenticated request hits the paid Decodo API. Add a session/token check before proxying to external services.

**6. Console logs expose user data** (`services.ts`)
Multiple `console.log` statements output `userId` and project data. Remove before production deployment.

### Data Quality Issues

**7. Overuse of `unknown` types** (`MyProjects.tsx`)
`socialMedia: unknown | null`, `outline as unknown as {...}`, and similar casts erode type safety. Runtime shape changes in Firestore will cause cryptic crashes rather than type errors.

**8. No input validation with user feedback**
`BookOutline.tsx`, `MyProjects.tsx`, and others silently `return` on empty inputs with no toast or message. Users don't know why nothing happened.

### Architecture / Code Quality

**9. Dual UI library imports** (`BookResearch.tsx`)
Both Tremor's `Button as TremorButton` and Shadcn's `Button` are imported and used inconsistently. Pick one per component.

**10. No error boundaries**
A single component throw crashes the entire dashboard. Section components need error boundaries given the volume of async operations.

**11. Error handling is inconsistent**
Mix of `alert()`, `toast()` (Sonner), and silent `console.error()` throughout. Standardize on Sonner toasts.

**12. `migrateToMainCollections()` exists but is never called** (`services.ts:576`)
Suggests an unresolved Firestore schema inconsistency between document shapes. Investigate before any data migration work.

**13. Plotly bundle size**
`react-plotly.js` (~1MB) is used only for small trend sparklines. Consider replacing with Recharts or a lightweight SVG chart.

### UX Issues

**14. Workflow has no enforced progression**
Users can jump directly to Social Media without having done any research or outline. The project container doesn't guide users through the intended flow.

**15. No empty states**
When a project has no research or outlines, there's a generic placeholder with no "start here" guidance.

**16. Input fields not disabled during generation** (`BookOutline.tsx`)
Spinner shows during generation but inputs remain editable. User can type while a request is in flight.

### Summary

| Severity | Count |
|---|---|
| Critical (data loss / broken state) | 4 |
| Security | 2 |
| Data quality / type safety | 2 |
| Architecture / code quality | 5 |
| UX | 3 |
| **Total** | **16** |

---

## Environment Variables Required

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY  (server-side)
OPENAI_API_KEY
SCRAPPER_AUTHORIZATION_KEY
SOCIAL_MEDIA_WEBHOOK_URL / INSIGHTS_WEBHOOK_URL  (Make.com webhooks)
BANNERBEAR_API_KEY  (optional, ad image generation)
```
