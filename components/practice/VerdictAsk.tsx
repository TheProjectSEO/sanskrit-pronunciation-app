'use client';

import { useState } from 'react';
import type { PracticeCopy } from '@/lib/practice/copy';

interface Props {
  logId: string;
  wav: Blob | null;
  copy: PracticeCopy;
  langAttr: string;
}

/**
 * One quiet question under the verdict. Each answer, with its recording, becomes a
 * labelled example for the evaluation set, which is how accuracy gets measured on
 * real learners instead of guessed.
 */
export function VerdictAsk({ logId, wav, copy, langAttr }: Props) {
  const [sent, setSent] = useState<'right' | 'wrong' | null>(null);

  const send = (verdict: 'right' | 'wrong') => {
    setSent(verdict);
    const fd = new FormData();
    fd.append('verdict', verdict);
    if (wav) fd.append('audio', wav, 'attempt.wav');
    fetch(`/api/attempts/${logId}/verdict`, { method: 'POST', body: fd }).catch(() => {});
  };

  if (sent) {
    return <p className="text-[0.95rem] leading-relaxed text-ink-soft" lang={langAttr} role="status">{copy.verdictThanks}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed border-paper-edge pt-3" lang={langAttr}>
      <span className="text-[0.95rem] text-ink-soft">{copy.verdictAsk}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => send('right')} className="inline-flex min-h-12 items-center rounded-full border border-paper-edge px-4 text-ink hover:bg-paper-deep">
          {copy.verdictYes}
        </button>
        <button type="button" onClick={() => send('wrong')} className="inline-flex min-h-12 items-center rounded-full border border-paper-edge px-4 text-ink hover:bg-paper-deep">
          {copy.verdictNo}
        </button>
      </div>
    </div>
  );
}
