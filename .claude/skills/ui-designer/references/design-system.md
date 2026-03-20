# PubInsights Design System — Full Reference

## CSS Variable Declarations (`app/globals.css`)

```css
:root {
  --brand-deep:    #8400B8;  /* deep purple    */
  --brand-primary: #9900CC;  /* primary purple */
  --brand-bg:      #F5EEFF;  /* soft lavender  */
  --brand-gray:    #6E6E6E;  /* neutral gray   */
  --brand-accent:  #AA00DD;  /* vivid accent   */

  /* Shadcn token overrides */
  --primary: 285 100% 40%;          /* maps to #9900CC */
  --primary-foreground: 0 0% 100%;
  --secondary: 285 100% 97%;        /* maps to #F5EEFF tint */
  --muted-foreground: 0 0% 43%;     /* maps to #6E6E6E */
  --accent: 286 100% 43%;           /* maps to #AA00DD */
  --ring: 285 100% 40%;
}
```

## BRAND Constant (use in .tsx files)

```tsx
const BRAND = {
  deep:    "#8400B8",
  primary: "#9900CC",
  bg:      "#F5EEFF",
  gray:    "#6E6E6E",
  accent:  "#AA00DD",
} as const
```

## Tier Color System

Used in `BookCard` and `MarketStatsBar` to signal commercial performance. The tier color applies to: left card border, sales panel background, sales number color, Indie badge background.

```tsx
function salesTier(bsr: number, monthly: number): { color: string; bg: string } {
  if (!bsr || bsr > 100000) return { color: "#AA00DD", bg: "#faf5ff" } // accent — unknown
  if (monthly >= 300)        return { color: "#059669", bg: "#f0fdf4" } // emerald — strong
  if (monthly >= 90)         return { color: "#b45309", bg: "#fffbeb" } // amber — moderate
  return                            { color: "#9900CC", bg: "#F5EEFF" } // primary — low
}
```

Note: emerald and amber are **semantic performance colors**, not brand colors. They remain distinct from the palette intentionally — they communicate market signal, not brand identity.

## Section-Level Color Conventions

| Element | Color | Implementation |
|---|---|---|
| Page/section background | `#F5EEFF` | `style={{ background: BRAND.bg }}` |
| Section icon wrapper | `#F5EEFF` | `style={{ background: BRAND.bg }}` |
| Section icon (primary) | `#9900CC` | `style={{ color: BRAND.primary }}` |
| Section icon (deep) | `#8400B8` | `style={{ color: BRAND.deep }}` |
| Primary button bg | `#9900CC` | `style={{ background: BRAND.primary }}` |
| Primary button hover | `#8400B8` | `onMouseEnter` → `BRAND.deep` |
| Progress bar fill | `#9900CC` | `style={{ background: BRAND.primary }}` |
| Progress bar track | `#F5EEFF` | `style={{ background: BRAND.bg }}` |
| Key insight number circles | `#9900CC` | `style={{ background: BRAND.primary }}`, white text |
| Keyword pill border/text | `#9900CC` | inline style |
| Keyword pill hover | `#AA00DD` | `onMouseEnter` → `BRAND.accent` |
| Input focus ring | `#9900CC` | via Shadcn `--ring` variable |
| Switch checked | `#9900CC` | `data-[state=checked]:bg-[#9900CC]` |

## Typography Reference

### Playfair Display — `--font-playfair`

Apply to: section headings (`h1`, `h2`), book titles in cards, verdict text, display numbers.

```tsx
// Tailwind arbitrary value
className="[font-family:var(--font-playfair,Georgia,serif)]"

// Inline style
style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
```

### DM Sans — `--font-dm-sans`

Apply to: all body text, labels, button text, metadata, nav items.

```tsx
// Inline style (preferred for root containers)
style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}

// Tailwind arbitrary value
className="[font-family:var(--font-dm-sans,system-ui,sans-serif)]"
```

### Font Loading Rule

Fonts are loaded **only** in `app/layout.tsx` via `next/font/google`. Never use `<style>@import</style>` in any client component — this causes React hydration errors.

## BookCard Full Structure

