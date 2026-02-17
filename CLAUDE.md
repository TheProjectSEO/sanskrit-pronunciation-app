# CLAUDE.md - Tapaswe Sanskrit Pronunciation App

> Single source of truth for all project context, decisions, features, and progress.
> Updated via `/update` after every change.

---

## Project Overview

**Tapaswe** is a Sanskrit pronunciation learning app. Instructors upload mantras with reference audio. Students listen, practice by recording themselves, and receive AI-powered pronunciation feedback (GPT-4o analysis with Hindi guru-style feedback and ElevenLabs TTS).

- **Repo:** `TheProjectSEO/sanskrit-pronunciation-app`
- **Local path:** `/Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-app/`
- **Branch:** `master`
- **Deployed:** Yes (Vercel)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5.11 (App Router) |
| React | 19.0.0 |
| Auth | NextAuth v5 (beta 25) - JWT strategy, Credentials + Google providers |
| Database | Supabase (PostgreSQL) with Row Level Security |
| AI Analysis | OpenAI GPT-4o (pronunciation feedback) |
| Transcription | OpenAI Whisper |
| TTS | ElevenLabs `eleven_multilingual_v2` |
| Styling | Tailwind CSS v4 with PostCSS |
| Animation | Framer Motion |
| Validation | Zod |
| Password | bcryptjs (12 salt rounds) |
| Icons | @heroicons/react |
| Email | @emailjs/nodejs |

---

## Project Structure

```
tapaswe-app/
├── app/
│   ├── page.tsx                          # Homepage - lists published mantras
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Global styles (Tailwind v4)
│   ├── providers.tsx                     # Session provider wrapper
│   ├── signin/page.tsx                   # Sign in page (Credentials + Google)
│   ├── signup/page.tsx                   # Sign up page
│   ├── reset-password/
│   │   ├── page.tsx                      # Request password reset
│   │   └── confirm/page.tsx              # Confirm password reset
│   ├── practice/[id]/page.tsx            # Practice page (~847 lines) - recording, analysis, feedback
│   ├── instructor/
│   │   ├── layout.tsx                    # Instructor nav layout
│   │   ├── page.tsx                      # Instructor dashboard
│   │   ├── upload/page.tsx               # Upload new mantra
│   │   └── mantras/
│   │       ├── page.tsx                  # List instructor mantras
│   │       └── [id]/page.tsx             # Mantra detail (with edit mode)
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # NextAuth route handler
│       ├── auth/signup/route.ts          # Signup API
│       ├── auth/forgot-password/route.ts # Forgot password API
│       ├── auth/reset-password/route.ts  # Reset password API
│       ├── mantras/route.ts              # Public: list published mantras (with deity & category filters)
│       ├── mantras/[id]/route.ts         # Public: single mantra detail
│       ├── mantras/[id]/verses/route.ts  # Public: list verses for a mantra
│       ├── mantras/[id]/word-audio/route.ts # Public: get cached word audio for a mantra
│       ├── analyze-pronunciation/route.ts # GPT-4o pronunciation analysis
│       ├── analyze-word/route.ts         # GPT-4o single word analysis
│       ├── tts/route.ts                  # ElevenLabs TTS endpoint
│       ├── translate-to-devanagari/route.ts # GPT-4o Roman → Devanagari translation
│       ├── generate-word-audio/route.ts  # Pre-generate & cache TTS for all words in mantra
│       ├── deities/route.ts              # Public: list all deities
│       ├── user/preferences/route.ts     # User preferences (feedback language)
│       └── instructor/
│           ├── mantras/route.ts          # Instructor: list/create mantras
│           ├── mantras/[id]/route.ts     # Instructor: GET + PATCH mantra
│           ├── mantras/[id]/verses/route.ts # Instructor: verse CRUD
│           ├── publish-mantra/route.ts   # Publish a mantra
│           ├── delete-mantra/route.ts    # Delete a mantra
│           ├── reprocess-mantra/route.ts # Reprocess transcription
│           ├── transcribe/route.ts       # Whisper transcription
│           └── deities/route.ts          # Instructor: deity CRUD
├── auth.ts                               # NextAuth config (trustHost: true, 24h sessions)
├── middleware.ts                          # Route protection (public/instructor routes)
├── lib/
│   ├── audio/whisper.ts                  # Whisper integration
│   ├── auth/password.ts                  # bcrypt password utilities
│   ├── email/emailjs.ts                  # Email service
│   └── supabase/
│       ├── server.ts                     # Supabase server client
│       ├── service.ts                    # Supabase service role client (bypasses RLS)
│       └── jwt.ts                        # JWT utilities
├── supabase/migrations/
│   ├── 001_create_base_schema.sql        # users, mantras, reference_audio_clips, processing_jobs, pronunciation_logs, oauth_accounts, password_reset_tokens
│   ├── 002_add_mantras_auth_columns.sql  # status, created_by, published_at on mantras
│   ├── 003_add_rls_policies.sql          # RLS on users, mantras, clips, jobs
│   ├── 004_create_deities.sql            # deities table + deity_id on mantras
│   ├── 005_user_preferences.sql          # user_preferences table (feedback_language)
│   ├── 006_mantra_verses.sql             # mantra_verses table (per-verse practice)
│   └── 007_word_audio_cache.sql          # word_audio_cache + mantra_word_audio (consistent TTS)
├── types/next-auth.d.ts                  # NextAuth type extensions (role on user/session)
├── scripts/                              # Utility scripts (fix ownership, reprocess, verify)
├── __tests__/middleware.test.ts           # Middleware tests
└── docs/plans/                           # Historical planning docs
```

