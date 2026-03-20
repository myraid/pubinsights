---
name: ui-designer
description: This skill should be used when the user asks to "apply the brand palette", "style a component", "make the UI consistent", "update colors", "fix typography", "design a card", "apply design system", "make it on-brand", "update the visual design", or needs any UI styling work done in the PubInsights Next.js/Shadcn/TypeScript codebase. Provides the official color palette, typography conventions, component rules, and implementation patterns for the PubInsights design system.
version: 0.1.0
---

# PubInsights UI Design System

## Fork to Subagent

**Always delegate implementation to a subagent.** When this skill is invoked:

1. Identify the target component(s) and the user's design request from context.
2. Launch an Agent with `subagent_type: "ui-ux-reviewer"` to perform the implementation.
3. Pass a detailed prompt that includes:
   - The exact files to read and modify
   - The user's design goal verbatim
   - The full brand palette, typography, and component rules from this skill
   - Any constraints or patterns from `references/design-system.md`
4. Wait for the subagent to return, then summarize the changes made to the user.

Do **not** implement UI changes directly in the main conversation — always fork first.

---

Implement UI for the PubInsights project — a book market research tool built on Next.js, Shadcn UI, and TypeScript. Apply the official brand palette, typography, and component conventions precisely.

## Brand Palette (non-negotiable)

| Token | Hex | Usage |
|---|---|---|
| `--brand-deep` | `#8400B8` | Dark headings, pressed states, hover darken |
| `--brand-primary` | `#9900CC` | Buttons, active nav, key UI actions, progress |
| `--brand-bg` | `#F5EEFF` | Page background, section wrappers, tinted fills |
| `--brand-gray` | `#6E6E6E` | Body text, secondary labels, muted content |
| `--brand-accent` | `#AA00DD` | Badges, hover highlights, callout accents |

These CSS variables are declared in `app/globals.css`. Reference them in code via the `BRAND` constant already defined in `BookResearch.tsx`, or via inline `style` props:

```tsx
// Preferred — use the BRAND constant where it exists
style={{ background: BRAND.primary }}

// Or reference CSS variables directly
style={{ color: "var(--brand-primary)" }}
```

**Never** approximate with Tailwind's built-in purple scale (`purple-600`, `purple-700`). Always use the exact hex or CSS variable.

## Typography

- **Display / Headings**: `[font-family:var(--font-playfair,Georgia,serif)]` — Playfair Display, 700/900. Use for section titles, book titles, h1–h3.
- **Body / UI**: `style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}` — DM Sans, 300–600. Use for all labels, buttons, metadata, body text.
- **Never** use `@import` inside client components — fonts load only at layout level (`app/layout.tsx`).
- **Never** use raw `font-sans`, `font-serif`, or Tailwind font utilities without the CSS variable wrapper.

## Component Library

- **Shadcn** (`components/ui/`) — exclusive source for Button, Card, Input, Badge, Dialog, Select, Textarea, Label, Switch, DropdownMenu.
- **Tremor** — phased out. Replace any Tremor Button/TextInput found. Tremor chart components are acceptable.
- **Notifications**: `toast()` from Sonner only. Never `alert()` or `window.confirm()`.
- **Charts**: `dynamic(() => import('react-plotly.js'), { ssr: false })` always.

## Card Design Pattern (BookCard)

The `BookCard` component uses a three-column layout with a unified tier-color language:

```
[Cover 80px] | [Info: title + author + metrics] | [Sales Panel 72px]
```

**Tier color system** — the single color governs left border, sales panel bg, number color, and Indie badge:

| Tier | Color | Bg | Condition |
|---|---|---|---|
| Strong | `#059669` | `#f0fdf4` | ≥ 300/mo |
| Moderate | `#b45309` | `#fffbeb` | 90–299/mo |
| Low | `#9900CC` | `#F5EEFF` | < 90/mo |
| Unknown | `#AA00DD` | `#faf5ff` | BSR > 100k |

**Indie badge**: always `flex-shrink-0`, pinned in the title row (not the author row). Background = tier color, white text.

**Book title**: Playfair Display via `[font-family:var(--font-playfair,Georgia,serif)]`.

**Sales panel**: full-height right column (`w-[72px]`), `border-l` with tier color at 30% opacity, tier-tinted background.

## Implementation Checklist

When applying the design system to a component:

1. **Read the component first** — understand existing structure before modifying.
2. **Declare `BRAND` constant** at the top of the file if not already present:
   ```tsx
   const BRAND = {
     deep:    "#8400B8",
     primary: "#9900CC",
     bg:      "#F5EEFF",
     gray:    "#6E6E6E",
     accent:  "#AA00DD",
   } as const
   ```
3. **Replace all `purple-600`/`purple-700` Tailwind utilities** with inline style props using `BRAND.primary` / `BRAND.deep`.
4. **Set section backgrounds** to `BRAND.bg` (`#F5EEFF`).
5. **Update buttons**: primary button background = `BRAND.primary`, hover = `BRAND.deep`.
6. **Update icon wrappers**: `style={{ background: BRAND.bg }}` instead of `bg-purple-100`.
7. **Update pills/badges**: border and text = `BRAND.primary`; hover fill = `BRAND.accent`.
8. **Apply Playfair** to any heading or display text not yet using it.
9. **Verify Indie badge** is `flex-shrink-0` in the title row.

## Additional Resources

### Reference Files

For complete detail on all design tokens, tier color implementation, and advanced patterns:

- **`references/design-system.md`** — Full palette spec, Shadcn token mapping, tier color implementation, section-level conventions, and known color violations to fix.
