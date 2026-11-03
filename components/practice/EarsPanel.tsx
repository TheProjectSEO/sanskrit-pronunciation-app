'use client';

import type { AttemptDebug } from '@/lib/pronunciation/types';

const MARK: Record<string, string> = { ok: 'text-success', minor: 'text-warning', wrong: 'text-danger', missing: 'text-danger' };

/**
 * Admin-only view of one attempt: what the literal ear wrote, what the judge heard per
 * word, and which words the judge also mishears in the teacher (excused as style).
 */
export function EarsPanel({ debug }: { debug: AttemptDebug }) {
  const habit = new Map(debug.teacher_habits.map((h) => [h.expected, h.heard]));
  return (
    <details className="rounded-[15px] border border-line-strong bg-card-blue/40 p-4 text-sm" open>
      <summary className="cursor-pointer font-bold text-brand-purple">What the ears heard (admin)</summary>
      <dl className="mt-3 grid gap-2">
        <div><dt className="text-text-secondary">Literal ear (student)</dt><dd className="font-mantra text-base text-text-primary">{debug.literal || '—'}</dd></div>
        <div><dt className="text-text-secondary">Literal ear (teacher)</dt><dd className="font-mantra text-base text-text-primary">{debug.teacher_literal || '—'}</dd></div>
        <div><dt className="text-text-secondary">Confidence</dt><dd className="text-text-primary">{debug.confidence}</dd></div>
      </dl>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-text-secondary"><tr><th className="py-1 pr-3 font-medium">Word</th><th className="py-1 pr-3 font-medium">Judge heard</th><th className="py-1 pr-3 font-medium">Verdict</th><th className="py-1 font-medium">Teacher style</th></tr></thead>
          <tbody>
            {debug.judge.map((w, i) => (
              <tr key={i} className="border-t border-line">
                <td className="font-mantra py-1.5 pr-3 text-text-primary">{w.expected}</td>
                <td className="font-mantra py-1.5 pr-3 text-text-primary">{w.heard || '—'}</td>
                <td className={`py-1.5 pr-3 font-medium ${MARK[w.status] ?? ''}`}>{w.status}{w.issue && w.issue !== 'none' ? ` · ${w.issue}` : ''} <span className="text-text-secondary">({w.confidence})</span></td>
                <td className="font-mantra py-1.5 text-text-secondary">{habit.get(w.expected) ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
