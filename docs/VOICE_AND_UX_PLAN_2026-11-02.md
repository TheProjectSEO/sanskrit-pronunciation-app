# Tapaswe: Voice Stack Rebuild + UX Fix Plan (2026-11-02)

Written for implementation by an Opus 5.5 session. Every model ID and price below was verified
against vendor docs on 2 Nov 2026 (sources at the end). Items marked UNVERIFIED need a live API
call before you depend on them.

## 0. What the app does today (commit 11e560d, Oct 17)

| Stage | Today | Problem |
|---|---|---|
| Capture | `MediaRecorder` webm/opus, mp4 fallback | Fine. No trim, no level normalisation, no noise check |
| Speech-to-text | `whisper-1`, generic prompt, no language | Deprecated, shuts down 26 Feb 2027. Never told which mantra is expected, so it guesses Sanskrit cold |
| Hallucination guard | hardcoded string list ("Thank you", "Subscribe") | Not a real silence/noise detector |
| Scoring | `gpt-4o` compares reference text vs transcript, returns 0-100 | Model never hears the audio. Vowel length, aspiration, retroflex/dental errors vanish in the transcript. No confidence gate, so a mishearing becomes a confident wrong correction |
| Feedback voice | ElevenLabs `eleven_multilingual_v2`, default "Adam" (English male) reading Hindi | Wrong voice for the audience |
| Reference audio | Instructor's own recording, word-sliced via whisper timestamps | Good. Keep |

Root cause of the 80-85% complaint: the pipeline is transcript-only. Nothing in it ever listens.

## 1. Model landscape, Nov 2026 (verified)

### OpenAI
| Model | Use | Notes | Price |
|---|---|---|---|
| `gpt-transcribe` | file STT | `prompt`, `keywords[]`, `languages[]`. No timestamps, no logprobs. Hindi `hi` ok; `sa` acceptance UNVERIFIED | $0.0045/min |
| `gpt-live-transcribe` | streaming STT | same params, no confidence | $0.017/min |
| `gpt-audio-1.5` | audio in, text out (Chat Completions only) | The only OpenAI model that hears the clip and returns structured text | $32/1M audio-in tokens, ~$0.06/min (UNVERIFIED tokens/min) |
| `gpt-realtime-2.1`, `-mini` | speech-to-speech, also the TTS migration target | voices English-optimised, no Hindi voice | mini: $10 in / $20 out per 1M audio tokens |
| `gpt-live-1` | full-duplex live voice, delegates reasoning to a backend | has `nira`, a Hindi feminine voice, in the API since 16 Oct 2026; prompt-to-voice lets us describe a custom Hindi guru voice; paraphrases backend text, cannot speak verbatim | $0.05/min + backend |
| Neer, Leher | ChatGPT only | "coming soon to the API", no date, no model page | n/a |
| `whisper-1`, `gpt-4o-transcribe*` | legacy | only models with word timestamps/logprobs; dead 26 Feb 2027 | |
| `gpt-4o-mini-tts`, `tts-1*` | legacy TTS | whole `/v1/audio/speech` line dies 6 Jan 2027 | |
| `gpt-5.5`, `gpt-6-astra` | text reasoning | text + image only, no audio input | $5/$30, $10/$50 |

### Google
| Model | Use | Notes | Price |
|---|---|---|---|
| `gemini-3.8-flash` | audio in, text out | 32 tokens/sec of audio, timestamps by MM:SS; pronunciation critique UNVERIFIED | $0.75/1M in, ~$0.0014/min of audio |
| `gemini-3.8-live` | live speech-to-speech | 99 languages incl. hi/ta/te/kn/ml, `custom_vocabulary` ≤1000 terms | $3 in / $12 out per 1M audio tokens |
| `gemini-3.8-flash-tts` | TTS | style control via prompt, two-speaker, all five languages | $0.50 in / $9 out per 1M (doubles 1 Jan 2027) |
| Cloud TTS Chirp 3 HD | TTS | IPA/X-SAMPA custom pronunciation for hi, ta, te, kn, ml; pace 0.25-2.0 | $30/1M chars |
| Cloud STT `chirp_3` | STT | hi-IN GA, others preview, Sanskrit not listed, "confidence" disclaimed | ~$0.016/min |

