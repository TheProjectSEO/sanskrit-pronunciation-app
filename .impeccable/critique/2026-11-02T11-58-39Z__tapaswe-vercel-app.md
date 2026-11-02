---
target: tapaswe.vercel.app (home, signin, signup, practice)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "url:https://tapaswe.vercel.app/"
timestamp: 2026-11-02T11-58-39Z
slug: tapaswe-vercel-app
---
## 6. UX critique (Impeccable `critique`, dual-agent, 2 Nov 2026)

Design health: **17/40, Poor.** Live review at 390x844 and 1440x900 plus source. Screenshots in the
session scratchpad (`critique/a-*.png`). QA account created on the live site:
qa-design-review@theprojectseo.com (role user; password in the session transcript, rotate or delete
before launch).

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | Analyzing = bare spinner, no "we heard you", no duration |
| 2 | Match real world | 2 | "XP", "0.75x", "substitution/omission" taxonomy shown to a 55-year-old devotee |
| 3 | User control | 1 | Any error wipes the whole practice screen (`setError` shares state with the fatal branch, lines 596/657/707) |
| 4 | Consistency | 1 | Home uses brand tokens; signin/signup/practice use Tailwind orange + purple-600, emoji glyphs, second logo |
| 5 | Error prevention | 2 | Record starts on one tap, no mic priming, no max duration |
| 6 | Recognition | 2 | Speed chips need playback-rate maths; language select floats between cards |
| 7 | Flexibility | 3 | Tap-any-word, verse chips, 5 languages are real |
| 8 | Minimalist | 1 | Six blocks before the mic; Pro Tips on every visit; orange Back pill is the loudest element |
| 9 | Error recovery | 1 | "Microphone access denied" replaces the page, no Android steps, no retry |
| 10 | Help | 2 | Generic English tips, no first-run |

Deterministic scan: 7 findings (4 real after false positives): purple gradients on the player card
and Try Again button (`practice/[id]/page.tsx:825, 1350`), gray-on-tint in instructor pages.
Mechanical: 0 `aria-label`, 0 `role`, 0 `next/font`, no Devanagari face declared, `<html lang="en">`,
0 `focus-visible`, 0 reduced-motion handling, 10 icon-only buttons with no accessible name, speed
chips ~16-26 px tall, per-word speaker buttons 20 px.

### Priority issues
1. **P0 Errors destroy the practice screen.** Split `fatalError` from `inlineError`; render inline errors inside the Record card with Android mic-permission steps and Retry.
2. **P0 Score shown as a verdict.** `{score}%` in red/yellow/green with no confidence. With the new confidence gate (section 2), lead with the guru sentence, show a band (close / getting there / needs practice), one line "based on what we heard", and play the user's own clip beside the instructor's so they can judge.
3. **P1 Transport controls look broken.** Emoji ⏪ ▶️ ⏩ render as platform glyphs, play collapses to 20x64, chips overflow the card. Heroicons at 48 px min; speed becomes a Slow / Normal / Fast segmented control on its own row.
4. **P1 Two visual systems.** One token set in `globals.css`; replace `bg-orange-*`, `purple-600`, gradients with `brand-*`; one logo lockup; shared header.
5. **P2 Hierarchy.** Chevron-only back; Devanagari 32-36 px in a Devanagari face as hero; Roman secondary; tips behind a disclosure.
6. **P2 Placeholder data.** Remove 4.8 stars and "5 min"; derive duration; hide streak until real; name categories.

### Persona failures
- Jordan (55, Android, first time): "Click to Start Recording" on touch; 0.75x; XP; mic-denied kills page; no idea what the percentage means.
- Casey (one-handed): chips 16-26 px, skips 40 px, select 33 px; Try Again under five stacked blocks; three dead nav tabs.
- Sam (screen reader, 200% zoom): lang="en" on Devanagari/Tamil; emoji-named buttons; clickable spans; colour-only word status; score colours 1.85:1 and 2.12:1.

### Contrast failures (computed)
pink #EF5DA8 on #FFECEC 2.71:1; pink on white 3.09:1; orange-600 Devanagari on orange-50 3.39:1;
white on orange-500 2.89:1; yellow score 1.85:1; green score 2.12:1; gray-400 hint 2.45:1.