---

## Database Schema (Current)

### Tables
- **users** - id, email, name, password_hash, role (`student`|`instructor`|`admin`), first_name, last_name, is_active, created_at, updated_at
- **oauth_accounts** - user_id FK, provider (`google`|`github`), provider_account_id, access_token, refresh_token, expires_at
- **password_reset_tokens** - user_id FK, token, expires_at, used_at
- **user_preferences** - user_id FK, feedback_language (`hindi`|`english`|`kannada`|`tamil`|`telugu`)
- **deities** - id, name, name_devanagari, description, image_url
- **mantras** - id, name, status (`draft`|`published`), created_by FK, published_at, reference_text_devanagari, reference_text_roman, reference_audio_url, difficulty_level, category (VARCHAR), deity_id FK, critical_sounds
- **mantra_verses** - id, mantra_id FK, verse_number, title, text_devanagari, text_roman, audio_start_time, audio_end_time
- **reference_audio_clips** - mantra_id FK, clip_type (`word`|`word_pair`|`full_mantra`), word_text, word_position, audio_url, start_time, end_time
- **mantra_processing_jobs** - mantra_id FK, status (`pending`|`processing`|`completed`|`failed`), audio_path, created_by FK
- **pronunciation_logs** - user_id FK, mantra_id FK, attempt_audio_url, feedback_score, feedback_text
- **word_audio_cache** - id, word, audio_url, tts_provider, tts_model, language (UNIQUE on word+provider+model+language)
- **mantra_word_audio** - id, mantra_id FK, word, word_audio_id FK, word_position (links mantras to cached word audio)

### RLS
- RLS enabled on: users, mantras, reference_audio_clips, mantra_processing_jobs
- Service role bypasses RLS (used by API routes via `getServiceSupabase()`)
- Students see published mantras only; instructors see all
- Users can only view/update own profile

### Migrations Applied
- [x] 001 - Base schema
- [x] 002 - Auth columns on mantras
- [x] 003 - RLS policies
- [x] 004 - Deities table + deity_id on mantras
- [x] 005 - User preferences (feedback language)
- [x] 006 - Mantra verses (per-verse practice)
- [x] 007 - Word audio cache (consistent TTS pronunciation)

---

## Auth Architecture

- **NextAuth v5** with JWT strategy (no database sessions)
- **Providers:** Credentials (email/password) + Google OAuth
- **Session duration:** 24 hours
- **`trustHost: true`** - required for network IP access
- **Middleware:** Protects all routes except `/signin`, `/signup`, `/reset-password`, `/api/auth`
- **Instructor routes:** `/instructor/*` requires `role === 'instructor'`
- **API auth:** Routes use `getServiceSupabase()` (service role) to bypass RLS

