/**
 * Cuts a teacher's recording into one clip per mantra word, so tapping a word plays
 * that word and nothing of its neighbours.
 *
 * Whisper's word timestamps are only a rough guide (they routinely run 0.1 to 0.2 s into
 * the next word). Where the teacher paused between two words, the cut moves into that
 * silence; each clip is then trimmed to where the voice starts and stops. Clips never
 * cross a cut, so nothing bleeds across. Continuous chanting keeps Whisper's boundary,
 * because dips inside words (consonant closures) are not word boundaries.
 */

export interface Span {
  start: number;
  end: number;
}

const RATE = 16000;
const HOP = 0.01; // 10 ms frames
const WIN = 0.025; // 25 ms analysis window
const PAD_BEFORE = 0.04; // soft consonant onsets (ś, s, h) start quietly
const PAD_AFTER = 0.06; // let a long vowel or anusvāra ring out
const MIN_WORD = 0.12;

/** RMS energy per 10 ms frame, lightly smoothed. */
export function frameEnergy(pcm: Int16Array): Float32Array {
  const hop = Math.round(RATE * HOP);
  const win = Math.round(RATE * WIN);
  const n = Math.max(0, Math.floor((pcm.length - win) / hop) + 1);
  const raw = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    const o = f * hop;
    for (let i = 0; i < win; i++) sum += pcm[o + i] * pcm[o + i];
    raw[f] = Math.sqrt(sum / win);
  }
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) out[f] = (raw[Math.max(0, f - 1)] + raw[f] + raw[Math.min(n - 1, f + 1)]) / 3;
  return out;
}

function percentile(a: Float32Array, p: number) {
  const s = Array.from(a).sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))] ?? 0;
}

/** Rough syllable weight of an IAST/roman word, for spacing cuts when there is no usable guess. */
export function syllables(word: string): number {
  const m = word.toLowerCase().normalize('NFC').match(/ai|au|[aāiīuūṛṝḷeoे]/g);
  return Math.max(1, m?.length ?? 1);
}

const plain = (w: string) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

/**
 * Per-word guesses for the mantra's own words from Whisper's words, even when Whisper
 * split or joined them differently ("tat savitur" vs "tatsavitur"): both are laid out
 * letter by letter and each mantra word takes the time of its share of the letters.
 */
export function projectRough(words: string[], heard: { word: string; start: number; end: number }[]): Span[] | null {
  const h = heard.filter((w) => plain(w.word));
  if (!h.length) return null;
  if (h.length === words.length) return h.map(({ start, end }) => ({ start, end }));
  const hl = h.map((w) => plain(w.word).length);
  const HL = hl.reduce((a, b) => a + b, 0);
  const rl = words.map((w) => Math.max(1, plain(w).length));
  const RL = rl.reduce((a, b) => a + b, 0);
  const timeAt = (c: number) => {
    let acc = 0;
    for (let k = 0; k < h.length; k++) {
      if (c <= acc + hl[k] || k === h.length - 1) return h[k].start + (Math.min(Math.max(c - acc, 0), hl[k]) / hl[k]) * (h[k].end - h[k].start);
      acc += hl[k];
    }
    return h[h.length - 1].end;
  };
  let acc = 0;
  return words.map((_, i) => {
    const a = (acc / RL) * HL;
    acc += rl[i];
    const b = (acc / RL) * HL;
    return { start: timeAt(a), end: timeAt(b) };
  });
}

/**
 * One span per word, in order.
 * @param rough optional per-word guesses, one per word (see projectRough).
 * @param aligned true when `rough` comes from the forced aligner: its spans are each
 *   word's core, so a cut may go anywhere in the gap between two cores (never inside a
 *   word) and lands on the quietest point there.
 */
