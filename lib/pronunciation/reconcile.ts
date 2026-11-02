import { projectWords, similarity, wordKeys } from './phonetic';
import type { AttemptStatus, Band, Issue, JudgeResult, SayAgainReason, ScoredWord } from './types';

/** A word counts as deviating from the teacher below this literal similarity. */
export const DEVIATION = 0.95;
/** Below this combined confidence we ask the student to say it again instead of scoring. */
export const GATE = 0.6;

export interface Reconciled {
  status: AttemptStatus;
  reason?: SayAgainReason;
  band: Band;
  score: number;
  confidence: number;
  words: ScoredWord[];
}

/**
 * Two independent ears vote. The judge (hears audio + expected text) proposes errors;
 * the literal ear (hears audio only) confirms that the student's sound differs from the
 * teacher's sound at that word. An error is reported only when both agree, so a
 * judge hallucination or a textbook-vs-lineage difference is not shown to the student.
 */
export function reconcile(opts: {
  words: string[];
  devanagariWords?: string[];
  judge: JudgeResult;
  studentLiteral: string;
  studentNoSpeech: number;
  teacherLiteral: string | null;
}): Reconciled {
  const { words, judge } = opts;
  const refKeys = words.map((w) => wordKeys(w).join('')).map((k) => k || '_');
  const teacherSource = opts.teacherLiteral || words.join(' ');
  const teacherProj = projectWords(refKeys, teacherSource);
  const studentProj = projectWords(refKeys, opts.studentLiteral);

  const base = { band: 'needs_practice' as Band, score: 0, confidence: 0, words: words.map((w) => ({ word: w, status: 'ok' as const })) };

  const studentKey = wordKeys(opts.studentLiteral).join('');
  if (studentKey.length < 3 || opts.studentNoSpeech > 0.6 || judge.audio_quality === 'silent') {
    return { ...base, status: 'say_again', reason: 'unclear' };
  }
  if (judge.audio_quality === 'noisy') return { ...base, status: 'say_again', reason: 'noisy' };
  if (judge.audio_quality === 'too_quiet') return { ...base, status: 'say_again', reason: 'too_quiet' };

  // Different mantra: most words have no counterpart in what the literal ear heard,
  // and the judge agrees the recitation does not match.
  const n0 = Math.max(1, words.length);
  const unmatched = words.filter((_, i) => similarity(teacherProj[i], studentProj[i]) < 0.6).length / n0;
  const judgeMiss = judge.words.filter((w) => w.status === 'wrong' || w.status === 'missing').length / n0;
  // Short mantras share words like "om" and "namah", so also compare overall length:
  // a recitation far longer or shorter than the teacher's, judged different, is different.
  const lengthRatio = studentKey.length / Math.max(1, wordKeys(teacherSource).join('').length);
  const offLength = lengthRatio > 1.5 || lengthRatio < 0.55;
  const overallSim = similarity(wordKeys(teacherSource).join(''), studentKey);
  const judgeSaysDifferent = !judge.recited_same_mantra && judgeMiss >= 0.5 && overallSim < 0.65;
  if ((unmatched >= 0.5 && (!judge.recited_same_mantra || judgeMiss >= 0.5)) || (offLength && !judge.recited_same_mantra && unmatched >= 0.3) || judgeSaysDifferent) {
    return { ...base, status: 'different_mantra' };
  }

  let agree = 0;
  let points = 0;
  const scored: ScoredWord[] = words.map((word, i) => {
    const jw = judge.words[i];
    const sim = similarity(teacherProj[i], studentProj[i]);
    const deviates = sim < DEVIATION;
    const flagged = jw.status !== 'ok';
    if (flagged === deviates) agree++;
    let status: ScoredWord['status'] = 'ok';
    if (flagged && deviates) status = jw.status === 'minor' ? 'check' : 'wrong';
    points += status === 'ok' ? 1 : status === 'check' ? 0.5 : 0;
    return {
      word,
      devanagari: opts.devanagariWords?.[i],
      status,
      heard: status === 'ok' ? undefined : jw.heard || studentProj[i] || undefined,
      issue: status === 'ok' ? undefined : (jw.issue as Issue),
    };
  });

  const n = Math.max(1, words.length);
  const confidence = round2(0.5 * (agree / n) + 0.5 * judge.overall_confidence);
  const score = Math.round((100 * points) / n);
  const band: Band = score >= 85 ? 'close' : score >= 60 ? 'getting_there' : 'needs_practice';

  if (confidence < GATE) {
    return { status: 'say_again', reason: 'unsure', band, score, confidence, words: scored };
  }
  return { status: 'ok', band, score, confidence, words: scored };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
