'use client';

import { useEffect, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import type { PracticeCopy } from '@/lib/practice/copy';

export type CheckStage = 'sending' | 'listening';

/** Typical end-to-end time to a verdict, measured 3 Nov 2026; the bar never claims to be done before it is. */
const TYPICAL_MS = 8000;

/**
 * What is happening while an attempt is checked. Each step turns when the server says
 * so; the bar is an estimate against the typical time and stops short of full.
 */
export function CheckProgress({ stage, copy, langAttr }: { stage: CheckStage; copy: PracticeCopy; langAttr: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - t0), 250);
    return () => window.clearInterval(id);
  }, []);

  // Eases toward 92% so a slow check keeps moving without ever looking finished.
  const pct = Math.round(92 * (1 - Math.exp(-elapsed / (TYPICAL_MS * 0.55))));
  const steps: { key: CheckStage; label: string }[] = [
    { key: 'sending', label: copy.progress.sending },
    { key: 'listening', label: copy.progress.listening },
  ];
  const at = steps.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card-purple-light p-5" role="status" aria-live="polite" lang={langAttr}>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const done = i < at;
          const active = i === at;
          return (
            <li key={s.key} className={`flex items-center gap-3 text-[1.02rem] ${active ? 'font-medium text-text-primary' : done ? 'text-text-secondary' : 'text-text-secondary/60'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-success text-white' : active ? 'bg-brand-pink/15' : 'border border-line-strong'}`}>
                {done ? <CheckIcon aria-hidden className="h-4 w-4" /> : active ? <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-pink" /> : null}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-purple" aria-hidden>
        <div className="h-full rounded-full bg-brand-pink transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="flex justify-between text-sm text-text-secondary">
        <span>{copy.progress.usually}</span>
        <span className="tabular-nums">{Math.floor(elapsed / 1000)} s</span>
      </p>
    </div>
  );
}
