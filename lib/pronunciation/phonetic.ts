
// Devanagari -> simple roman, so transcriptions in either script compare on one key.
const CONS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 's', 'ष': 's', 'स': 's', 'ह': 'h', 'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'j', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};
const VOW: Record<string, string> = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri', 'ॠ': 'ri', 'ऌ': 'li',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ॐ': 'om',
};
const MATRA: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'ॄ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
};
export function devanagariToRoman(s: string): string {
  const chars = Array.from(s.normalize('NFC'));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    if (CONS[c] !== undefined) {
      out += CONS[c];
      if (next === '\u094D') { i++; continue; } // virama: no inherent vowel
      if (next && MATRA[next] !== undefined) { out += MATRA[next]; i++; continue; }
      if (next === '\u093C') { i++; } // nukta
      out += 'a';
      continue;
    }
    if (VOW[c] !== undefined) { out += VOW[c]; continue; }
    if (c === 'ं' || c === 'ँ') { out += 'm'; continue; }
    if (c === 'ः') { out += 'h'; continue; }
    if (c === '।' || c === '॥') { out += ' '; continue; }
    out += c;
  }
  // Word-final inherent 'a' is usually silent in Hindi-style transcription but
  // pronounced in Sanskrit; keep it, the phonetic key tolerates the difference.
  return out;
}

/**
 * Phonetic keys for comparing romanised transcriptions from different ears.
 * Collapses spelling variants (sh/s, aa/a, w/v, aspirate h) so only real sound
 * differences survive, then projects reference word boundaries onto a free-form
 * transcription with a character-level alignment.
 */

export function phoneticKey(s: string): string {
  let k = devanagariToRoman(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ');
  const pairs: [string, string][] = [
    ['sh', 's'], ['ch', 'c'], ['ph', 'p'], ['th', 't'], ['dh', 'd'], ['bh', 'b'],
    ['gh', 'g'], ['kh', 'k'], ['jh', 'j'], ['aa', 'a'], ['ee', 'i'], ['oo', 'u'],
    ['w', 'v'], ['z', 'j'],
  ];
  for (const [a, b] of pairs) k = k.split(a).join(b);
  return k.replace(/([a-z])\1+/g, '$1');
}

/**
 * Spelling variants that are not sound differences between two transcriptions:
 * aum/om, a final inherent vowel dropped Hindi-style (shivay/shivaya), and the
 * visarga echo written out (namaha/namah).
 */
export function normalizeWordKey(k: string): string {
  if (/^(aum|aun|oum|om)$/.test(k)) return 'om';
  return k.replace(/aha$/, 'ah').replace(/([^aeiou])a$/, '$1');
}

export function wordKeys(s: string): string[] {
  return phoneticKey(s).split(/\s+/).filter(Boolean).map(normalizeWordKey);
}

/** Ratcliff/Obershelp similarity, same as Python difflib.SequenceMatcher.ratio(). */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const matches = countMatches(a, b);
  return (2 * matches) / (a.length + b.length);
}

function countMatches(a: string, b: string): number {
  const [i, j, n] = longestCommon(a, b);
  if (n === 0) return 0;
  return n + countMatches(a.slice(0, i), b.slice(0, j)) + countMatches(a.slice(i + n), b.slice(j + n));
}

function longestCommon(a: string, b: string): [number, number, number] {
  let best: [number, number, number] = [0, 0, 0];
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best[2]) best = [i - cur[j], j - cur[j], cur[j]];
      }
    }
    prev = cur;
  }
  return best;
}

/** Map of a-index -> b-index for matched characters, from recursive LCS blocks. */
function matchMap(a: string, b: string, offA = 0, offB = 0, out = new Map<number, number>()) {
  const [i, j, n] = longestCommon(a, b);
  if (n === 0) return out;
  matchMap(a.slice(0, i), b.slice(0, j), offA, offB, out);
  for (let k = 0; k < n; k++) out.set(offA + i + k, offB + j + k);
  matchMap(a.slice(i + n), b.slice(j + n), offA + i + n, offB + j + n, out);
  return out;
}

/** For each reference word key, the substring of the transcription aligned to it. */
export function projectWords(refKeys: string[], transcription: string): string[] {
  const R = refKeys.join('');
  const L = wordKeys(transcription).join('');
  const m = matchMap(R, L);
  const out: string[] = [];
  let pos = 0;
  for (const w of refKeys) {
    const idx: number[] = [];
    for (let i = pos; i < pos + w.length; i++) if (m.has(i)) idx.push(m.get(i)!);
    pos += w.length;
    out.push(idx.length ? L.slice(Math.min(...idx), Math.max(...idx) + 1) : '');
  }
  return out;
}

/** Split a romanised mantra into display words (keeps original spelling). */
export function splitWords(roman: string): string[] {
  return roman
    .replace(/[|।॥,.;:!?"“”]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}
