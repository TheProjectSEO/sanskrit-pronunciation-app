'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LinkIcon, PaperAirplaneIcon, PlayIcon, TrashIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';

interface Mine { id: string; name: string; status: 'private' | 'submitted' | 'rejected' | 'published'; reference_text_devanagari: string }

const BADGE: Record<Mine['status'], string> = {
  private: 'bg-card-purple text-brand-purple',
  submitted: 'bg-warning-bg text-warning',
  rejected: 'bg-danger-bg text-danger',
  published: 'bg-success-bg text-success',
};

/** The user's own recordings, with share, submit and delete. */
export function MyRecordings() {
  const { t } = useAppLanguage();
  const [items, setItems] = useState<Mine[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = () => fetch('/api/my/mantras').then((r) => (r.ok ? r.json() : { mantras: [] })).then((d) => setItems(d.mantras || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const share = async (id: string) => {
    const url = `${window.location.origin}/practice/${id}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt?.('', url); }
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  const act = async (id: string, action: 'submit' | 'withdraw') => {
    await fetch(`/api/my/mantras/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  };
  const remove = async (id: string) => {
    await fetch(`/api/my/mantras/${id}`, { method: 'DELETE' });
    setConfirm(null);
    load();
  };

  if (!items) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-pink" /></div>;
  if (!items.length) {
    return (
      <div className="mx-auto mt-6 max-w-md rounded-2xl bg-card-purple p-8 text-center">
        <MicrophoneIcon aria-hidden className="mx-auto mb-3 h-10 w-10 text-brand-pink" />
        <p className="font-medium text-brand-purple">{t.mantras.mineEmpty}</p>
        <Link href="/record" className="mt-4 inline-block rounded-xl bg-brand-pink px-6 py-3 font-semibold text-white hover:bg-brand-pink-hover">{t.mantras.recordOne}</Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li key={m.id} className="rounded-[15px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-brand-purple">{m.name}</h3>
              <p lang="sa" className="font-mantra truncate text-text-primary">{m.reference_text_devanagari}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[m.status]}`}>{t.mantras.status[m.status]}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/practice/${m.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-purple px-4 text-sm font-medium text-white hover:bg-brand-purple-hover">
              <PlayIcon aria-hidden className="h-4 w-4" /> {t.mantras.practise}
            </Link>
            {m.status !== 'published' && (
              <button type="button" onClick={() => share(m.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-brand-purple hover:bg-card-purple-light">
                <LinkIcon aria-hidden className="h-4 w-4" /> {copied === m.id ? t.mantras.copied : t.mantras.share}
              </button>
            )}
            {m.status === 'private' && (
              <button type="button" onClick={() => act(m.id, 'submit')} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-brand-purple hover:bg-card-purple-light">
                <PaperAirplaneIcon aria-hidden className="h-4 w-4" /> {t.mantras.submit}
              </button>
            )}
            {m.status !== 'published' && (confirm === m.id ? (
              <span className="inline-flex items-center gap-2 text-sm">
                {t.mantras.confirmRemove}
                <button type="button" onClick={() => remove(m.id)} className="min-h-10 rounded-full bg-danger px-3 font-medium text-white">{t.mantras.confirmYes}</button>
                <button type="button" onClick={() => setConfirm(null)} className="min-h-10 px-2 text-text-secondary">{t.mantras.confirmNo}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(m.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-text-secondary hover:text-danger">
                <TrashIcon aria-hidden className="h-4 w-4" /> {t.mantras.remove}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
