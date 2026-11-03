'use client';

import type { PracticeCopy } from '@/lib/practice/copy';

export interface Attempt { at: string; score: number }

interface Props {
  attempts: Attempt[];
  copy: PracticeCopy;
  langAttr: string;
}

const CLOSE = 85; // band threshold for "close" in lib/pronunciation/reconcile.ts
const W = 320;
const H = 96;
const PAD = 8;

/** Mean of the first and last five scored attempts: steadier than first vs last. */
function ends(scores: number[]) {
  const k = Math.min(5, Math.floor(scores.length / 2));
  const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return { first: mean(scores.slice(0, k)), now: mean(scores.slice(-k)) };
}

/**
 * Each attempt is a bead on a thread, read left to right like a mala. The dashed
 * rule is where the verdict becomes "close to the teacher".
 */
export function ProgressTrail({ attempts, copy, langAttr }: Props) {
  if (attempts.length < 2) return null;
  const scores = attempts.map((a) => a.score);
  const { first, now } = ends(scores);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (scores.length - 1);
  const y = (s: number) => PAD + ((100 - s) * (H - 2 * PAD)) / 100;
  const path = scores.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ');

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-2 rounded-md border border-line-strong bg-card-purple-light/50 px-4 py-3" lang={langAttr}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="progress-title" className="text-[1.05rem] font-semibold text-text-primary">{copy.progressTitle}</h2>
        <span className="text-sm text-text-secondary">{copy.progressCount(scores.length)}</span>
      </div>
      <p className="flex items-baseline gap-2 text-text-primary">
        <span className="text-text-secondary">{copy.progressFirst}</span>
        <span className="tabular-nums text-lg">{first}%</span>
        <span aria-hidden className="text-text-secondary">→</span>
        <span className="text-text-secondary">{copy.progressNow}</span>
        <span className={`tabular-nums text-2xl font-semibold ${now >= CLOSE ? 'text-success' : now > first ? 'text-brand-pink' : 'text-text-primary'}`}>{now}%</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={`${copy.progressFirst} ${first}%, ${copy.progressNow} ${now}%`} preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={y(CLOSE)} y2={y(CLOSE)} className="stroke-success/60" strokeDasharray="3 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" className="stroke-line-strong" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {scores.map((s, i) => (
          <circle key={i} cx={x(i)} cy={y(s)} r={i === scores.length - 1 ? 4.5 : 3} className={s >= CLOSE ? 'fill-success' : 'fill-brand-pink'} />
        ))}
      </svg>
    </section>
  );
}
