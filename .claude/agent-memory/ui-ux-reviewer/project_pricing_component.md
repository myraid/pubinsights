---
name: Pricing component
description: Notes on the Pricing.tsx section component — what it does, design decisions, and integration points
type: project
---

`components/sections/Pricing.tsx` was built 2026-03-20.

**What it does:**
- Fetches `/api/usage?userId=<uid>` on mount via AbortController pattern (mirrors BookResearch)
- Checks `?checkout=success` / `?checkout=cancel` URL params and fires a `toast()`, then cleans the URL via `router.replace`
- Renders two cards: Free ($0) and Creator ($9/mo)
- Usage progress bars are shown only on the user's current plan card; skeleton shown while loading
- Upgrade button POSTs to `/api/checkout` with `{ planId: 'creator', userId, email }` and redirects to `data.url`
- Both CTA buttons are disabled and labelled "Current Plan" when that tier is active

**Design decisions:**
- No `Badge` component exists in `components/ui/` — the "Most Popular" label is an absolutely-positioned `<div>` in the top-right corner of the Creator card
- Creator card uses `outline: 2px solid var(--brand-primary)` + a `box-shadow` for the purple ring — not a Tailwind ring utility, because the card border and ring need to look distinct
- Usage bars use `var(--brand-primary)` fill; amber (`#b45309`) when >= 80% consumed to signal approaching the limit
- `useSearchParams` requires the component to be inside a Suspense boundary if used in Next.js 14 app router — document this if integrating into `app/page.tsx`

**Integration:**
- Add `Pricing` to the sections array in `app/page.tsx` with a suitable icon (e.g. `CreditCard` from lucide-react) to expose it in the nav
- The `/api/usage` route is a stub — it needs to be implemented server-side to read the user's Firestore doc and compute monthly usage against plan limits

**Why:** User requested a full pricing section with upgrade flow, usage awareness, and checkout integration to support a freemium monetisation model.

**How to apply:** When touching Pricing.tsx, preserve the AbortController fetch pattern and the URL-param cleanup approach — both are consistent with patterns used in BookResearch.
