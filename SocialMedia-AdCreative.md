# Social Media Ad Studio — Implementation Plan

## Context

The Social Media tab shows a "Coming Soon" placeholder, but the backend is fully built: `social-agent.ts` generates per-platform ad copy and organic posts via GPT-4o-mini, `/api/social-media` handles requests, and `addSocialContentToProject` persists results. BannerBear config exists but has zero API integration and is being dropped due to manual template maintenance burden.

**Goal**: Build a stunning Social Media Ad Studio where users paste an Amazon link, book data auto-populates, they select platforms and a style, and get downloadable images + AI copy for each platform. No external image service — use Satori (`@vercel/og`) to render ad layouts as React components → PNG.

## Decisions

- **Image generation**: Satori via `@vercel/og` — React JSX → PNG, zero external cost, no templates to maintain
- **Book input**: Paste Amazon URL → extract ASIN → fetch via existing `getProductDetails(asin)` → auto-fill title, cover, description, author, price
- **Content modes**: Ad or Post (user picks)
- **Platforms**: User selects from FB, IG, X, LinkedIn (checkboxes)
- **Styles**: 2-3 at launch — Clean Minimal, Bold Promotional, Quote/Review
- **Output**: Downloadable images (one per platform × style) + AI-generated caption text bundled together
- **Drop BannerBear**: Remove `app/config/bannerbear.ts`

---

## Phase 1 — Amazon Link Auto-Fill

### Step 1: Create book-lookup API route — `app/api/amazon-books/lookup/route.ts`
- GET endpoint: `?url=<amazon-url>` or `?asin=<asin>`
- Extract ASIN from URL using regex: `/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/`
- Call existing `getProductDetails(asin)` from `app/lib/services/amazon-scraper.ts`
- Also call `decodoRequest` with `amazon_product` target to get `title`, `image_url`, `price`, `rating` (since `getProductDetails` returns `RawProductResults` which has description, publisher, manufacturer but missing title/image from search results)
- Return: `{ asin, title, author, description, price, rating, imageUrl, publisher }`

### Step 2: Add ASIN search support to amazon-scraper — `app/lib/services/amazon-scraper.ts`
- Export a new function `lookupBookByAsin(asin: string)` that:
  1. Calls `fetchProductDetails(asin)` for description, publisher, categories, BSR
  2. Returns a unified `BookLookup` shape with all fields needed for the social media form

---

## Phase 2 — Image Generation with Satori

### Step 3: Install `@vercel/og`
```bash
npm install @vercel/og
```

### Step 4: Create image generation API route — `app/api/social-media/generate-image/route.ts`
- POST endpoint
- Accepts: `{ title, author, price, imageUrl, copyText, platform, style }`
- Platform determines dimensions:
  - Facebook: 1200×628
  - Instagram: 1080×1080 (feed)
  - X/Twitter: 1200×675
  - LinkedIn: 1200×627
- Style determines layout (see Step 5)
- Uses `ImageResponse` from `@vercel/og` to render JSX → PNG
- Returns: PNG image binary (`Content-Type: image/png`)

### Step 5: Design 3 ad layout styles (JSX components in the route)
Each style is a JSX function returning the layout for `ImageResponse`:

