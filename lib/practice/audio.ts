'use client';

// Word-audio helpers moved from the practice page (unchanged behaviour).
/**
 * Strip IAST diacritics and normalize for fuzzy word matching.
 * IAST "dhīmahi" → "dhimahi", "naḥ" → "nah", "pracodayāt" → "pracodayat"
 * Whisper "prachodayat" → "prachodayat", "naha" → "naha"
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks (macrons, dots, etc)
    .replace(/[^a-z]/g, '');         // remove non-alpha chars
}

/** Simple Levenshtein edit distance */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Find the best matching instructor word audio for a given word.
 * Tries: exact → lowercase → normalized exact → prefix/substring → best fuzzy.
 */
export function matchWordAudio(word: string, audioMap: Record<string, string>): string | null {
  if (!word || Object.keys(audioMap).length === 0) return null;

  // 1. Exact match
  if (audioMap[word]) return audioMap[word];

  // 2. Case-insensitive
  const lower = word.toLowerCase();
  if (audioMap[lower]) return audioMap[lower];

  // 3. Normalized exact match (strip IAST diacritics from both sides)
  const norm = normalizeWord(word);
  for (const [key, url] of Object.entries(audioMap)) {
    if (normalizeWord(key) === norm) return url;
  }

  // 4. Prefix/substring match (handle "nah" vs "naha", etc.)
  //    Accept if one starts with the other and length diff <= 2
  for (const [key, url] of Object.entries(audioMap)) {
    const normKey = normalizeWord(key);
    if (
      (normKey.startsWith(norm) || norm.startsWith(normKey)) &&
      Math.abs(normKey.length - norm.length) <= 2
    ) {
      return url;
    }
  }

  // 5. Best fuzzy match using edit distance
  //    Accept if edit distance <= 30% of the longer word
  let bestUrl: string | null = null;
  let bestDist = Infinity;
  for (const [key, url] of Object.entries(audioMap)) {
    const normKey = normalizeWord(key);
    const maxLen = Math.max(norm.length, normKey.length);
    if (maxLen === 0) continue;

    // Simple Levenshtein distance
    const dist = levenshtein(norm, normKey);
    const threshold = Math.ceil(maxLen * 0.35); // allow up to 35% edits
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestUrl = url;
    }
  }

  return bestUrl;
}

/**
 * Cache decoded AudioBuffers by URL so we only download & decode once.
 * Web Audio API gives sample-exact playback — no seeking or polling needed.
 */
const audioBufferCache: Record<string, AudioBuffer> = {};
let sharedAudioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

async function getAudioBuffer(url: string): Promise<AudioBuffer> {
  if (audioBufferCache[url]) return audioBufferCache[url];
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  audioBufferCache[url] = buffer;
  return buffer;
}

/**
 * Play a time-range of an audio file with sample-exact precision.
 * Uses Web Audio API's AudioBufferSourceNode.start(when, offset, duration)
 * which plays exactly the specified samples — no overshoot possible.
 */
export async function playTimeRange(audioUrl: string, start: number, end: number): Promise<void> {
  // Stop any currently playing word
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    activeSource = null;
  }

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const buffer = await getAudioBuffer(audioUrl);
  const duration = end - start;

  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      activeSource = null;
      resolve();
    };
    activeSource = source;
    source.start(0, start, duration); // sample-exact: plays only [start, start+duration]
  });
}

/**
 * Convert IAST Roman text to Devanagari script (client-side, no API call).
 * Handles standard Sanskrit consonants, vowels, anusvara, visarga.
 */
