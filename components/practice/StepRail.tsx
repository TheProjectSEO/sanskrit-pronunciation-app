'use client';

import { CheckIcon } from '@heroicons/react/20/solid';

/** Listen → Repeat → Guru. The current step is pink; done steps carry a tick. */
export function StepRail({ steps, current }: { steps: [string, string, string]; current: 0 | 1 | 2 }) {
  return (
    <ol className="flex items-center justify-center gap-2 text-[0.95rem]" aria-label="steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className="h-px w-5 bg-line-strong" />}
          <span className={`flex items-center gap-1 ${i === current ? 'font-semibold text-brand-pink' : i < current ? 'text-brand-purple' : 'text-text-secondary'}`}>
            {i < current && <CheckIcon aria-hidden className="h-4 w-4 text-success" />}
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}