### Indic and pronunciation-specific
| Model | Use | Notes | Price |
|---|---|---|---|
| Sarvam `saaras:v4` | STT | the only hosted STT that lists Sanskrit (`sa-IN`); keyterm prompting ≤50; chunk timestamps only | ₹0.49/min |
| Sarvam Bulbul v3 | TTS | 11 Indic languages, Indic-accent | ₹3/1k chars |
| Azure Speech pronunciation assessment | phoneme scores | hi-IN and ta-IN supported (scripted mode), phoneme + word + full-text accuracy, IPA; te/kn/ml absent; prosody en-US only | billed as STT, ~$1/hr |
| AI4Bharat IndicConformer Sanskrit (`indicconformer_stt_sa_hybrid_ctc_rnnt_large`) | self-hosted CTC ASR | Sanskrit acoustic model with a CTC head, MIT, gated HF | self-host |
| Vakyansh `sam_60` | self-hosted wav2vec2 | 60 h Sanskrit, CTC | self-host |
| torchaudio `MMS_FA` | forced alignment | 1,100 languages via romanisation; deprecated in torchaudio 2.8, pin ≤2.8 | free |
| ElevenLabs Scribe v2 | STT | all five languages, word timestamps, no Sanskrit, no confidence | $0.22/hr |

Nobody sells Sanskrit phoneme scoring. That has to be assembled.

## 2. Target architecture: "three ears, one mouth"

Chained pipeline (the voice-agents guide positions chained for exactly this: inspect text between
stages, keep transcripts, run checks before speaking). Three independent judges vote; a text model
turns the verdict into one guru sentence; a Hindi-capable voice speaks it.

```
mic ──► preprocess ──┬─► Ear 1  gpt-transcribe      (what words were said)        ~$0.0045/min
 (trim, normalise,   ├─► Ear 2  gpt-audio-1.5        (hears the clip + expected    ~$0.06/min
  noise gate, max 20s)│          text, returns akshara-level judgement)
                     └─► Ear 3  forced alignment     (per-akshara duration and     self-host /
                                against instructor   acoustic score vs reference)  Azure for hi/ta
                                       │
                                       ▼
                               reconcile + confidence gate
                                       │
                 ┌─────────────────────┴──────────────────────┐
                 ▼                                            ▼
        confidence < 0.6                            confidence ≥ 0.6
        "say that line once more"                   gpt-5.5 writes ONE correction
        (no score shown)                            in the user's language, plays
                                                    instructor clip of the right sound
                                                              │
                                                              ▼
                                                    voice: gpt-live-1 `nira` (Hindi)
                                                    or Chirp 3 HD hi/ta/te/kn/ml
```

### Ear 1: `gpt-transcribe` with context
- `prompt`: the expected mantra in Devanagari and IAST plus "Sanskrit mantra recited by a learner."
- `keywords[]`: every pada of the mantra.
- `languages`: test `["sa"]`, `["sa","hi"]`, `["hi"]` on day one; the API rejects unsupported codes, so the first call tells us.
- Output: word-level diff against the reference (substitution, omission, addition). This replaces today's gpt-4o text comparison and costs a tenth as much.
- Bridge: until 26 Feb 2027, `whisper-1` `verbose_json` still gives `avg_logprob` and `no_speech_prob` per segment, which is a real silence/garbage detector. Use it only as the hallucination guard, behind a flag, and remove it before the shutdown.

### Ear 2: `gpt-audio-1.5` hears the student
- Chat Completions, `input_audio` wav base64, plus the expected text and the instructor's IAST with marked long vowels, visarga, anusvara, aspirates and retroflexes.
- Ask for strict JSON: per-akshara `{expected, heard, issue: vowel_length|aspiration|retroflex|visarga|anusvara|missing|extra|ok, confidence}`.
- This is the ear that catches "Krisna" vs "Kṛṣṇa", which a transcript cannot.
- A/B it against `gemini-3.8-flash` audio input ($0.0014/min, 40x cheaper). If Gemini matches `gpt-audio-1.5` on the labelled set, switch.

