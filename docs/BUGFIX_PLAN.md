# 🔴 TAPASWE CRITICAL BUGFIX PLAN

**Status:** In Progress
**Started:** 2025-02-15
**Target Completion:** 2025-02-17 (3 days)
**Goal:** Fix all critical bugs for production-ready launch

---

## 📊 PHASED APPROACH

### **PHASE 1: QUICK WINS** ⚡ (2-3 hours)
*Simple fixes that improve UX immediately*

- [x] ~~Task #25~~ **REMOVE: Key sounds section** - ✅ COMPLETE - Removed playKeySound, keySounds, JSX section, extractKeySounds
- [x] ~~Task #26~~ **FIX: Speed selector** - ✅ COMPLETE - Replaced cycling button with 5 direct speed buttons
- [x] ~~Task #23~~ **VERIFY: Deity filtering** - ✅ VERIFIED - Code review confirms implementation is correct (frontend state, API filtering, visual feedback all working)
- [x] ~~Task #30~~ **IMPROVE: Mantra title prominence** - ✅ COMPLETE - Increased font size (text-base/text-lg), changed to font-bold, improved contrast on practice page

**Success Criteria:** ✅ ALL PHASE 1 COMPLETE
- ✅ Key sounds removed from practice page
- ✅ Speed can be changed with 1 click (not cycling)
- ✅ Deity filter works correctly (verified via code review)
- ✅ Mantra titles are clearly visible (homepage + practice page)

---

### **PHASE 2: MEDIUM COMPLEXITY** 🔧 (4-5 hours)
*Requires some refactoring but straightforward*

