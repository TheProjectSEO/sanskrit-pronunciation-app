export type WordStatus = 'ok' | 'check' | 'wrong';
export type Issue =
  | 'none' | 'vowel_length' | 'aspiration' | 'retroflex' | 'sibilant'
  | 'visarga' | 'anusvara' | 'substitution' | 'missing' | 'extra' | 'other';
export type Band = 'close' | 'getting_there' | 'needs_practice';
export type AttemptStatus = 'ok' | 'say_again' | 'different_mantra';
export type SayAgainReason = 'unclear' | 'noisy' | 'too_quiet' | 'unsure';

export interface JudgeWord {
  expected: string;
  heard: string;
  status: 'ok' | 'minor' | 'wrong' | 'missing';
  issue: Issue;
  confidence: number;
}

export interface JudgeResult {
  recited_same_mantra: boolean;
  words: JudgeWord[];
  extra_words: string[];
  audio_quality: 'clear' | 'noisy' | 'too_quiet' | 'silent';
  overall_confidence: number;
}

export interface LiteralResult {
  text: string;
  noSpeechProb: number;
}

export interface ScoredWord {
  word: string;
  devanagari?: string;
  status: WordStatus;
  heard?: string;
  issue?: Issue;
}

export interface AttemptResult {
  version: 2;
  status: AttemptStatus;
  say_again_reason?: SayAgainReason;
  band: Band;
  overall_score: number;
  confidence: number;
  words: ScoredWord[];
  focus: { word: string; devanagari?: string; issue: Issue; tip: string } | null;
  guru_line: string;
  // Legacy fields kept so older clients keep rendering.
  feedback: string;
  hindi_feedback: string;
  user_transcription: string;
  word_analysis: { word: string; status: 'correct' | 'needs_work' | 'incorrect'; feedback?: string }[];
  detailed_errors: unknown[];
  practice_suggestions: string[];
  /** Row in pronunciation_logs, so the learner can say whether the verdict was right. */
  log_id?: string | null;
  /** What each ear heard; returned to admins only (Check screen). */
  debug?: AttemptDebug;
}

export interface AttemptDebug {
  literal: string;
  teacher_literal: string | null;
  judge: { expected: string; heard: string; status: string; issue: string; confidence: number }[];
  teacher_habits: { expected: string; heard: string }[];
  confidence: number;
}
