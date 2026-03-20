---
name: Market Intelligence panel redesign
description: Layout decisions and styling rules for the BookResearch Market Intelligence card (2026-03-20)
type: project
---

The Market Intelligence block in `components/sections/BookResearch.tsx` was redesigned as a 4-row premium analytics layout.

**Row 1 — Score + Verdict side by side** (`grid-cols-1 md:grid-cols-3`): `MarketScore` takes `md:col-span-1`; the verdict panel takes `md:col-span-2`. Verdict panel background is semantic (emerald/rose/amber-50) matching verdict type. Verdict text uses Playfair italic, size `text-3xl font-black`. Falls back to `bg-slate-50` border while loading.

**Row 2 — Key Findings**: `grid grid-cols-1 md:grid-cols-2 gap-2`. Each insight is a `rounded-lg border border-slate-100 bg-white px-4 py-3` card with `borderLeft: 2px solid BRAND.primary`. No numbered badges.

**Row 3 — Opportunities + Challenges**: `grid-cols-1 sm:grid-cols-2`. Both are `rounded-xl border border-slate-100 bg-white p-5` with `borderLeft: 4px solid #34d399` (emerald) and `4px solid #fb7185` (rose) respectively. Items use a `h-1.5 w-1.5 rounded-full` dot bullet, no icons.

**Row 4 — Keywords + Title**: `grid-cols-1 md:grid-cols-2 gap-5`. Both panels are `rounded-2xl border border-slate-100 bg-white p-5`. Conditional — only renders if loading OR data is present.

**MarketScore gauge**: Resized to `h-20 w-20` SVG viewBox `0 0 80 80`, `cx/cy=40`, `r=32`, `strokeWidth=7`. Circumference = `2 * Math.PI * 32`. Score display is `text-2xl`.

**Section label style**: `text-[10px] font-bold uppercase tracking-[0.15em]` throughout (previously was `tracking-widest` — changed to explicit `0.15em`).

**Dividers between rows**: `border-t border-slate-100 pt-5 mt-1` — no `space-y` wrapper on the outer container.

**Skeleton states**: Each row has a matching skeleton shape that mirrors the loaded state's grid layout.

**Removed icons**: `CheckCircle2`, `XCircle`, `ThumbsUp`, `ThumbsDown`, `Lightbulb` — removed from imports since the redesign replaces them with dot bullets and `border-l` accents.

**Why:** User requested Bloomberg Terminal / modern fintech aesthetic — data-forward, editorial, no heavy colored backgrounds except the score/verdict semantic tints.

**How to apply:** Any future changes to the Market Intelligence block should maintain these four row sections and their whitespace hierarchy. Keep `border-l` accents as the primary visual differentiator rather than colored backgrounds.
