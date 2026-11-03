# Tapaswe design system

The original Tapaswe look, kept and made consistent: white pages, deep purple and lotus pink, soft tinted cards. The prayer-book ("pothi") redesign of 2 Nov 2026 was rolled back on 3 Nov 2026 at the owner's request. Its token names still resolve to the brand colours (see `app/globals.css`) so old classes cannot render off-brand.

## Colour roles (`app/globals.css` → Tailwind classes)

| Role | Token / class | Value | Use |
|---|---|---|---|
| Primary | `brand-purple` (`-hover`) | #2E2871 | headings, primary buttons, selected state, admin badge |
| Accent | `brand-pink` (`-hover`) | #EF5DA8 | the one call to action per screen, active tab, recording |
| Gold | `brand-gold` | #F0B100 | stars and streaks only |
| Cards | `card-purple`, `card-pink`, `card-blue` (+ `-light`) | tints | grouped content, mantra cards (alternate purple/pink) |
| Text | `text-primary`, `text-secondary`, `icon-inactive` | #1E1B4B, #6A7282, #8B97A8 | body, secondary, inactive icons |
| Lines | `line`, `line-strong` | #ECEAF5, #D9D5EE | dividers, input borders |
| Semantic | `success`, `warning`, `danger` (+ `-bg`) | green / amber / orange-red | word marks (ok / unsure / wrong), status badges, alerts |

Rules: no orange or grey-only accents anywhere (the old admin orange was mapped onto the brand). Pink and purple never carry error meaning; errors use `danger`.

## Type
System UI font for the interface (as the original app). `font-mantra` (Tiro Devanagari Sanskrit) only for mantra text, Devanagari and IAST.

## Structure
- User: `components/shell/AppShell.tsx`. Header with तपस्वे Tapaswe; desktop top links, phone bottom tabs (Home, Mantras, Record, Profile). Admin pill only for admins.
- Admin: `app/instructor/layout.tsx`. Same colours, side menu on desktop, scrolling tabs on phones. Team is shown only to super admins.
- Interface language: English / हिन्दी (`lib/i18n`), chosen in Profile; guru feedback language is separate (5 languages).