---

## Environment Variables

Stored in `.env.local` (gitignored):
- `NEXTAUTH_URL` - App URL (currently `http://localhost:3003`)
- `NEXTAUTH_SECRET` - JWT signing secret
- `AUTH_TRUST_HOST=true` - Trust proxy host headers
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (bypasses RLS)
- `OPENAI_API_KEY` - GPT-4o + Whisper
- `ELEVENLABS_API_KEY` - TTS

---

## Team

- **Aditya** - Lead developer
- **Chakshu Om** - Product feedback, testing
- **Arun Ambekar** - UI/UX designs, feature specs

---

## Status Board

### Completed (Core Features)
- [x] Core app working: auth, mantra upload, practice, AI analysis, TTS
- [x] Instructor dashboard with mantra management
- [x] Click-to-record (replaced press-and-hold)
- [x] GPT-4o pronunciation analysis with multilingual feedback (5 languages)
- [x] Pre-generated word audio cache (100% consistent TTS)
- [x] Password reset flow with email
- [x] Route protection middleware
- [x] RLS policies on all tables
- [x] Deployment on Vercel
- [x] Repo migrated from `Tapaswe-Sanskrit-App` to `sanskrit-pronunciation-app`

### Completed (All 6 Features + Phase 1-3 Bugfixes)
- [x] Feature 1: Transliteration editing (instructor can edit name, Devanagari, Roman)
- [x] Feature 2: Sound icons on mispronounced words (TTS playback)
- [x] Feature 3: Deity/category system (dual filtering on homepage)
- [x] Feature 4: Multilingual feedback (Hindi, English, Kannada, Tamil, Telugu)
- [x] Feature 5: Word-level practice (clickable words, practice modal)
- [x] Feature 6: Per-verse practice (break mantras into verses)
- [x] **Phase 1 Bugfixes:** Removed key sounds, fixed speed selector (5 direct buttons), improved title prominence
- [x] **Phase 2 Bugfixes:** Fixed recording UX (click-to-start/stop), added category filter
- [x] **Phase 3 Bugfixes:** AI-assisted Devanagari translation, TTS pronunciation fix (pre-generated cache)

### In Progress
- (nothing currently in progress - production ready!)

### Planned Features (Priority Order)

#### Feature 1: Transliteration Editing [P0 - Quick Win]
**Goal:** Instructors can edit mantra name, Devanagari text, and Roman text on the detail page.

- [x] **1.1** Add `PATCH` handler to `app/api/instructor/mantras/[id]/route.ts`
  - Accept `{ name?, reference_text_devanagari?, reference_text_roman? }`
  - Zod validation (all optional, at least one required)
  - Auth check: session + instructor role + `created_by` ownership
  - Sync `text_latin` with `reference_text_roman`, `text_devanagari` with `reference_text_devanagari`
- [x] **1.2** Add edit mode UI to `app/instructor/mantras/[id]/page.tsx`
  - Toggle between view/edit mode
  - `<textarea>` for texts, `<input>` for name
  - Save/Cancel buttons, published warning

**Files:** `app/api/instructor/mantras/[id]/route.ts`, `app/instructor/mantras/[id]/page.tsx`

---

#### Feature 2: Sound Icon on Mispronounced Words [P0 - Quick Win]
**Goal:** Play button next to each mispronounced word so users hear correct pronunciation via TTS.

- [x] **2.1** Create shared TTS utility `lib/audio/tts-player.ts`
  - `playTTS(text: string): Promise<void>` with concurrent playback handling
- [x] **2.2** Add speaker buttons to `detailed_errors` in `app/practice/[id]/page.tsx`
  - Speaker icon next to each `error.expected` word
  - Loading/playing state per word
- [x] **2.3** Add speaker buttons to `word_analysis` chips for incorrect/needs_work words