### Ear 3: acoustic alignment against the instructor
- We already have the instructor's word-sliced reference audio. Force-align the student clip to the same Devanagari text with a CTC model (IndicConformer Sanskrit or Vakyansh `sam_60`), and compare per-akshara durations and emission scores with the instructor's alignment. Long vs short vowel is a duration ratio; a dropped visarga is a missing token; retroflex vs dental shows as low emission probability on the token.
- Runs as a small Python service (Fly/Modal/Cloud Run GPU-less is fine for 20 s clips). Start with torchaudio `MMS_FA` (pinned ≤2.8) for speed of implementation, move to IndicConformer when the eval set says it is worth it.
- For Hindi- and Tamil-script users, Azure pronunciation assessment (hi-IN, ta-IN scripted mode) gives phoneme scores today with zero hosting. Transliterate the mantra into Hindi orthography, score under hi-IN, expect systematic penalties on Sanskrit-only sounds. Use it as a third vote, not the truth.

### Reconcile and gate
- Agreement of two ears on an error = report it. One ear alone = mention softly ("ध्यान दें: ...") or drop.
- Overall confidence = weighted agreement. Below 0.6: do not show a score; say "एक बार फिर बोलिए" and auto-replay the instructor line. Wrong corrections destroy trust faster than slow ones.
- Keep today's "did they recite a different mantra entirely" check; Ear 1 handles it.

### Mouth: the guru voice
- Short term (this month): `gpt-live-1` with voice `nira`, or a prompt-to-voice custom Hindi guru voice created via `POST /v1/audio/voices`. Live paraphrases backend text, so use it for the explanation, never for demonstrating the mantra itself. The mantra demo is always the instructor's recording.
- For Tamil, Telugu, Kannada, Malayalam explanations: Google Cloud Chirp 3 HD (`ta-IN-Chirp3-HD-*` etc.) or Sarvam Bulbul v3. Chirp 3 HD also accepts IPA custom pronunciations, so Sanskrit terms inside a Tamil sentence can be pinned.
- Drop ElevenLabs Adam. Keep an ElevenLabs v3 Hindi voice only as fallback.
- When Neer/Leher reach the API, swap the voice ID. Nothing else changes.
- `/v1/audio/speech` dies 6 Jan 2027: anything that still calls it must move to `gpt-realtime-2.1-mini` (text in, audio out) or to Google.

### Live guru mode (weeks 5-6 in the roadmap)
- `gpt-live-1` full-duplex with client delegation: the Live model handles turn-taking and the Hindi voice; our backend (the three-ear pipeline above, exposed as a tool) does the judging. The user chants a line, the guru responds in under a second, interrupts are natural.
- Alternative: `gemini-3.8-live` with `custom_vocabulary` set to the mantra padas, all five languages in one model, cheaper. Build the backend tool once; both front-ends can call it.

## 3. Evaluation before any of this ships
- 50 clips, labelled by the instructor: good / partial / wrong, with the specific akshara errors marked. Mix of Hindi, Tamil, Kannada speakers, phone mics, some background noise.
- Metrics: agreement with instructor on pass/fail, precision of reported errors (a reported error the instructor did not mark is a trust-killer), and false "say again" rate.
- Run today's pipeline on the set first so we have the real baseline, not the remembered 80-85%.
- Rerun on every model change. Store results in `docs/eval/`.

## 4. Cost per practice attempt (20 s clip, rough)
| Component | Cost |
|---|---|
| gpt-transcribe | $0.0015 |
| gpt-audio-1.5 | $0.02 |
| alignment service | ~$0.001 |
| gpt-5.5 one-sentence feedback | $0.003 |
| nira / Chirp 3 HD, 15 s | $0.0125 / $0.004 |
| **Total** | **~$0.04 per attempt**, ~₹3.30. 30 attempts/user/month ≈ ₹100. |

Set a daily cap per user and a monthly cap per account in code before beta.

