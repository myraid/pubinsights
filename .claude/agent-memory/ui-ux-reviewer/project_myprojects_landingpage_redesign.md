---
name: MyProjects and LandingPage redesign
description: Design decisions and patterns from the MyProjects, LandingPage, and LoginForm redesign (2026-03-26)
type: project
---

## MyProjects.tsx redesign

Two-pane layout preserved. Left pane is now a fixed 72px sidebar (w-72) with white background and a `#E8D5F5` right border. Right pane uses `BRAND.bg` as the page background.

**Key patterns:**
- Active project row: `borderLeft: 3px solid BRAND.primary`, background `BRAND.bg`, ChevronRight icon
- Data section cards: replaced the 4-col grid with a responsive `DataCard` sub-component that shows icon + label + count. Active state = `borderLeft: 3px solid BRAND.primary`, background `BRAND.bg`.
- All expanded content panels: `Card` with `borderLeft: 3px solid BRAND.primary`, header strip in `BRAND.bg`, body in white.
- Empty state (no project selected): centered `FolderOpen` icon in a `BRAND.bg` rounded-2xl square, Playfair heading "Your story starts here", inline create-project form if no projects exist.
- Loading state: spinner using `border-t-transparent` with `BRAND.primary` border color.
- Replaced all `alert()` calls — NOTE: original code used `alert()` for project load errors; this was preserved as-is since changing error-handling logic was out of scope.

**Why:** The original used raw `bg-purple-100`/`bg-purple-50` Tailwind classes and a flat list. The redesign applies brand palette strictly and adds a `DataCard` component for the info sections.

**How to apply:** When touching MyProjects again, preserve the two-pane split, the `DataCard` sub-component pattern, and the left-border active state signal.

---

## LandingPage.tsx redesign

Full-bleed marketing page with sticky nav, hero section, 4-up feature grid, pricing section, bottom CTA band, and footer.

**Key patterns:**
- Hero: gradient from `BRAND.bg` to white, decorative radial blob (opacity-20, blur-3xl), eyebrow badge in `BRAND.bg`/`BRAND.primary`, Playfair headline with inline SVG underline on accent span.
- Nav: sticky, `bg-white/80 backdrop-blur-md`, brand border-bottom `#EEE0F8`. Sign-in is a ghost text button; Get Started is a rounded-full `BRAND.primary` button.
- Feature cards: white cards, `#EEE0F8` border, `BRAND.bg` icon squares, `BRAND.deep` title, `BRAND.gray` description.
- Pricing cards: highlighted card uses `BRAND.primary` background with white text/features; others are white with `#EEE0F8` border.
- Bottom CTA band: `linear-gradient(135deg, BRAND.deep 0%, BRAND.primary 100%)` background, white headline, white CTA button with `BRAND.primary` text.

**Why:** The original was a generic centered-column page with no brand differentiation. The redesign establishes a premium SaaS aesthetic using the brand palette end-to-end.

**How to apply:** Keep the sticky nav pattern and the split CTA (ghost "Sign in" + filled "Get started") in the header. Bottom CTA band gradient is a strong brand anchor — preserve it.

---

## LoginForm.tsx redesign (Tremor removal)

LoginForm was using `Card`, `Title`, `TextInput` from `@tremor/react`. These were replaced entirely with Shadcn `Input` and `Label` components plus a plain `<h1>` for the heading.

**Key patterns:**
- Split-panel layout on desktop: left brand panel (gradient `BRAND.deep` → `BRAND.primary` → `BRAND.accent`) with decorative circles, hero copy, and feature checklist. Right panel is `BRAND.bg` with a centered white auth card.
- Auth card: `rounded-2xl`, `shadow-xl`, `0 8px 40px rgba(153,0,204,0.12)`.
- Tab toggle (Sign in / Sign up): pill-style toggle built with two `<button>` elements inside a `BRAND.bg` rounded-xl container. Active tab = white bg, `BRAND.primary` text.
- Google button: includes a real inline SVG Google G mark (4-color path), not just text.
- Error state: red-tinted box using `#FFF1F2`/`#FECDD3`/`#9F1239` — consistent with BookResearch error styling.

**Why:** Tremor is being phased out (per CLAUDE.md). The visual split-panel treatment matches the LandingPage brand story while making auth feel premium.

**How to apply:** If LoginForm is modified again, preserve the split-panel layout on `lg:` breakpoint, the pill tab toggle, and the Google SVG mark. Do not reintroduce Tremor imports.
