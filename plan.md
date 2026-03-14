# PubInsights — Project Plan

## What Is This?

**PubInsights** is a SaaS app for book authors and publishers to:
1. Research keyword/niche opportunities using Amazon book data + Google Trends
2. Generate AI-powered market insights
3. Create book outlines from a title
4. Generate social media content (ads and organic posts) — **in progress**

**Stack**: Next.js 15, React 18, TypeScript, Tailwind CSS, Firebase (Auth + Firestore), OpenAI (gpt-4o / gpt-4o-mini), Decodo API (Amazon scraping), Google Trends API

---

## Core User Flow

```
Sign In → Create Project → Research Keywords → Generate Outline → [Social Media - TBD]
```

1. **Sign In** — Firebase Auth (email/password or Google OAuth)
2. **Create Project** — named container saved in Firestore `projects` collection
3. **Research Keyword** — enter keyword → concurrent:
   - Amazon search via Decodo API (~30 books)
   - Google Trends (6-month web + YouTube)
   - GPT-4o market analysis (score, insights, pros/cons, suggested title)
   - Save research to project
4. **Generate Outline** — enter title → GPT-4o-mini returns 8–12 chapters with summaries and key topics → save to project
5. **Social Media** — (backend ready, UI pending) generate ads and organic posts per platform

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Auth (email + Google) | ✅ Done | Firebase Auth |
| Project creation & listing | ✅ Done | Firestore `projects` collection |
| Amazon book search | ✅ Done | Decodo scraper API |
| Google Trends integration | ✅ Done | `google-trends-api` npm |
| Market insights (GPT-4o) | ✅ Done | `insights-agent.ts` |
| Book outline generation | ✅ Done | `outline-agent.ts` |
| Project detail view | ✅ Done | `MyProjects.tsx` |
| Social media content | ⚠️ Partial | Backend done, UI shows "Coming Soon" |
| Website generation | ❌ Stub | `/api/generate-website` is placeholder |
| Stripe payments | ❌ Not integrated | SDK included, no checkout flow |
| Firebase Cloud Functions | ❌ Not deployed | Code exists, not live |

---

## Active Work: Social Media Integration

**Goal**: Wire the social media frontend to the existing backend.

**Backend already done:**
- `app/lib/agents/social-agent.ts` — `generateAdCopy()` and `generateSocialPost()`
- `app/api/social-media/route.ts` — POST endpoint accepting title, description, contentType

**What needs to be built in `SocialMedia.tsx`:**
- Form inputs: book title, description, content type (ads vs. organic posts)
- Call `/api/social-media` on submit
- Display returned content per platform (Facebook, Instagram, Twitter, LinkedIn)
- Optional: "Save to Project" to persist in `project.socialContent[]`

---

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Main dashboard — routes between sections |
| `app/context/AuthContext.tsx` | Auth state, user doc creation |
| `app/lib/firebase/services.ts` | All Firestore CRUD |
| `app/lib/agents/insights-agent.ts` | GPT-4o market analysis |
| `app/lib/agents/outline-agent.ts` | GPT-4o-mini outline generation |
| `app/lib/agents/social-agent.ts` | GPT-4o-mini social content |
| `app/lib/services/amazon-scraper.ts` | Decodo API integration |
| `app/types/firebase.ts` | All TypeScript interfaces |
| `components/sections/BookResearch.tsx` | Keyword research UI |
| `components/sections/BookOutline.tsx` | Outline generation UI |
| `components/sections/MyProjects.tsx` | Project management + detail view |
| `components/sections/SocialMedia.tsx` | Social media UI (to be built out) |

---

## Firestore Collections

| Collection | Contents |
|---|---|
| `users` | User profile, premium status, operation count |
| `projects` | Projects with nested research[], outlines[], socialContent[] |
| `searchHistory` | Past keyword searches |
| `outlineHistory` | Generated outlines log |
| `generationLogs` | Audit trail of all AI generations |

---

## AI Models Used

| Agent | Model | Purpose |
|---|---|---|
| Insights | gpt-4o | Deep market analysis of books + trends |
| Outline | gpt-4o-mini | 8–12 chapter outline from title |
| Social | gpt-4o-mini | Ads + organic posts per platform |

---

## Environment Variables Required

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
OPENAI_API_KEY
SCRAPPER_AUTHORIZATION_KEY
```

---

## Next Steps (Priority Order)

1. **Complete Social Media UI** — wire `SocialMedia.tsx` form to `/api/social-media`, display results, add "Save to Project"
2. **Stripe checkout** — integrate payment flow for premium subscriptions
3. **Firebase Cloud Functions** — deploy existing functions
4. **Website generation** — implement the `/api/generate-website` stub
