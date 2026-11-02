# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web / installable PWA first, for testing and the 14 Jan 2027 launch. Later the same product
ships as a Play Store app, an iOS app and a website. Design for a phone in one hand first; nothing
may depend on desktop-only affordances.

## Users
- Devotees learning to chant Sanskrit mantras correctly, two groups (confirmed: "mixed, both"):
  - Older devotees, roughly 40-65, Android-first, new to Sanskrit, chanting as part of daily puja.
  - Younger working adults and parents, roughly 25-40, who want to chant correctly and teach children.
  Design for the older group; give the younger group shortcuts that do not burden the older one.
- Languages: Hindi plus Tamil, Kannada, Telugu, Malayalam and English speakers. Feedback is given in
  the learner's chosen language; the mantra is always shown in Devanagari.
- Instructor role: uploads mantras, records reference audio, defines verses.

## Product Purpose
Help a learner pronounce a mantra the way their teacher does: listen to the teacher, repeat, and get
one clear correction at a time. Success is a learner who trusts the feedback and comes back daily.

## Positioning
The reference is a real teacher's voice, not synthetic speech or textbook spelling. Feedback compares
the learner with that recording, and the app says "say it again" rather than guess when unsure.

## Operating Context
- Used at home, often during or before daily puja, sometimes with background noise.
- Part of the Tapaswe brand, which sells malas, rudraksha and devotional products at tapaswe.com
  (strong Tamil/Kannada/Malayalam readership). A japa ring (hardware) is planned; the app will
  record japa counts per mantra per day so the ring can sync later.

## Capabilities and Constraints
- Today: mantra library by deity and category, practice page (listen at speeds, record, feedback in
  5 languages, tap any word to hear the teacher), per-verse practice, single-word drill, instructor tools.
- Feedback pipeline (Nov 2026): two independent "ears" (literal transcription and an audio-listening
  judge) must agree before an error is shown; low confidence returns a "say it again" state instead
  of a score. See docs/VOICE_AND_UX_PLAN_2026-11-02.md.
- Planned before launch: guided onboarding, japa counter, streaks, offline audio, live guru mode.
- Open: subscription model; launch Jan 14 solo or ~Dec 20 with external help.

## Brand Commitments
- Name: Tapaswe (तपस्वे). Owner: Chakshu Om.
- Reference recordings are made by Chakshu. How to present the voice (named, or "the teacher") is
  undecided; until decided, refer to "the teacher" / "गुरुजी" and do not show a name.
- Decided 2 Nov 2026: devotional, prayer-book character; no XP, points or gamified streak badges.

## Evidence on Hand
- 13 published mantras with reference audio (Supabase storage `audio/mantras/*`).
- No testimonials, ratings, user counts or reviews exist. Do not show star ratings or fake counts.

## Product Principles
1. The teacher's voice is the truth. Never let synthetic audio stand in for it.
2. Never tell a learner they made a mistake we are not sure of.
3. One correction at a time, in the learner's own language.
4. Devotion before gamification.
5. Every step works one-handed on a mid-range Android phone.

## Accessibility & Inclusion
- Older users: large type, 48 px touch targets, high contrast, plain words, no time pressure.
- Multiscript: correct `lang` on Devanagari, Tamil, Kannada, Telugu text; fonts that render each script.
- WCAG 2.2 AA as the floor.
