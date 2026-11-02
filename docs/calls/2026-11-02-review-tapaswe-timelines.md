# Call: Review Tapaswe Timelines (2 Nov 2026)

- **Source:** Fireflies `01M6DMPK1BKER12M33FHMV76EB`, 49 min. Raw transcript: `2026-11-02-review-tapaswe-timelines.json`.
- **On the call:** Aditya, Chakshoo, Anusha. From now on Anusha joins every call and tests daily.
- **Tapaswe part:** 14:16 to 29:08. The rest of the call covered the Quarterfox / accounting site and the Karungali e-commerce work.

## Launch scope, in priority order

| # | Feature | What was said | Status on `feat/trust-pipeline-prayer-book` |
|---|---|---|---|
| 1 | **Pronunciation accuracy** | "This app doesn't exist without it; then the app becomes unusable." (Chakshoo, 28:32) | v2 pipeline built. 0 false errors on correct clips, about 0.5 word recall on the provisional eval. Needs real labelled learner clips. |
| 2 | **Big mantra library** | "We just need a big library, which obviously is admin dependent." (25:19) | The instructor upload flow exists. Content is the bottleneck, not code. |
| 3 | **UGC: users record and share their own mantras** | Traditions have non-generic mantras. A user records one so friends and relatives can practise it from that recording. (25:50) | Not built. The v2 pipeline already judges against the *teacher's* recording, so a user's recording can act as the reference with no text. |
| 4 | **Repetition counting (optional)** | Counting towards 108. The count shows total recitations and how many were correct vs incorrect. Connects to the ring / hardware idea. (26:51) | Not built. Aditya called it "a completely new feature, optional". |
| 5 | *(open)* Likely candidate: **accuracy progress chart** | "Over the course of repetitions, how your accuracy improved… a chart or a graph", for example 50% at first and 70% later. (27:30) | Not built. `pronunciation_logs` already stores every attempt, so the data exists. |

## Timeline

- Core work to be done by **end of November**. Aditya travels from the 16th, and Chakshoo is at the ashram from the 11th to the 16th.
- **December:** iOS and Play Store deployment and debugging. iOS review is slow; Play Store is quick.
- Ship a **V0, then iterate V1/V2/V3**. Don't chase perfection before launch.
- Work in a **daily feedback loop**: Anusha tests, and small fixes ship the same day.

## Action items (Tapaswe)

- **Chakshoo:**
  - Renew the ElevenLabs subscription and tell Aditya.
  - Send the gamification concept. This is secondary and comes after the core features.
  - Ask Karun whether he can handle the iOS / App Store deployment. If not, find someone else.
- **Anusha:** test the app daily and send feedback. She may also share the Sadhguru app walkthrough, which has feedback in multiple languages.
- **Aditya:**
  - Send a Tapaswe update tonight. The local changes are not pushed yet.
  - Research how the established pronunciation apps do it (reverse-engineer).
  - Test ElevenLabs against OpenAI for Hindi and Sanskrit voice.

## Other decisions

- OpenAI now runs on Aditya's own key. ElevenLabs is to be re-tested before choosing a voice.
- The ElevenLabs test is the "mouth" side only, meaning the teacher voice and guru line. Scoring stays on the OpenAI ears (see the plan doc).