**Files:** `lib/audio/tts-player.ts` (new), `app/practice/[id]/page.tsx`

---

#### Feature 3: Deity/Category System [P1]
**Goal:** Instructors create deities, assign mantras. Users browse/filter by deity on homepage.

- [x] **3.1** Migration `004_create_deities.sql` - deities table + `deity_id` on mantras
- [x] **3.2** Run migration on Supabase (applied via MCP)
- [x] **3.3** Instructor deity CRUD API `app/api/instructor/deities/route.ts`
- [x] **3.4** Public deity list API `app/api/deities/route.ts`
- [x] **3.5** Add `deity_id` to PATCH handler (Feature 1)
- [x] **3.6** Add deity filtering to `GET /api/mantras`
- [x] **3.7** Instructor deity management page `app/instructor/deities/page.tsx`
- [x] **3.8** Add "Deities" nav link to `app/instructor/layout.tsx`
- [x] **3.9** Deity dropdown on instructor mantra detail page
- [x] **3.10** Deity filter tabs on homepage `app/page.tsx`

**New files:** `supabase/migrations/004_create_deities.sql`, `app/api/instructor/deities/route.ts`, `app/api/deities/route.ts`, `app/instructor/deities/page.tsx`
**Modify:** `app/api/instructor/mantras/[id]/route.ts`, `app/api/mantras/route.ts`, `app/instructor/layout.tsx`, `app/instructor/mantras/[id]/page.tsx`, `app/page.tsx`

---

#### Feature 4: Multilingual Feedback [P1]
**Goal:** Users choose feedback language (Hindi, English, Kannada, Tamil, Telugu). Guru feedback generated in chosen language.

- [x] **4.1** Migration `005_user_preferences.sql` - user_preferences table
- [x] **4.2** Run migration on Supabase (applied via MCP)
- [x] **4.3** Preferences API `app/api/user/preferences/route.ts`
- [x] **4.4** Language constants `lib/constants/languages.ts`
- [x] **4.5** Modify analysis API for multilingual prompts
- [x] **4.6** Language selector on practice page
- [x] **4.7** ~~Indic font support~~ N/A - default fonts render all scripts correctly

**New files:** `supabase/migrations/005_user_preferences.sql`, `app/api/user/preferences/route.ts`, `lib/constants/languages.ts`
**Modify:** `app/api/analyze-pronunciation/route.ts`, `app/practice/[id]/page.tsx`

---

#### Feature 5: Word-Level Practice [P2]
**Goal:** Click any word to hear it. Practice individual mispronounced words in a modal.

- [x] **5.1** Make mantra text words clickable (TTS on click)
- [x] **5.2** Word analysis API `app/api/analyze-word/route.ts`
- [x] **5.3** WordPracticeModal component
- [x] **5.4** "Practice this word" buttons in feedback errors

**New files:** `app/api/analyze-word/route.ts`
**Modify:** `app/practice/[id]/page.tsx`

---

#### Feature 6: Per-Verse Practice [P3]
**Goal:** Break long mantras into verses. Users pick any verse to practice separately.

- [x] **6.1** Migration `006_mantra_verses.sql` - mantra_verses table
- [x] **6.2** Run migration on Supabase (applied via MCP)
- [x] **6.3** Verse management API `app/api/instructor/mantras/[id]/verses/route.ts` (GET/POST/PATCH/DELETE)
- [x] **6.4** Public verse API `app/api/mantras/[id]/verses/route.ts`
- [x] **6.5** Verse management UI on instructor mantra detail page (add/edit/delete verses)
- [x] **6.6** Verse selector tabs on practice page (Full Mantra + per-verse)
- [x] **6.7** Verse count badge on homepage mantra cards

**Status:** COMPLETE

**New files:** `supabase/migrations/006_mantra_verses.sql`, `app/api/instructor/mantras/[id]/verses/route.ts`, `app/api/mantras/[id]/verses/route.ts`
**Modify:** `app/instructor/mantras/[id]/page.tsx`, `app/practice/[id]/page.tsx`, `app/api/mantras/route.ts`, `app/page.tsx`

---