```tsx
<div
  className="group flex cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-px"
  style={{ borderLeft: `3px solid ${tier.color}` }}
>
  {/* Cover — 80px wide */}
  <div className="relative w-[80px] flex-shrink-0 bg-slate-50">
    <Image fill ... />
    {/* rank badge: absolute top-left, bg-slate-900/70 */}
  </div>

  {/* Info — flex-col, justify-between */}
  <div className="min-w-0 flex-1 flex flex-col justify-between p-3 pr-2">
    {/* Title row */}
    <div className="flex items-start gap-1.5 mb-1">
      <h3 className="[font-family:var(--font-playfair,...)] line-clamp-2 flex-1 ...">
        {book.title}
      </h3>
      {/* Indie badge — flex-shrink-0, tier color bg, white text */}
      {isIndie && (
        <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white"
          style={{ background: tier.color }}>
          Indie
        </span>
      )}
      <ExternalLink ... />  {/* opacity-0, group-hover:opacity-100 */}
    </div>
    {/* Author line — single truncated line, text-[11px] text-slate-400 */}
    {/* Metrics row — Price, BSR, Rating, Prime */}
  </div>

  {/* Sales Panel — 72px wide, full height */}
  <div className="flex-shrink-0 w-[72px] flex flex-col items-center justify-center gap-0.5 border-l"
    style={{ background: tier.bg, borderColor: tier.color + "30" }}>
    <TrendingUp style={{ color: tier.color + "99" }} />
    <span className="text-[22px] font-black tabular-nums" style={{ color: tier.color }}>
      {salesDisplay}
    </span>
    <span style={{ color: tier.color + "99" }}>/ mo</span>
    <span className="text-[8px] text-slate-400 uppercase tracking-widest">est. sales</span>
  </div>
</div>
```

## Market Intelligence Section Colors

The Market Intelligence section uses **semantic colors** for verdict banners (not brand colors):

| Verdict | Background | Border | Text |
|---|---|---|---|
| Explore | `bg-emerald-50` | `border-emerald-200` | `text-emerald-700` |
| Avoid | `bg-rose-50` | `border-rose-200` | `text-rose-700` |
| Proceed with Caution | `bg-amber-50` | `border-amber-200` | `text-amber-700` |

Market Score ring colors (also semantic):
- `#059669` — score ≥ 8 (Strong Opportunity)
- `#d97706` — score ≥ 6 (Moderate Opportunity)
- `#e11d48` — score < 6 (Highly Competitive)

## Common Violations to Fix

When encountering these patterns, replace with the palette equivalent:

| Found | Replace with |
|---|---|
| `bg-purple-100` | `style={{ background: BRAND.bg }}` |
| `bg-purple-600` | `style={{ background: BRAND.primary }}` |
| `bg-purple-700` | `style={{ background: BRAND.deep }}` |
| `text-purple-600` | `style={{ color: BRAND.primary }}` |
| `text-purple-700` | `style={{ color: BRAND.deep }}` |
| `border-purple-200` | `style={{ borderColor: BRAND.primary + "40" }}` |
| `ring-purple-*` | handled via `--ring` CSS variable |
| `hover:bg-purple-600` | `onMouseEnter` → `BRAND.primary` |
| `hover:bg-purple-800` | `onMouseEnter` → `BRAND.deep` |
| `focus:border-purple-500` | handled via `--primary` CSS variable |

## Shadcn Component Usage

### Button
```tsx
// Primary action
<Button style={{ background: BRAND.primary }} className="text-white"
  onMouseEnter={e => e.currentTarget.style.background = BRAND.deep}
  onMouseLeave={e => e.currentTarget.style.background = BRAND.primary}>
  Analyze Market
</Button>

// Outline variant (Save to Project)
<Button variant="outline" style={{ borderColor: `${BRAND.primary}50`, color: BRAND.primary }}>
  Save to Project
</Button>
```

### Switch
```tsx
<Switch className="data-[state=checked]:bg-[#9900CC]" />
```

### Input (search field)
The search input in BookResearch uses a raw `<input>` (not Shadcn) for custom styling. Focus ring is handled via `globals.css` `--ring` variable which maps to `#9900CC`.
