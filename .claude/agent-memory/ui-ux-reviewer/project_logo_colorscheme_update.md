---
name: Logo and color scheme update (2026-03-28)
description: New square Logo-1.png introduced; brand palette updated to match; logo usage patterns established for all contexts
type: project
---

On 2026-03-28 the brand palette was updated to match the new square logo (`/public/images/Logo-1.png` — vivid purple `#9900CC` background with white neural lightbulb icon and "Publisher Insights" stacked text).

## Updated palette (globals.css and all BRAND consts)

| Token | Hex | Notes |
|---|---|---|
| `--brand-deep` | `#7000A0` | Deeper than before (was `#8400B8`), used for hover/dark states and headings |
| `--brand-primary` | `#9900CC` | Unchanged — exact logo purple |
| `--brand-bg` | `#F5EEFF` | Unchanged |
| `--brand-gray` | `#6E6E6E` | Unchanged |
| `--brand-accent` | `#BB00EE` | Brighter than before (was `#AA00DD`), used for badges/highlights |

The Shadcn `--accent` HSL token was also updated to match `#BB00EE` (288 100% 47%).

## Logo usage patterns

**Light/white backgrounds** (Header nav, LandingPage nav):
- `src="/images/Logo-1.png"`, `width={240} height={240}`
- Wrapped in `<div className="rounded-xl overflow-hidden shadow-md flex-shrink-0">` — creates a square stamp with rounded corners and subtle shadow
- `className="w-auto h-10 md:h-12 block"` — no filter

**Dark purple gradient panel** (LoginForm left panel):
- Wrapped in `<div className="bg-white rounded-2xl p-3 inline-block shadow-lg relative z-10">` — white card containing the logo; looks premium against the purple gradient
- `className="w-auto h-24 block"` — larger size on brand panel, NO `brightness-0 invert`

**Mobile logo** (LoginForm right panel, mobile only):
- Same `rounded-xl overflow-hidden shadow-md inline-block` wrapper as nav
- `className="w-auto h-16 block"`

## Why:
The old logo was wide/rectangular; the new logo is square (stamp format). The stamp wrapper pattern (rounded corners + shadow) makes the square feel intentional and polished. The white card on the dark panel prevents color clash between the logo's purple background and the panel gradient.

## How to apply:
Always use the wrapper div pattern — never render the logo bare. Never apply `brightness-0 invert` to Logo-1.png since it already has its own branded purple background.
