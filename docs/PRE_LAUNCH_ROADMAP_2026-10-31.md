# Tapaswe App: Launch Roadmap (2026-10-31)

Answers Chakshu's ask from the Oct 28 call: "what is remaining, what is needed to make it go live,
and by when, so I can plan the ring accordingly." Also folds in the Oct 15 decision to redeploy and
test the app and his note that recording accuracy was only 80 to 85 percent.

## Where we are

- Code: commit `11e560d` (Oct 17), identical on both GitHub repos. Cloned to
  `/Volumes/Adi SSD/tapaswe-app` with env vars pulled from Vercel.
- Live: https://tapaswe.vercel.app serves that commit from Chakshu's Vercel account. Our own
  `tapaswe-app` Vercel project is paused and stale.
- Stack: Next.js 15, NextAuth v5, Supabase, OpenAI `whisper-1` + `gpt-4o`, ElevenLabs TTS.
- Never built in CI since Oct 17. Needs a local `npm run build` before anything else.

## What changed in the model landscape

1. `whisper-1` and `gpt-4o-transcribe` are deprecated, shutdown Feb 26, 2027. Replacement is
   `gpt-transcribe` (file) and `gpt-live-transcribe` (streaming).
   https://developers.openai.com/api/docs/guides/speech-to-text
2. `gpt-realtime-2.1` is the current speech-to-speech model: browser WebRTC, barge-in, tool calls.
   Reported price about $32 per 1M audio input tokens and $64 per 1M output.
   https://developers.openai.com/api/docs/guides/realtime
3. OpenAI shipped GPT-Live-1.1 in ChatGPT in mid-October with two Hindi-tuned voices, Neer and
   Leher, trained for Hindi-English code-mixing. API access is "coming soon", no date given.
   https://cio.eletsonline.com/artificial-intelligence/openai-chatgpt-hindi-voices-neer-leher-festive-campaign-the-notice-india/76472/
4. Voice agent architectures: GPT-Live full duplex, Realtime speech-to-speech, or chained
   STT -> agent -> TTS. The chained path keeps transcripts and lets us score before speaking, which
   suits pronunciation coaching. https://developers.openai.com/api/docs/guides/voice-agents

## Fixing the 80 to 85 percent accuracy problem

This is the single most important pre-launch item. Causes and fixes:

- Transcription has no idea what the student is trying to say. Pass the expected mantra text as
  the transcription prompt and set `languages` to Sanskrit and Hindi. This alone usually moves
  accuracy on known text by a large margin.
- Scoring is text-level. Move to akshara (syllable) level: align the student's audio to the
  instructor's reference word audio we already cache, and score vowel length, aspirates and
  retroflex consonants separately. Those are where novices actually fail.
- No confidence gate. When the model is unsure, say "try that line once more" instead of
  inventing a correction. Wrong corrections destroy trust faster than slow ones.
- No noise handling. Trim silence, normalise levels, reject clips with too much background noise
  before analysis.
- Measure it. Build a set of 30 to 50 clips labelled by an instructor as good, partial, wrong, and
  track agreement before and after every model change. Run `gpt-transcribe` against Sarvam and
  ElevenLabs Scribe on the same set, since both claim better Indic accuracy.

## Timeline to launch (8 weeks)

| Week | Dates | Work | Owner |
|------|-------|------|-------|
| 0 | Nov 3 to 9 | Pick one Vercel account and one repo, delete the stale project, build `11e560d`, fix anything broken, Chakshu test round on the live site | Aditya, Chakshu |
| 1 to 2 | Nov 10 to 23 | Model migration: `gpt-transcribe` with prompt bias, GPT-5-class feedback model, syllable scoring, confidence gate, noise filter. Evaluation set labelled | Aditya; instructor labels |
| 3 to 4 | Nov 24 to Dec 7 | Novice loop: 7-day onboarding path (Om, Gayatri line by line, one short stotra), listen-repeat at 3 speeds, loop one word or verse, 108-bead japa counter, streaks, spaced repetition of weak words, offline audio (PWA) | Aditya, Arun on UX |
| 5 to 6 | Dec 8 to 21 | Live guru mode prototype on `gpt-realtime-2.1`: model chants a line, listens, gives a two-sentence correction in the user's language. Hindi voice via Neer or Leher if the API opens, ElevenLabs otherwise. Cost cap per user per day | Aditya |
| 7 | Dec 22 to 31 | Closed beta with 30 to 50 users from the Tapaswe customer list and WhatsApp group. Analytics: sessions per week, words mastered, onboarding drop-off | Chakshu runs beta |
| 8 | Jan 1 to 13 | Fix list from beta, store listing copy, launch content | All |
| Launch | Jan 14, 2027 (Makar Sankranti) | Public launch, bundled with malas and japa counter on the store | |

If external developer help is accepted (Nilesh), weeks 3 to 4 and 5 to 6 can run in parallel and
launch moves to about Dec 20.

## After launch (Q1 2027), aligned to the ring

- Chant counter API: the app records japa counts per mantra per day, so the ring can sync to it.
  Design the schema now so hardware does not force a rewrite.
- Community: shared streaks and a weekly sankalp, Strava-style.
- Wellness correlation view: sleep and stress data from the ring against chanting minutes, once
  hardware exists.
- Subscription decision after beta data: one-time vs monthly, or hardware plus free app.

## Everything else that improves the app for a novice

- Better feedback: one correction per attempt, in the student's language, always with the
  instructor's audio of the right sound, never a wall of text.
- Meaning cards per word, since understanding improves retention.
- Instructor-side: bulk upload of mantras with auto word splitting (exists), review queue for
  model corrections that students flagged as wrong.
- Trust and ops: Supabase RLS review on new tables, rate limits, daily cost guard, key rotation
  for the keys that sat in old iCloud env files.

## Decisions needed from Chakshu

1. Canonical Vercel account and GitHub repo.
2. Launch date: Jan 14 solo, or Dec 20 with Nilesh.
3. Live guru mode at launch, or post-launch premium.
4. Who labels the 30 to 50 evaluation clips.