### Known Bugs / Issues
- (none currently tracked)

---

## Implementation Order

```
Phase 1 (Quick wins - do now):
  Feature 1: Transliteration editing  ──┐
  Feature 2: Sound icon on errors     ──┼── Independent, do in parallel
                                        │
Phase 2 (Medium effort):                │
  Feature 3: Deity system             ──┤  (depends on Feature 1 PATCH handler)
  Feature 4: Multilingual feedback    ──┘  Independent

Phase 3 (Larger effort):
  Feature 5: Word practice modal      ──── Depends on Features 2 + 4

Phase 4 (Waiting for designs):
  Feature 6: Per-verse practice       ──── Can start DB/API work anytime
```

---

## Key Decisions (ADR Log)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-30 | NextAuth v5 with JWT strategy | No database session table needed, works with Supabase |
| 2026-01-30 | Service role client for all API routes | Bypasses RLS, simpler than per-user Supabase auth |
| 2026-01-30 | GPT-4o for analysis (not fine-tuned model) | Flexibility, Hindi/Sanskrit instruction quality |
| 2026-01-30 | ElevenLabs multilingual v2 | Best Sanskrit pronunciation quality |
| 2026-02-07 | Migrated from `Tapaswe-Sanskrit-App` to `sanskrit-pronunciation-app` repo | Old repo had outdated code, other laptop had corrupted git |
| 2026-02-07 | Feature priority: editing + sound icons first | Quick wins that unblock team testing |
| 2026-02-15 | Pre-generated word audio cache (Option A) | Ensures 100% TTS consistency, shared cache across mantras, graceful fallback |
| 2026-02-15 | Click-to-record instead of press-and-hold | Better UX, less confusing for users |
| 2026-02-15 | GPT-4o for Roman→Devanagari translation | Makes instructor editing easier, IAST-aware |

---

## Session Log

### 2026-02-07 - Repo Migration + Feature Planning
- Debugged signin issue - turned out to be wrong repo (old `Tapaswe-Sanskrit-App` vs new `sanskrit-pronunciation-app`)
- Cloned correct repo, restored `.env.local`, installed deps
- Deleted old repo to prevent confusion
- Analyzed team WhatsApp feedback and created 6-feature implementation plan
- Created this CLAUDE.md as single source of truth

### 2026-02-15 - Critical Bugfixes (Phase 1-3)
**Phase 1 - Quick Wins (2-3 hours):**
- Removed key sounds section (wrong logic for mantras)
- Fixed speed selector with 5 direct buttons (0.5x-1.5x)
- Verified deity filtering implementation
- Improved mantra title prominence (larger, bolder)

**Phase 2 - Medium Complexity (4-5 hours):**
- Fixed recording mechanism: click-to-start/click-to-stop
- Added category filter with 8 categories (Meditation, Prayer, Protection, Peace, Healing, Wisdom, Devotion, Prosperity)
- Dual filtering: deity AND category simultaneously

**Phase 3 - Complex/Critical (8 hours):**
- Auto-translation: GPT-4o translates Roman → Devanagari
- TTS pronunciation fix (CRITICAL BLOCKER): Pre-generated word audio cache system
  - Created word_audio_cache + mantra_word_audio tables
  - Generate TTS once per word, store in cache, reuse = 100% consistency
  - Instructor "Generate Word Audio" button
  - Practice page uses cached audio with graceful fallback

**Commits:**
- `ccddf31` - Phase 1+2 bugfixes (5 files, 445 insertions, 189 deletions)
- `347cfc6` - Phase 3 (7 files, 492 insertions, 24 deletions)

**Production Status:** All critical bugs fixed, ready for Chakshu demo

---

## How to Run

```bash
cd /Users/adityaaman/Desktop/Projects/Tapaswe/tapaswe-app
npm run dev
# Runs on http://localhost:3003 (configured in .env.local)
# Accessible via network at http://<local-ip>:3003
```

## How to Update This File

After any change (feature, bugfix, decision, config change), run:
```
/update
```
This triggers the `/update` skill to sync CLAUDE.md with the latest state.
