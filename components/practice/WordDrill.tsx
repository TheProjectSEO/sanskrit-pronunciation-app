'use client';

import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, PlayIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useRecorder, type Take } from '@/lib/practice/useRecorder';
import type { PracticeCopy } from '@/lib/practice/copy';
import type { AttemptResult } from '@/lib/pronunciation/types';

interface Props {
  word: { roman: string; devanagari: string };
  mantraId: string;
  language: string;
  langAttr: string;
  copy: PracticeCopy;
  onHearTeacher: () => void;
  onClose: () => void;
}

export function WordDrill({ word, mantraId, language, langAttr, copy, onHearTeacher, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const lastTake = useRef<Take | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const send = async (t: Take) => {
    lastTake.current = t;
    setBusy(true);
    setNetError(null);
    try {
      const fd = new FormData();
      fd.append('audio', t.wav, 'word.wav');
      fd.append('mantra_id', mantraId);
      fd.append('reference_word', word.roman);
      fd.append('reference_word_devanagari', word.devanagari);
      fd.append('feedback_language', language);
      const res = await fetch('/api/analyze-word', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || copy.errors.network);
      setResult(data as AttemptResult);
    } catch (e) {
      setNetError(e instanceof Error ? e.message : copy.errors.network);
    } finally {
      setBusy(false);
    }
  };
  const rec = useRecorder(send);

  useEffect(() => {
    opener.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const status = result?.status === 'ok' ? result.words[0]?.status : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button type="button" aria-label={copy.close} tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        className="relative w-full max-w-xl rounded-t-2xl border-t-[3px] border-double border-paper-edge bg-paper px-5 pt-4 shadow-[0_-12px_32px_-12px_rgba(43,26,16,0.5)]"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 id="drill-title" className="text-lg font-semibold text-ink" lang={langAttr}>{copy.wordDrillTitle}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={copy.close} className="flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep">
            <XMarkIcon aria-hidden className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-2 text-center">
          <p lang="sa" className={`font-mantra text-[3.25rem] leading-tight ${status && status !== 'ok' ? 'text-sindoor' : 'text-ink'}`}>{word.devanagari}</p>
          <p lang="sa-Latn" className="font-mantra text-xl italic text-ink-soft">{word.roman}</p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button type="button" onClick={onHearTeacher} className="inline-flex min-h-14 items-center gap-2 rounded-full border border-paper-edge bg-paper-deep px-5 text-ink hover:bg-paper-edge/40">
            <PlayIcon aria-hidden className="h-5 w-5 text-cloth" /> {copy.hearTeacher}
          </button>
          <button
            type="button"
            onClick={rec.recording ? rec.stop : rec.start}
            disabled={busy || rec.preparing}
            aria-label={rec.recording ? copy.stopChant : copy.startChant}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-cloth-ink shadow-[0_6px_14px_-6px_rgba(43,26,16,0.6)] disabled:opacity-60 ${rec.recording ? 'bg-sindoor ring-4 ring-marigold/70' : 'bg-cloth'}`}
          >
            {rec.recording ? <StopIcon aria-hidden className="h-8 w-8" /> : <MicrophoneIcon aria-hidden className="h-8 w-8" />}
          </button>
        </div>

        <div className="mt-5 min-h-16 text-center" aria-live="polite" lang={langAttr}>
          {(busy || rec.preparing) && <p className="text-ink-soft">{copy.listening}</p>}
          {rec.error && <p className="text-sindoor">{rec.error === 'micDenied' ? `${copy.errors.micDenied} ${copy.errors.micDeniedSteps}` : copy.errors[rec.error]}</p>}
          {netError && (
            <p className="text-sindoor">
              {netError}{' '}
              {lastTake.current && <button type="button" className="min-h-12 font-semibold underline underline-offset-4" onClick={() => send(lastTake.current!)}>{copy.errors.retry}</button>}
            </p>
          )}
          {result && !busy && <p className="text-[1.1rem] leading-relaxed text-ink">{result.guru_line}</p>}
        </div>

        {result?.status === 'ok' && status === 'ok' && (
          <button type="button" onClick={onClose} className="mt-3 min-h-14 w-full rounded-xl bg-cloth text-lg font-semibold text-cloth-ink">{copy.done}</button>
        )}
      </div>
    </div>
  );
}