## 5. Build order for Opus 5.5 (replaces roadmap weeks 1-2 detail)
1. Eval harness + 50 labelled clips. Baseline today's pipeline.
2. Preprocess: trim silence, normalise, 20 s max, reject clips under -45 dBFS RMS.
3. Ear 1: swap `whisper-1` for `gpt-transcribe` with prompt/keywords/languages. Probe `sa`.
4. Ear 2: `gpt-audio-1.5` akshara JSON. Compare with Gemini 3.8 Flash on the eval set.
5. Reconcile + confidence gate + "say again" UX state (see UX plan, P0 #2).
6. Mouth: `gpt-live-1` `nira` for Hindi; Chirp 3 HD for the four southern languages. Remove Adam.
7. Ear 3: alignment service. Start with MMS_FA; evaluate IndicConformer Sanskrit.
8. Kill switch and cost caps. Remove whisper-1 bridge before 26 Feb 2027.

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

## Decisions taken 2 Nov 2026 (Aditya)

1. **First UX fix: score and trust.** Build the confidence-gated result screen before error handling or the visual system.
2. **Visual direction: prayer book.** Devanagari-first, warm paper tones, serif Devanagari face for mantra text, no XP, streak or star gamification. Home-page purple/pink tokens are evidence of the old look, not the target. Replace DESIGN.md accordingly in `/impeccable init` + new-work.
3. **Audio first build: Ears 1 + 2 only.** `gpt-transcribe` + `gpt-audio-1.5` with the confidence gate. Ear 3 (forced alignment) waits for the eval set to show it is needed.

### Resulting order for Opus 5.5
1. Eval harness + 50 labelled clips, baseline today's pipeline (section 3).
2. Ears 1 + 2 + reconcile + confidence gate (section 2), behind a feature flag.
3. `/impeccable init` -> PRODUCT.md, then new-work with the prayer-book world -> DESIGN.md (replaces the home tokens; keep gold as accent if it survives contrast).
4. `/impeccable shape "result screen"` then build: guru sentence first, band not percentage, "say again" state, user clip vs instructor clip playback. This is P0 #2 and consumes the pipeline output.
5. `/impeccable harden app/practice/[id]/page.tsx`: P0 #1 error split, mic permission flow, 20 s cap.
6. `/impeccable layout` on practice, then `/impeccable polish` on home, signin, signup in the new world.
7. `/impeccable audit` a11y pass; `/impeccable onboard` first run.
8. Mouth: `gpt-live-1` `nira` + Chirp 3 HD; remove ElevenLabs Adam. Remove whisper-1 bridge before 26 Feb 2027.
9. `/impeccable critique https://tapaswe.vercel.app`, target >= 30/40 before closed beta (Dec 22).

## 7. UX build order for Opus 5.5 (original sequence, superseded by the decisions above where they differ) (Impeccable commands, in sequence)

Run `impeccable context` first. No PRODUCT.md or DESIGN.md exists; create them so the design
decisions survive sessions:

1. `/impeccable init` -> PRODUCT.md. Facts to capture: devotional Sanskrit practice; users 40-65,
   Hindi + Tamil/Kannada/Telugu/Malayalam, Android first; mode Operate; trust in feedback is the
   product; instructor audio is the only source of truth for pronunciation.
2. `/impeccable document` -> DESIGN.md from the home page tokens (purple #2E2871, pink #EF5DA8,
   gold #F0B100, 15 px radius, card tints). Add a type pairing: Tiro Devanagari Sanskrit or Noto
   Serif Devanagari for mantra text, Noto Sans Devanagari + matching Latin for UI, via `next/font`.
   Set `lang` per block (`sa`, `hi`, `ta`...). Fix pink contrast (darken to >= 4.5:1 on tints).
3. `/impeccable harden app/practice/[id]/page.tsx` -> P0 #1: error states, mic permission flow,
   max duration, offline/slow network, 20 s cap, user-clip playback.
4. `/impeccable shape "result screen"` then build -> P0 #2: confidence-gated result, "say again"
   state, band instead of percentage, guru sentence first, user vs instructor A/B playback.
5. `/impeccable layout app/practice/[id]/page.tsx` -> P1 #3 and P2 #5: header, hero Devanagari,
   player with Heroicons at 48 px, segmented speed, language picker inside the Record card, tips
   collapsed.
6. `/impeccable polish` on signin, signup, home -> P1 #4: tokens everywhere, one logo, remove
   placeholder stats, bottom nav with only working tabs.
7. `/impeccable audit` -> a11y pass: aria-labels on the 10 icon buttons, buttons not spans,
   focus-visible, reduced motion, 44 px targets, contrast.
8. `/impeccable onboard` -> first-run: 3-screen intro (listen, repeat, hear the guru), mic
   permission priming, first mantra = Om.
9. `/impeccable critique https://tapaswe.vercel.app` again; target >= 30/40 before beta.

Non-negotiables for every step: keep instructor audio as the demo source, keep the five feedback
languages, Devanagari first, no XP/gamification language, 44 px minimum targets, every state has a
way back.

## Sources
OpenAI: developers.openai.com/api/docs/guides/{voice-agents,realtime,speech-to-text,text-to-speech,audio,live,live-delegation,custom-voices,voice-prompting}, /api/docs/models, /pricing, /deprecations, /changelog; community.openai.com GPT-Live-1 and gpt-transcribe announcements; x.com/OpenAI status 2110797830361436604 (GPT-Live-1.1 "coming soon to the API").
Google: ai.google.dev/gemini-api/docs/{live,live-guide,speech-generation,audio,models,pricing}; docs.cloud.google.com/speech-to-text/docs/models/chirp-3; docs.cloud.google.com/text-to-speech/docs/chirp3-hd.
Indic: sarvam.ai/api-pricing, docs.sarvam.ai; learn.microsoft.com pronunciation-assessment language support; github.com/AI4Bharat/IndicConformerASR; huggingface.co/ai4bharat/indicconformer_stt_sa_hybrid_ctc_rnnt_large; github.com/Open-Speech-EkStep/vakyansh-models; torchaudio forced_alignment_for_multilingual_data tutorial; elevenlabs.io/docs.

## Implementation status (2 Nov 2026, branch `feat/trust-pipeline-prayer-book`, uncommitted)

### What testing changed in the plan
- `gpt-transcribe` rejects `sa`, accepts `hi`, and **normalises famous mantras to the textbook
  text even when the learner is wrong**, primed or not. It is unusable as an error detector.
- Priming any ear with the expected text hides mistakes. No mantra words in any transcription prompt.
- `gpt-audio-1.5` hears real errors (caught "devasi" for "devasya") but varies run to run and
  sometimes flags correct words, so it never decides alone.
- The literal ear is `whisper-1` (bridge until 26 Feb 2027). Errors are judged **against the
  teacher's own recording**, not the textbook: the same ear transcribes the teacher once (cached in
  storage, keyed by recording + model + prompt), and a word is reported only when the judge flags it
  AND the learner's sound differs from the teacher's at that word.
- The judge runs twice in parallel; the stricter reading per word is kept.

### Built
- `lib/pronunciation/*`: ears, teacher cache, reconcile + confidence gate, guru writer (gpt-5.5),
  fixed "say it again" lines in 5 languages, legacy v1 pipelines behind `PRON_PIPELINE=v1`.
- Routes: `/api/analyze-pronunciation` and `/api/analyze-word` take 16 kHz WAV, load text from the
  DB (verse aware), daily cap (`PRON_DAILY_ATTEMPT_CAP`, default 80), log every attempt to
  `pronunciation_logs`. Old webm clients fall back to v1 automatically.
- Browser preprocessing `lib/audio/prepare-recording.ts`: mono, 16 kHz, silence trim, peak
  normalise, rejects < 0.6 s, > 20 s, < -45 dBFS.
- Eval harness `scripts/eval-pronunciation.ts` + `docs/eval/manifest.json` (12 provisional clips).
- UI in the pothi world: PRODUCT.md, DESIGN.md, new practice page (listen → repeat → guru, one
  thumb action per step, errata-slip correction, teacher vs you playback, inline errors with
  Android mic steps, verse playback now limited to the verse), contents-style home page, auth pages.

### Eval (provisional labels, `docs/eval/results/v2-sixth-*.json`)
| Metric | First run | Final, two runs |
|---|---|---|
| Verdict agreement | 0.667 | 1.00 / 1.00 |
| False errors on correct recordings | 0 of 7 | 0 of 7 |
| Error word precision / recall | 0 / 0 | 0.5 / 0.5 |
| "Say again" rate | 0.17 | 0 |
| Avg latency | 6.5 s | 7-8 s |

### Open
1. Chakshu to record or collect 30-50 real learner clips and label them; replace the provisional manifest.
2. Ear 3 (forced alignment) only if real-clip recall stays low.
3. Mouth: still ElevenLabs `/api/tts`; swap to gpt-live-1 `nira` / Chirp 3 HD per section 2.
4. Data fixes: "Panchakshari Mantra" has Latin text in its Devanagari field; Shiva/Vishnu deities
   store Latin in `name_devanagari`; one Gayatri recording sits under Vishnu.
5. Instructor pages not migrated to the new design. Onboarding and japa counter not built.
6. Deploy: set nothing new (all env vars optional); confirm OpenAI billing has auto-recharge, since
   credits ran out once today and broke production analysis.

## Launch scope agreed with Chakshoo (call, 2 Nov 2026)

Priority: (1) pronunciation accuracy, (2) a big admin-curated mantra library, (3) UGC (users record and share their own mantras), (4) optional repetition counter towards 108 with correct/incorrect counts, (5) open, likely an accuracy-over-time chart. The core is due by the end of November. December is for iOS and Play Store. Full notes are in `docs/calls/2026-11-02-review-tapaswe-timelines.md`.

### ElevenLabs test (2 Nov 2026)

- **Speech-to-text (Scribe v1/v2): reject as a scoring ear.** On the wrong-Gayatri clip, where the learner said "Deva Siddhi Mai", it returned the perfect textbook Gayatri. That is the same failure as gpt-transcribe.
- **Text-to-speech (round trip):** generate the Gayatri, then transcribe it with whisper-1 and compare to the reference.

  | Voice | Similarity to reference | What went wrong |
  |---|---|---|
  | eleven_v4 | 0.99 | — |
  | OpenAI gpt-4o-mini-tts "marin" | 0.96 | "sadhitur", "dhilo" |
  | eleven_multilingual_v2 (what production used) | 0.86-0.91 | spelled out "A-U-M"; added "According to…" |
  | eleven_v3 | 0.82 | added a Hindi phrase |

  The OpenAI `/v1/audio/speech` endpoint shuts down on 6 Jan 2027, and the `nira` voice exists only in realtime.
- **Decision:** ElevenLabs eleven_v4 is the voice ("mouth"). It is set in `app/api/tts/route.ts` and can be overridden with `ELEVENLABS_MODEL`. Scoring stays on the OpenAI ears. ElevenLabs audio isolation (`/v1/audio-isolation`) responds and is a candidate for cleaning user-uploaded reference recordings. Chakshu's voice could be cloned for the guru line if he consents.

### Delivery plan for the five launch items (target 30 Nov)

| Week | Work |
|---|---|
| 3-9 Nov | Ship v2 accuracy and redesign (preview first, then production). Add a "Was this right?" button on results so real attempts become labelled eval data. Build (5) the accuracy-over-time chart from `pronunciation_logs`. |
| 10-16 Nov | Build (3) UGC. A user records a mantra and adds a title and optional text. It is private with a share link; no public listing in V0. Scoring runs against the creator's recording. If no text is given, the reference words come from the creator recording's literal transcript. Add a report button. |
| 17-23 Nov (Aditya travelling) | Build (4) the japa counter. Each recitation is cut by on-device silence detection, so counting is free; correct/incorrect comes from a cheap check on each recitation, with full feedback at the end. Build (2) instructor bulk upload, plus search on the home page once there are more than 20 mantras. Make the data fixes. |
| 24-30 Nov | Rerun the eval on real clips. Add forced alignment ("Ear 3") if word recall stays below 0.7. Polish, then prepare the Capacitor/PWA wrapper for the December store submissions. |