export function alignWords(pcm: Int16Array, words: string[], rough?: Span[] | null, aligned = false): Span[] {
  const e = frameEnergy(pcm);
  const n = e.length;
  if (!n || !words.length) return [];
  const t = (f: number) => f * HOP;
  const fr = (s: number) => Math.min(n - 1, Math.max(0, Math.round(s / HOP)));

  const floor = percentile(e, 0.1);
  const peak = percentile(e, 0.98) || 1;
  const thr = floor + 0.06 * (peak - floor); // edges of words (soft ś, trailing ā)
  const strong = floor + 0.15 * (peak - floor); // clearly chanting, not breath or a click
  const voiced = (f: number) => e[f] > thr;

  // Speech region: first and last 80 ms of clearly voiced sound, so a click or breath
  // before the chant is not taken as its start.
  const RUN = 8;
  const run = (f: number, dir: 1 | -1) => {
    for (let k = 0; k < RUN; k++) if (!(e[f + dir * k] > strong)) return false;
    return true;
  };
  let s0 = 0;
  while (s0 < n - RUN && !run(s0, 1)) s0++;
  let s1 = n - 1;
  while (s1 > RUN && !run(s1, -1)) s1--;
  if (s1 <= s0) return words.map(() => ({ start: t(s0), end: t(s1) }));

  // Prior positions of the N-1 cuts, and how far each may move.
  let priors: number[];
  let reach: number;
  if (rough && rough.length === words.length) {
    priors = rough.slice(0, -1).map((r, i) => (r.end + rough[i + 1].start) / 2);
    reach = 0.18;
  } else {
    const w = words.map(syllables);
    const total = w.reduce((a, b) => a + b, 0);
    const span = t(s1) - t(s0);
    let acc = 0;
    priors = w.slice(0, -1).map((x) => t(s0) + ((acc += x) / total) * span);
    reach = Math.max(0.15, Math.min(0.5, (0.4 * span) / words.length));
  }

  // Move a cut only into a real break near its prior: silence, or a deep, brief dip
  // (under 35% of the voice on both sides, as between śrī and rā). Shallower dips are
  // usually consonant closures inside a word (the m of namaḥ), so the prior stands there.
  const side = (f: number, dir: 1 | -1) => {
    let m = 0;
    for (let k = 3; k <= 12; k++) m = Math.max(m, e[Math.min(n - 1, Math.max(0, f + dir * k))]);
    return m;
  };
  const isBreak = (f: number) =>
    !voiced(f) || (e[f] < 0.35 * side(f, -1) && e[f] < 0.35 * side(f, 1));
  const cuts: number[] = [];
  let prev = s0;
  if (aligned && rough && rough.length === words.length) {
    for (let i = 0; i < words.length - 1; i++) {
      const a = Math.max(prev + 1, fr(rough[i].end));
      const b = Math.max(a, fr(rough[i + 1].start));
      // Quietest point between two aligned words. (Leaning the cut toward the next word
      // was tried: it let the soft s of svāhā into rādhāyai, because the aligner can place
      // a quiet onset late.)
      let best = a;
      for (let f = a; f <= b; f++) if (e[f] < e[best]) best = f;
      cuts.push(best);
      prev = best;
    }
  } else for (const p of priors) {
    const lo = Math.max(prev + Math.round(MIN_WORD / HOP), fr(p - reach));
    const hi = Math.min(s1 - Math.round(MIN_WORD / HOP), fr(p + reach));
    let best = Math.max(lo, Math.min(fr(p), Math.max(lo, hi)));
    let bestScore = Infinity;
    for (let f = lo; f <= hi; f++) {
      if (!isBreak(f)) continue;
      // Prefer the deepest point of a break, then the one nearest the prior.
      const score = (e[f] - floor) / (peak - floor) + 0.15 * (Math.abs(t(f) - p) / reach);
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    cuts.push(best);
    prev = best;
  }

  // Trim each word to its voiced part inside its two cuts.
  const left = [Math.max(0, s0 - Math.round(0.3 / HOP)), ...cuts];
  const right = [...cuts, Math.min(n - 1, s1 + Math.round(0.3 / HOP))];
  return words.map((_, i) => {
    const a = left[i];
    const b = right[i];
    const v3 = (f: number) => voiced(f) && voiced(Math.min(n - 1, f + 1)) && voiced(Math.min(n - 1, f + 2));
    let on = a;
    while (on < b && !v3(on)) on++;
    let off = b;
    while (off > on && !(voiced(off) && voiced(Math.max(0, off - 1)) && voiced(Math.max(0, off - 2)))) off--;
    if (off <= on) {
      on = a;
      off = b;
    }
    return {
      start: +Math.max(t(a), t(on) - PAD_BEFORE).toFixed(3),
      end: +Math.min(t(b), t(off) + WIN + PAD_AFTER).toFixed(3),
    };
  });
}

/** 16 kHz mono s16le bytes to samples. */
export function pcmSamples(buf: Buffer): Int16Array {
  const copy = new Uint8Array(buf); // own, aligned ArrayBuffer (pooled Buffers can sit at odd offsets)
  return new Int16Array(copy.buffer, 0, Math.floor(copy.byteLength / 2));
}
