import { judgeEar, literalEar, mergeJudges } from './ears';
import { reconcile } from './reconcile';
import { asLang, guruFeedback, SAY_AGAIN } from './guru';
import { splitWords } from './phonetic';
import type { AttemptResult, ScoredWord } from './types';

export interface AnalyzeInput {
  wav: Buffer; // 16 kHz mono PCM WAV, preprocessed in the browser
  romanText: string;
  devanagariText: string;
  teacherLiteral: string | null;
  feedbackLanguage: string;
}

export async function analyzeAttempt(input: AnalyzeInput): Promise<AttemptResult> {
  const lang = asLang(input.feedbackLanguage);
  const words = splitWords(input.romanText);
  const devaWords = splitWords(input.devanagariText);
  const devanagariWords = devaWords.length === words.length ? devaWords : undefined;

  // The audio judge is not deterministic run to run, so it listens twice in parallel
  // and the stricter reading per word is kept. The literal ear still has to confirm
  // every error in reconcile(), so this raises recall without adding false alarms.
  const wavBase64 = input.wav.toString('base64');
  const judgeArgs = { wavBase64, words, devanagari: input.devanagariText };
  const [literal, j1, j2] = await Promise.all([
    literalEar(input.wav, 'attempt.wav', 'audio/wav'),
    judgeEar(judgeArgs),
    judgeEar(judgeArgs).catch(() => null),
  ]);
  const judge = j2 ? mergeJudges(j1, j2) : j1;

  const r = reconcile({
    words,
    devanagariWords,
    judge,
    studentLiteral: literal.text,
    studentNoSpeech: literal.noSpeechProb,
    teacherLiteral: input.teacherLiteral,
  });

  let guru_line = '';
  let focus: AttemptResult['focus'] = null;
  if (r.status === 'ok') {
    const g = await guruFeedback({ lang, band: r.band, words: r.words, mantraDevanagari: input.devanagariText });
    guru_line = g.guru_line;
    focus = g.focus;
  } else {
    guru_line = SAY_AGAIN[lang][r.status === 'different_mantra' ? 'different_mantra' : r.reason ?? 'unsure'];
  }

  return {
    version: 2,
    status: r.status,
    say_again_reason: r.reason,
    band: r.band,
    overall_score: r.status === 'ok' ? r.score : 0,
    confidence: r.confidence,
    words: r.words,
    focus,
    guru_line,
    feedback: guru_line,
    hindi_feedback: guru_line,
    user_transcription: literal.text,
    word_analysis: r.words.map((w: ScoredWord) => ({
      word: w.word,
      status: w.status === 'ok' ? 'correct' : w.status === 'check' ? 'needs_work' : 'incorrect',
      feedback: w.heard,
    })),
    detailed_errors: [],
    practice_suggestions: focus?.tip ? [focus.tip] : [],
  };
}