export function iastToDevanagari(input: string): string {
  const text = input.toLowerCase();

  const consonants: [string, string][] = [
    ['kh', 'ख'], ['gh', 'घ'], ['ch', 'छ'], ['jh', 'झ'],
    ['ṭh', 'ठ'], ['ḍh', 'ढ'], ['th', 'थ'], ['dh', 'ध'],
    ['ph', 'फ'], ['bh', 'भ'],
    ['k', 'क'], ['g', 'ग'], ['ṅ', 'ङ'],
    ['c', 'च'], ['j', 'ज'], ['ñ', 'ञ'],
    ['ṭ', 'ट'], ['ḍ', 'ड'], ['ṇ', 'ण'],
    ['t', 'त'], ['d', 'द'], ['n', 'न'],
    ['p', 'प'], ['b', 'ब'], ['m', 'म'],
    ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'],
    ['ś', 'श'], ['ṣ', 'ष'], ['s', 'स'], ['h', 'ह'],
  ];

  const indepVowels: [string, string][] = [
    ['ai', 'ऐ'], ['au', 'औ'],
    ['ā', 'आ'], ['ī', 'ई'], ['ū', 'ऊ'], ['ṛ', 'ऋ'],
    ['e', 'ए'], ['o', 'ओ'],
    ['a', 'अ'], ['i', 'इ'], ['u', 'उ'],
  ];

  const depVowels: [string, string][] = [
    ['ai', 'ै'], ['au', 'ौ'],
    ['ā', 'ा'], ['ī', 'ी'], ['ū', 'ू'], ['ṛ', 'ृ'],
    ['e', 'े'], ['o', 'ो'],
    ['a', ''], ['i', 'ि'], ['u', 'ु'],
  ];

  let result = '';
  let i = 0;
  let afterCons = false;

  while (i < text.length) {
    const ch = text[i];

    // Spaces and punctuation — flush consonant state
    if (ch === ' ' || ch === '.' || ch === ',' || ch === '|' || ch === '॥') {
      afterCons = false;
      result += ch;
      i++;
      continue;
    }

    // Anusvara / visarga
    if (ch === 'ṃ') { result += 'ं'; afterCons = false; i++; continue; }
    if (ch === 'ḥ') { result += 'ः'; afterCons = false; i++; continue; }

    // Try consonants (longest first)
    let found = false;
    for (const [lat, dev] of consonants) {
      if (text.substring(i, i + lat.length) === lat) {
        if (afterCons) result += '्'; // halant before next consonant
        result += dev;
        afterCons = true;
        i += lat.length;
        found = true;
        break;
      }
    }
    if (found) continue;

    // Try vowels
    const vowelTable = afterCons ? depVowels : indepVowels;
    for (const [lat, dev] of vowelTable) {
      if (text.substring(i, i + lat.length) === lat) {
        result += dev;
        afterCons = false;
        i += lat.length;
        found = true;
        break;
      }
    }
    if (found) continue;

    // Unknown char — pass through
    afterCons = false;
    result += ch;
    i++;
  }

  // Final consonant gets halant (standard Sanskrit)
  if (afterCons) result += '्';

  // Replace ओं with ॐ
  result = result.replace(/ओं/g, 'ॐ');

  return result;
}


export function stopTimeRange() {
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    activeSource = null;
  }
}

export interface WordBoundary { word: string; position: number; start: number; end: number }

/** Find the teacher's timing for a word: position-indexed first, fuzzy text second. */
export function findTimestamp(
  word: string,
  index: number | undefined,
  boundaries: WordBoundary[],
  timestamps: Record<string, { start: number; end: number }>,
): { start: number; end: number } | null {
  if (index != null && index >= 0 && index < boundaries.length) {
    const b = boundaries[index];
    return { start: b.start, end: b.end };
  }
  if (!word || Object.keys(timestamps).length === 0) return null;
  if (timestamps[word]) return timestamps[word];
  const norm = normalizeWord(word);
  let best: { start: number; end: number } | null = null;
  let bestDist = Infinity;
  for (const [key, ts] of Object.entries(timestamps)) {
    const nk = normalizeWord(key);
    if (nk === norm) return ts;
    const d = levenshtein(norm, nk);
    if (d <= Math.ceil(Math.max(norm.length, nk.length) * 0.35) && d < bestDist) { bestDist = d; best = ts; }
  }
  return best;
}
