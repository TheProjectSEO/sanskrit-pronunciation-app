'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { PlayIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';
import type { AttemptResult } from '@/lib/pronunciation/types';
import type { PracticeCopy } from '@/lib/practice/copy';

interface Props {
  result: AttemptResult;
  copy: PracticeCopy;
  langAttr: string;
  onHearGuru: () => void;
  guruSpeaking: boolean;
  onHearTeacher: () => void;
  onHearYourself: (() => void) | null;
  onHearFocusWord: () => void;
  onPracticeFocusWord: () => void;
}

/**
 * The guru speaks first. The band is words, not a number. One correction arrives
 * as an errata slip; everything else stays marked on the folio above.
 */
export function ResultPanel({ result, copy, langAttr, onHearGuru, guruSpeaking, onHearTeacher, onHearYourself, onHearFocusWord, onPracticeFocusWord }: Props) {
  const reduce = useReducedMotion();
  const ok = result.status === 'ok';

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      {ok && (
        <p className={`flex items-center gap-2 text-xl font-semibold ${result.band === 'close' ? 'text-leaf' : 'text-ink'}`} lang={langAttr}>
          {result.band === 'close' && <span aria-hidden className="font-mantra text-2xl">✓</span>}
          {copy.bands[result.band]}
        </p>
      )}

      <div className="flex items-start gap-3">
        <p className="flex-1 text-[1.2rem] leading-relaxed text-ink" lang={langAttr}>{result.guru_line}</p>
        <button
          type="button"
          onClick={onHearGuru}
          aria-label={copy.hearGuru}
          aria-pressed={guruSpeaking}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-paper-edge bg-paper-deep text-cloth hover:bg-paper-edge/40"
        >
          <SpeakerWaveIcon aria-hidden className={`h-6 w-6 ${guruSpeaking ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {ok && result.focus && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14, rotate: -0.6 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-md border border-sindoor/40 bg-sindoor-wash px-4 pt-3 pb-4 shadow-[0_6px_16px_-8px_rgba(92,26,18,0.45)]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span lang="sa" className="font-mantra text-[2.2rem] leading-tight text-sindoor">{result.focus.devanagari || result.focus.word}</span>
            <span lang="sa-Latn" className="font-mantra text-lg italic text-ink-soft">{result.focus.word}</span>
          </div>
          {result.words.find((w) => w.word === result.focus!.word)?.heard && (
            <p className="mt-1 text-[0.95rem] text-ink-soft" lang={langAttr}>
              {copy.heard}: <span lang="sa-Latn" className="font-mantra italic text-ink">{result.words.find((w) => w.word === result.focus!.word)!.heard}</span>
            </p>
          )}
          {result.focus.tip && <p className="mt-2 text-[1.05rem] leading-relaxed text-ink" lang={langAttr}>{result.focus.tip}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onHearFocusWord} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-cloth/30 bg-paper px-4 text-ink hover:bg-paper-deep">
              <PlayIcon aria-hidden className="h-5 w-5 text-cloth" /> {copy.hearTeacher}
            </button>
            <button type="button" onClick={onPracticeFocusWord} className="inline-flex min-h-12 items-center rounded-full bg-cloth px-5 font-semibold text-cloth-ink hover:brightness-110">
              {copy.practiceWord}
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2" role="group" aria-label={`${copy.hearTeacher} / ${copy.hearYourself}`}>
        <button type="button" onClick={onHearTeacher} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-paper-edge bg-paper-deep text-ink hover:bg-paper-edge/40">
          <PlayIcon aria-hidden className="h-5 w-5 text-cloth" /> {copy.hearTeacher}
        </button>
        {onHearYourself && (
          <button type="button" onClick={onHearYourself} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-paper-edge bg-paper-deep text-ink hover:bg-paper-edge/40">
            <PlayIcon aria-hidden className="h-5 w-5 text-cloth" /> {copy.hearYourself}
          </button>
        )}
      </div>

      {ok && <p className="text-sm text-ink-soft" lang={langAttr}>{copy.bandNote}</p>}
    </div>
  );
}
