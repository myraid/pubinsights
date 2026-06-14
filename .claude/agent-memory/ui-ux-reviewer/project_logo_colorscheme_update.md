---
name: Logo and color scheme update (2026-06-14)
description: AuthorOS-Logo.png AO monogram integration; brand palette; logo lockup pattern (mark + wordmark) for all contexts
type: project
---

As of 2026-06-14 the active logo is `/public/images/AuthorOS-Logo.png` — an "AO" monogram on a light lavender background.

## Active palette (globals.css and all BRAND consts)

| Token | Hex | Notes |
|---|---|---|
| `--brand-deep` | `#7000A0` | Headings, wordmark color on light backgrounds |
| `--brand-primary` | `#9900CC` | Primary buttons, active nav |
| `--brand-bg` | `#F5EEFF` | Page/section backgrounds |
| `--brand-gray` | `#6E6E6E` | Body text, muted labels |
| `--brand-accent` | `#BB00EE` | Badges, highlights, hover |

## Logo lockup pattern (CURRENT — replaces old stamp-wrapper pattern)

The AO monogram is a mark, not a self-contained stamp. It must always appear in a **lockup**: mark + "AuthorOS" wordmark in Playfair Display black, same row, vertically centered. Never use the rounded-xl/shadow-md card wrapper — the monogram needs to breathe.

**Nav contexts** (LandingPage nav, Header):
```jsx
<div className="flex items-center gap-2 flex-shrink-0">
  <img src="/images/AuthorOS-Logo.png" alt="AuthorOS" width={36} height={36}
       loading="eager" className="w-auto h-9 block" />
  <span className="text-xl font-black tracking-tight [font-family:var(--font-playfair,Georgia,serif)]"
        style={{ color: "#7000A0" }}>
    AuthorOS
  </span>
</div>
```

**Desktop left panel** (LoginForm purple gradient — wordmark goes white, mark gets slight rounding):
```jsx
<div className="flex items-center gap-3 relative z-10">
  <img src="/images/AuthorOS-Logo.png" alt="AuthorOS" width={56} height={56}
       loading="eager" className="w-auto h-14 block rounded-xl" />
  <span className="text-3xl font-black tracking-tight [font-family:var(--font-playfair,Georgia,serif)]"
        style={{ color: "#FFFFFF" }}>
    AuthorOS
  </span>
</div>
```

**Mobile logo** (LoginForm mobile, `lg:hidden`):
```jsx
<div className="lg:hidden mb-8 flex items-center gap-2">
  <img src="/images/AuthorOS-Logo.png" alt="AuthorOS" width={40} height={40}
       loading="eager" className="w-auto h-10 block rounded-lg" />
  <span className="text-2xl font-black tracking-tight [font-family:var(--font-playfair,Georgia,serif)]"
        style={{ color: "#7000A0" }}>
    AuthorOS
  </span>
</div>
```

## Why:
The AO monogram is a mark-based logo, not a self-contained badge. It needs a wordmark partner to read as a logo in nav contexts. The old "stamp + white card shadow" pattern was designed for the previous square stamp logo (Logo-1.png) which is now retired. The monogram's lavender background is light enough that it sits cleanly on white nav backgrounds without any wrapper.

## How to apply:
Always render as mark + wordmark lockup. Never wrap in rounded-xl shadow-md card. On dark/purple backgrounds, wordmark color flips to white (#FFFFFF). Wordmark always uses `[font-family:var(--font-playfair,Georgia,serif)]` with `font-black tracking-tight`. Keep `loading="eager"` and `alt="AuthorOS"` and eslint-disable comment.