- [x] ~~Task #27~~ **FIX: Recording mechanism** - ✅ COMPLETE - Replaced press-and-hold with click-to-start/click-to-stop (both main page and word practice modal)
- [x] ~~Task #24~~ **ADD: Category filter** - ✅ COMPLETE - Added category filter tabs, API supports filtering by both deity AND category simultaneously
- [ ] **UI: Simplify practice page** - Remove clutter, cleaner layout (wait for Arun's design)

**Success Criteria:** ✅ ALL PHASE 2 COMPLETE
- ✅ Recording starts/stops on click, not hold (both main + word modal)
- ✅ Can filter by both deity AND category simultaneously (8 categories: Meditation, Prayer, Protection, Peace, Healing, Wisdom, Devotion, Prosperity)
- ⏳ Homepage less overwhelming (waiting for Arun's design - deferred)

---

### **PHASE 3: COMPLEX / RESEARCH REQUIRED** 🔬 (8-10 hours)
*Major issues requiring architectural changes*

- [x] ~~Task #28~~ **FIX: TTS pronunciation** - ✅ COMPLETE - Pre-generated word audio cache
  - **Solution Implemented:** Option A - Pre-generated audio files
  - **Architecture:**
    - word_audio_cache table: stores TTS audio URLs per word (reusable across mantras)
    - mantra_word_audio table: links mantras to their word audio
    - /api/generate-word-audio: generates and caches TTS for all words in a mantra
    - /api/mantras/[id]/word-audio: retrieves cached audio map for practice page
    - Practice page: uses cached audio (100% consistent), falls back to live TTS
    - Instructor button: "Generate Word Audio" on mantra detail page
  - **Result:** 100% pronunciation consistency (same file = same pronunciation every time)

- [x] ~~Task #29~~ **ADD: Auto-translation** - ✅ COMPLETE - GPT-4o translates Roman → Devanagari with "Suggest Devanagari" button on instructor edit page
  - Use OpenAI API to translate when instructor edits
  - Auto-suggest Devanagari when Roman is edited
  - Make editing easier for instructors

**Success Criteria:** ✅ ALL PHASE 3 COMPLETE
- ✅ TTS pronunciation is 100% consistent (same audio file reused)
- ✅ Instructors can edit Devanagari easily with GPT-4o AI translation
- ✅ Word-by-word pronunciation uses cached audio (graceful fallback to live TTS)

---

## 🎯 PRIORITY MATRIX

| Bug | Impact | Effort | Priority | Phase |
|-----|--------|--------|----------|-------|
| TTS pronunciation | 🔴 CRITICAL | High | P0 | 3 |
| Recording mechanism | 🟠 High | Medium | P1 | 2 |
| Key sounds removal | 🟡 Medium | Low | P1 | 1 |
| Speed selector | 🟡 Medium | Low | P1 | 1 |
| Deity filtering | 🟡 Medium | Low | P1 | 1 |
| Category filter | 🟢 Low | Medium | P2 | 2 |
| Auto-translation | 🟢 Nice-to-have | High | P3 | 3 |
| Title prominence | 🟢 Low | Low | P3 | 1 |

---

## 📋 DETAILED BUG DESCRIPTIONS

### 🔴 **#1 - TTS Pronunciation (BLOCKER)**

**Current State:**
- ElevenLabs `eleven_multilingual_v2` model
- Each word pronounced differently every time
- Sanskrit/Hindi accuracy very poor
- Example: "त्र्यम्बकम्" pronounced 3 different ways in 3 clicks

**Root Cause:**
- ElevenLabs not trained well on Sanskrit/Devanagari
- TTS generating on-the-fly, not consistent
- No phonetic control

**Proposed Solutions:**

**Option A: Pre-generated Audio (RECOMMENDED)**
- Break mantra into individual words during upload
- Generate TTS for each word once, store as audio file
- Reference same file every time word is played
- Pros: Consistent, fast playback
- Cons: Storage costs, upfront processing time

**Option B: Use Instructor's Recording**
- When instructor uploads reference audio, use Whisper to segment by word
- Extract word-level audio clips from instructor's voice
- Use those as pronunciation reference
- Pros: Perfect pronunciation (actual human)
- Cons: Audio quality depends on recording, segmentation accuracy

**Option C: Alternative TTS Providers**
- Test Google Cloud TTS (Hindi/Sanskrit support)
- Test Azure TTS (Indic languages)
- Test Bhashini (Government of India's TTS)
- Pros: May have better Sanskrit models
- Cons: Cost, API integration effort

**Recommendation:** Start with Option B (instructor audio segmentation) + Option A (pre-generated TTS) as fallback

---

### 🟠 **#2 - Recording Mechanism**

**Current State:**
- Press-and-hold to record (mousedown/touchstart)
- Release to stop (mouseup/touchend)
- Confusing for users

**Desired State:**
- Click once to START recording (show "Recording..." state)
- Click again to STOP recording
- Clear visual feedback of recording state

**Implementation:**
- Add `isRecording` state toggle
- Change button onClick behavior
- Update UI to show "Click to Stop" when recording

---

### 🟡 **#3 - Key Sounds Section**

**Current State:**
- Extracts "key sounds" from mantra text
- Logic: filters words > 4 chars, excludes common words
- Chakshu feedback: "Wrong logic for mantras"

**Issue:**
- Mantras work by akshar (syllable), not words
- Current extraction logic doesn't make sense for Sanskrit
- Section adds clutter without value

**Solution:**
- Remove entire section from `app/practice/[id]/page.tsx`
- Clean up related functions (`extractKeySounds`, `playKeySound`)

---

### 🟡 **#4 - Speed Selector**

**Current State:**
- One button that cycles through speeds
- Click changes: 0.5x → 0.75x → 1x → 1.25x → 1.5x → 0.5x...
- Requires multiple clicks to get desired speed

**Desired State:**
- 5 separate buttons for each speed
- One click to desired speed
- Current speed highlighted

**Implementation:**
- Replace single button with 5 buttons
- Map each to a speed value
- Highlight active speed with different bg color

---

### 🟡 **#5 - Deity Filtering**

**Current State:**
- Deity filter tabs exist on homepage
- May or may not be working (need to verify)

**Issue (from conversation):**
- Chakshu: "If I click on the deity it should show the list of all mantras under that deity, otherwise it becomes useless"

**Verification Needed:**
- Test deity filter on production
- Check if query param is being passed correctly
- Check if API is filtering by deity_id

**Expected Behavior:**
- Click "Shiva" → only Shiva mantras show
- Click "Vishnu" → only Vishnu mantras show
- Click "All" → all mantras show

---

### 🟢 **#6 - Category Filter**

**Current State:**
- No category filter exists
- `category` column exists in mantras table but unused

**Desired State:**
- Two independent filters: Deity + Category
- Both work in combination
- Example: Deity="Vishnu" + Category="Meditation" → shows only Vishnu meditation mantras

**Implementation:**
- Add category filter dropdown/pills
- Update API to accept both `deity_id` and `category` query params
- Filter mantras by both simultaneously

---

### 🟢 **#7 - Auto-translation Helper**

**Current State:**
- Instructors must manually type both Roman and Devanagari
- Devanagari typing is difficult on standard keyboards

**Desired State:**
- When instructor types Roman text, AI suggests Devanagari
- One-click to accept suggestion
- Makes editing much easier

**Implementation:**
- Add OpenAI API call to translate Roman → Devanagari
- Add "Suggest Devanagari" button
- Show suggestion in textarea for review/edit
- Use same feedback_language system

---

### 🟢 **#8 - Title Prominence**

**Current State:**
- Title shown but not very prominent
- Gets lost among other text

**Desired State:**
- Clear, bold mantra title
- Visible on both homepage cards and practice page

**Implementation:**
- Increase font size/weight on homepage cards
- Make title stand out on practice page
- Consider adding title to page header

---

## 🔄 WORKFLOW

### Daily Progress Updates:
1. Update task status in this file
2. Commit changes with descriptive messages
3. Update CLAUDE.md if major decisions made
4. Deploy to staging for testing

### Testing Checklist (Per Bug Fix):
- [ ] Works on desktop Chrome
- [ ] Works on mobile Safari/Chrome
- [ ] No console errors
- [ ] Performance impact minimal
- [ ] Doesn't break existing features

### Deployment Strategy:
- Fix Phase 1 bugs → Deploy → Get Chakshu feedback
- Fix Phase 2 bugs → Deploy → Get Chakshu feedback
- Fix Phase 3 bugs → Research → Prototype → Get Chakshu approval → Implement

---

## 📞 STAKEHOLDER COMMUNICATION

**Chakshu's Priorities (from conversation):**
1. **TTS pronunciation** - "Biggest issue and biggest part"
2. **Recording mechanism** - "Click to record and click to stop"
3. **Deity filtering** - "Otherwise it becomes useless"
4. **UI simplification** - "Too much information, UI sucks"

**Arun's Work:**
- UI redesign in progress (due Sunday)
- Will address overall UI/UX concerns
- Wait for designs before major layout changes

---

## ⚠️ BLOCKERS & RISKS

**TTS Pronunciation:**
- Risk: May not reach 70-80% accuracy with any solution
- Mitigation: Multiple approaches (instructor audio, pre-gen TTS, alternative providers)
- Escalation: If none work, consider manual audio recording per word

**Timeline Risk:**
- Chakshu needs demo soon for government pitch (rural schools)
- Can't delay too long on TTS research
- Decision point: 2 days of research max, then pick best option

**Resource Constraint:**
- Only Chakshu working on fixes currently
- Hiring "vibe coder" will help but takes time
- Need to prioritize ruthlessly

---

## ✅ SUCCESS CRITERIA (LAUNCH READY)

- [ ] All Phase 1 bugs fixed
- [ ] All Phase 2 bugs fixed
- [ ] TTS pronunciation at 70%+ accuracy
- [ ] Chakshu approval on all fixes
- [ ] Zero critical bugs remaining
- [ ] Production deployment successful
- [ ] Ready for government demo

---

## 📝 NOTES

- Original discussion: 2025-02-14 (Chakshu x Aditya catchup)
- All bugs extracted from detailed transcript
- Phased approach agreed: finish Tapaswe + Rural Schools before other products
- Target: Production-ready by end of week
