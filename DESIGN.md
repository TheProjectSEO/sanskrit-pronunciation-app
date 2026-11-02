# Design

The Tapaswe "pothi" world, built 2 Nov 2026. Source: Gita Press booklets and palm-leaf
manuscripts. Devotional, printed, quiet. Tokens live in `app/globals.css`; never hard-code a colour.

## Colour (roles, light / dark)
| Token | Light | Use |
|---|---|---|
| `paper` | #f5e6b3 | page ground (turmeric-washed paper, not cream) |
| `paper-deep` | #ecd58f | pressed states, secondary buttons, segmented track |
| `paper-edge` | #d9bc6a | double rules, hairlines, borders |
| `ink` | #2b1a10 | text, Devanagari |
| `ink-soft` | #5b3d27 | secondary text, transliteration (7:1 on paper) |
| `sindoor` | #a3221a | rubric only: verse numbers, current step, corrections, errors |
| `sindoor-wash` | #f2cfae | errata slip and error ground |
| `cloth` / `cloth-ink` | #5c1a12 / #f8ecc4 | madder book-cloth: header band, primary actions |
| `marigold` | #e8a21a | live recording ring only |
| `leaf` | #2f5a2a | blessing mark for a clean recitation |
| `focus` | #1f4fa3 | keyboard focus, deliberately not a rubric colour |
Dark mode redefines the same roles (night page: #1d1410 ground, #f3e3b6 ink).
Never red/yellow/green traffic lights for scores. Status is shown with rubric marks.

## Type
- Mantra and transliteration: Tiro Devanagari Sanskrit (`font-mantra`). Built for Sanskrit
  conjuncts and Vedic marks. Devanagari 2.1-2.5rem on the folio; IAST italic beneath.
- Interface: Mukta (Latin + Devanagari), with Noto Sans Tamil / Kannada / Telugu for those
  feedback languages (`font-ui`). Body 1.05-1.2rem; older users first.
- Set `lang` on every block: `sa` for mantra, `sa-Latn` for IAST, the feedback language for UI copy.

## Components
- **Folio**: mantra between double rules (`border-double`, 3px, paper-edge). Each word is a
  button (min 48px). When Devanagari and IAST word counts differ (sandhi), the IAST line carries
  taps and marks. Verse number in sindoor between dandas: ॥१॥.
- **Corrections**: `check` = dotted sindoor underline; `wrong` = solid sindoor underline. The
  single focus correction is an **errata slip**: sindoor-wash ground, soft offset shadow, enters
  with one 450ms ease-out tilt-and-settle (the page's one authored motion).
- **Step rail**: सुनें · दोहराएँ · गुरु की बात. Current step in sindoor, done steps get a leaf check.
- **Thumb bar**: fixed bottom, one primary cloth button for the current step (56px), one square
  secondary. Respects safe-area insets.
- **Segmented control**: speed as words (बहुत धीमा / धीमा / सामान्य), never "0.75x".
- **Errors**: inline, inside the step they belong to, with recovery steps and a Retry. Only a
  failed mantra load replaces the page.

## Rules
- One primary action visible per step. No XP, points, stars, streak badges or invented stats.
- Icons from Heroicons only; no emoji as UI.
- Touch targets ≥ 48px (44px absolute floor); WCAG 2.2 AA contrast; visible `:focus-visible`.
- Reduced motion collapses all animation.
- Instructor pages (`/instructor/*`) have not been migrated yet and still use the old orange theme.