1. **Clean Minimal** — White/light purple background, book cover on left, title + copy on right, subtle brand accent bar
2. **Bold Promotional** — Deep purple gradient background (#3D0066 → #5C0099), large title, price callout badge, cover image with drop shadow
3. **Quote/Review** — Book cover as blurred background overlay, prominent quote text in white, author attribution, star rating

All styles:
- Fetch and embed the book cover image (Satori supports fetching remote images)
- Use the brand fonts (DM Sans for body, Playfair Display for headings) — loaded as ArrayBuffer for Satori
- Include PubInsights watermark/branding subtly

### Step 6: Font loading for Satori
- Satori requires fonts as ArrayBuffer, not CSS
- Load DM Sans and Playfair Display `.ttf` files from Google Fonts at build time
- Store in `public/fonts/` or fetch at runtime and cache

---

## Phase 3 — Social Media UI

### Step 7: Redesign `components/sections/SocialMedia.tsx`
Replace the placeholder with a full Ad Studio. Layout:

**Section A — Book Input** (top):
- Large text input: "Paste Amazon book link..."
- On paste/enter: show loading spinner → call `/api/amazon-books/lookup` → auto-fill card below
- Auto-filled book card: cover image, title, author, price, rating (editable description field)
- "Or enter manually" toggle to show manual input fields

**Section B — Configuration** (middle):
- **Mode toggle**: Ad / Post (pill buttons, like existing ContentGenerator pattern)
- **Platform selector**: Checkboxes with platform icons (FB, IG, X, LinkedIn) — all selected by default
- **Style selector**: 3 visual preview thumbnails (Clean Minimal, Bold, Quote) — click to select
- **Ad-specific**: Sale price input (shown only in Ad mode)
- **Post-specific**: Context/description textarea (shown only in Post mode)
- **Generate button**: "Generate Creative" — large, brand purple

**Section C — Results** (bottom, shown after generation):
- Grid of generated creatives — one card per platform
- Each card shows:
  - Platform badge (icon + name)
  - Generated image preview (rendered via Satori)
  - AI-generated caption text below the image (this is the post body/caption, separate from image text)
  - Action buttons: "Download" (saves image + caption as .txt together), "Regenerate"
- "Save to Project" dropdown — stores images + captions together in Firestore (reuse pattern from ContentGenerator)
- "Download All" button to download all images + captions

**Design approach**: Stunning visual design matching the BookResearch dark-card aesthetic. Use brand purple gradients, smooth transitions, glass-morphism cards for the results. The style selector should show small preview thumbnails of each layout style.

### Step 8: Create helper components
- `components/social-media/BookLookupInput.tsx` — Amazon URL input with auto-fetch
- `components/social-media/PlatformSelector.tsx` — Platform checkboxes with icons
- `components/social-media/StyleSelector.tsx` — Visual style picker with thumbnails
- `components/social-media/CreativeCard.tsx` — Result card with image preview + copy + actions

### Step 9: Wire up generation flow in SocialMedia.tsx
1. User configures (platforms, style, mode, description)
2. On "Generate Creative":
   - Call `/api/social-media` for AI copy (existing endpoint) → returns per-platform text
   - For each selected platform: call `/api/social-media/generate-image` with platform dimensions + style + book data + generated copy → returns PNG
   - Display results in grid
3. Download: create `<a download>` links from image blob URLs
4. Save to project: call existing `addSocialContentToProject` with items array

---

## Phase 4 — Cleanup & Polish

### Step 10: Remove BannerBear
- Delete `app/config/bannerbear.ts`
- Remove `BANNERBEAR_API_KEY` from `.env.example` if present

### Step 11: Add usage tracking
- `app/lib/billing/tiers.ts`: Add `social_images` to TierLimits (Free: 10/month, Creator: 100/month)
- `app/lib/billing/usage.ts`: Add `'social_images'` to the type union
- Check usage in `/api/social-media/generate-image` route

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/amazon-books/lookup/route.ts` | Single-book fetch by Amazon URL/ASIN |
| `app/api/social-media/generate-image/route.ts` | Satori image generation (JSX → PNG) |
| `components/social-media/BookLookupInput.tsx` | Amazon URL input with auto-fetch |
| `components/social-media/PlatformSelector.tsx` | Platform checkbox selector |
| `components/social-media/StyleSelector.tsx` | Visual style picker |
| `components/social-media/CreativeCard.tsx` | Result card with image + copy + actions |

## Files to Modify

| File | Change |
|------|--------|
| `components/sections/SocialMedia.tsx` | Complete rewrite — full Ad Studio UI |
| `app/lib/services/amazon-scraper.ts` | Add `lookupBookByAsin()` export |
| `app/lib/billing/tiers.ts` | Add `social_images` usage type |
| `app/lib/billing/usage.ts` | Add `'social_images'` to type union |
| `package.json` | Add `@vercel/og` |

## Files to Delete

| File | Reason |
|------|--------|
| `app/config/bannerbear.ts` | Replaced by Satori, no longer needed |

## Key Patterns to Reuse

- `app/lib/services/amazon-scraper.ts` → `getProductDetails(asin)` for book lookup
- `app/lib/agents/social-agent.ts` → `generateAdCopy()` and `generateSocialPost()` for AI copy
- `/api/social-media/route.ts` → existing endpoint for text generation
- `app/lib/firebase/services.ts` → `addSocialContentToProject()` for saving
- Brand palette: `deep: "#8400B8"`, `primary: "#9900CC"`, `bg: "#F5EEFF"`, `accent: "#AA00DD"`
- Dark card gradient: `#3D0066 → #5C0099` (from BookResearch verdict card)
- AbortController pattern from BookResearch for canceling in-flight requests

---

## Phase 5 — Marketing Plan & Publishing (Build Later)

> **Scope**: Plan now, implement in a follow-up session after Phase 1-4 ships.

### Step 12: Integrate Ayrshare for social publishing
- Install Ayrshare SDK: `npm install social-post-api`
- Create `app/lib/services/ayrshare-client.ts` — shared client with API key
- **OAuth flow**: Users connect their own social accounts (FB, IG, X, LinkedIn) via Ayrshare's managed OAuth
  - Ayrshare handles token management and refresh — no need to store user tokens ourselves
  - Add "Connect Accounts" settings section in SocialMedia.tsx
  - Store Ayrshare `profileKey` per user in Firestore `users/{uid}` document
- Create API route `app/api/social-media/publish/route.ts`:
  - POST: `{ userId, platform, text, imageUrl?, scheduledDate? }`
  - Uploads generated image to Ayrshare, publishes or schedules post
  - Returns post ID and status

### Step 13: Create marketing plan AI agent — `app/lib/agents/marketing-agent.ts`
- **`generateMarketingPlan()`**:
  - Model: `gpt-4o` (needs strategic reasoning)
  - Input: book title, description, genre/categories, target audience, launch date (optional), budget (optional)
  - Output: 30-day posting calendar as JSON:
    ```typescript
    interface MarketingPlan {
      bookTitle: string
      duration: '30_days'
      strategy: string                    // 2-3 sentence overview
      contentPillars: string[]            // 3-5 themes (e.g., "Behind the scenes", "Reader testimonials")
      calendar: CalendarEntry[]
    }
    interface CalendarEntry {
      day: number                         // 1-30
      date: string                        // ISO date
      platform: string                    // FB, IG, X, LinkedIn
      contentType: 'post' | 'ad'
      theme: string                       // Which content pillar
      suggestedTime: string               // e.g., "9:00 AM EST"
      briefDescription: string            // What to post
      copyDraft: string                   // AI-generated copy
      hashtags?: string[]                 // For IG/X
      callToAction?: string               // For ads
    }
    ```
  - Tailors posting frequency and platform mix to book genre
  - Suggests optimal posting times per platform
  - Follows `response_format: { type: 'json_object' }` pattern

### Step 14: Create marketing plan API route — `app/api/social-media/marketing-plan/route.ts`
- POST: `{ userId, bookTitle, description, categories, launchDate?, budget? }`
- Calls `generateMarketingPlan()` from marketing agent
- Usage check via `checkAndIncrementUsage(userId, 'marketing_plans')`
- Returns the full `MarketingPlan` JSON

### Step 15: Marketing Plan UI — extend `SocialMedia.tsx`
- Add a third top-level tab: **Create** | **Marketing Plan** | **Published**
- **Marketing Plan tab**:
  - "Generate Plan" button → calls marketing plan API
  - Calendar view (monthly grid) showing planned posts by day
  - Each day shows platform icon(s) and content type badge
  - Click a day → expands to show copy draft, suggested time, theme
  - "Generate Creative" button on each entry → feeds into Phase 1's image generation flow
  - "Schedule" button on each entry → publishes via Ayrshare with scheduled date
  - "Approve & Schedule All" → batch-schedules the entire 30-day plan
- **Published tab**:
  - List of all published/scheduled posts with status (published, scheduled, failed)
  - Pull status from Ayrshare API

### Step 16: Firestore data model for marketing plans
- Add to `app/types/firebase.ts`:
  ```typescript
  interface MarketingPlan {
    id: string
    projectId: string
    userId: string
    bookTitle: string
    plan: CalendarEntry[]
    status: 'draft' | 'active' | 'completed'
    createdAt: Timestamp
    updatedAt: Timestamp
  }
  ```
- Store as subcollection: `projects/{projectId}/marketingPlans/{planId}`
- Add CRUD functions to `services.ts`: `createMarketingPlan()`, `getMarketingPlan()`, `updateCalendarEntry()`

### Step 17: Usage tracking for Phase 5
- `app/lib/billing/tiers.ts`: Add `marketing_plans` (Free: 1/month, Creator: 10/month) and `social_publishes` (Free: 10/month, Creator: 200/month)
- `app/lib/billing/usage.ts`: Add both to the type union

### Phase 5 Files to Create

| File | Purpose |
|------|---------|
| `app/lib/services/ayrshare-client.ts` | Ayrshare SDK client wrapper |
| `app/api/social-media/publish/route.ts` | Publish/schedule posts via Ayrshare |
| `app/lib/agents/marketing-agent.ts` | AI agent for 30-day marketing plan generation |
| `app/api/social-media/marketing-plan/route.ts` | Marketing plan API route |

### Phase 5 Files to Modify

| File | Change |
|------|--------|
| `components/sections/SocialMedia.tsx` | Add Marketing Plan tab, Published tab, account connection UI |
| `app/types/firebase.ts` | Add MarketingPlan, CalendarEntry interfaces |
| `app/lib/firebase/services.ts` | Add marketing plan CRUD functions |
| `app/lib/billing/tiers.ts` | Add `marketing_plans`, `social_publishes` usage types |
| `app/lib/billing/usage.ts` | Add new types to union |
| `package.json` | Add `social-post-api` (Ayrshare SDK) |

### Phase 5 New Environment Variables

```
AYRSHARE_API_KEY              # Ayrshare API key for social publishing
```

---

## Tool Research Summary (for reference)

Evaluated BannerBear ($49/mo), Placid ($29/mo), RenderForm ($49/mo), APITemplate.io ($7/mo), DALL-E 3, Polotno, Ayrshare ($29/mo), Buffer, Hootsuite, Meta/Google/TikTok ad APIs.

**Phase 1-4 decision**: Satori (`@vercel/og`) replaces all template-based image services — zero cost, no manual template setup, layouts are React components.

**Phase 5 decision**: Ayrshare for social publishing — API-first, built for SaaS embedding, managed OAuth, $29/mo. Users connect their own social accounts.

## Verification — Phase 1-4

1. Paste an Amazon book URL → verify book data auto-populates (title, cover, author, price)
2. Select platforms (e.g., FB + IG) → pick Bold style → click Generate
3. Verify AI copy appears per platform with platform-appropriate tone
4. Verify image previews render correctly with book cover, title, and copy text
5. Click "Download" → verify image + caption download together at correct platform dimensions
6. Save to Project → verify Firestore `socialContent[]` array updated with images + captions
7. Test all 3 styles render correctly across all 4 platform sizes

## Verification — Phase 5 (future)

1. Connect social accounts via Ayrshare OAuth → verify profileKey stored in Firestore
2. Generate marketing plan → verify 30-day calendar renders with posts per day
3. Click "Schedule" on a calendar entry → verify post scheduled in Ayrshare
4. Check Published tab → verify post shows "scheduled" status
5. "Approve & Schedule All" → verify batch scheduling works
6. Verify usage limits enforced for `marketing_plans` and `social_publishes`
