'use client';

import { useState } from 'react';
import { LinkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';

/** Shown on the owner's own recording: who can see it, share link, submit to library. */
export function OwnerBar({ mantraId, status: initial }: { mantraId: string; status: string }) {
  const { t } = useAppLanguage();
  const [status, setStatus] = useState(initial);
  const [copied, setCopied] = useState(false);
  const label = t.mantras.status[status as keyof typeof t.mantras.status] ?? status;
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const submit = async () => {
    const r = await fetch(`/api/my/mantras/${mantraId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit' }) });
    if (r.ok) setStatus('submitted');
  };
  return (
    <div className="border-b border-line bg-card-pink-light">
      <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="mr-auto text-text-secondary">{label}</span>
        <button type="button" onClick={copy} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-brand-purple">
          <LinkIcon aria-hidden className="h-4 w-4" /> {copied ? t.mantras.copied : t.mantras.share}
        </button>
        {status === 'private' && (
          <button type="button" onClick={submit} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-pink px-3 font-medium text-white">
            <PaperAirplaneIcon aria-hidden className="h-4 w-4" /> {t.mantras.submit}
          </button>
        )}
      </div>
    </div>
  );
}
