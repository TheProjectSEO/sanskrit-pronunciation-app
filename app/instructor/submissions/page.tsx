'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckIcon, XMarkIcon, PlayIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { MANTRA_CATEGORIES } from '@/lib/constants/categories';
import { Card, PageTitle, Spinner, StatusBadge } from '@/components/admin/ui';

interface Sub { id: string; name: string; status: string; owner_email: string | null; owner_name: string | null; reference_text_devanagari: string; reference_text_roman: string; reference_audio_url: string; category: string | null; deity_id: string | null; updated_at: string }
interface Deity { id: string; name: string }

const TABS = [['submitted', 'Waiting for review'], ['private', 'Private (link only)'], ['rejected', 'Rejected']] as const;

function Review({ s, deities, onDone }: { s: Sub; deities: Deity[]; onDone: () => void }) {
  const [name, setName] = useState(s.name);
  const [deva, setDeva] = useState(s.reference_text_devanagari);
  const [roman, setRoman] = useState(s.reference_text_roman);
  const [category, setCategory] = useState(s.category ?? '');
  const [deity, setDeity] = useState(s.deity_id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (action: 'approve' | 'reject' | 'reopen') => {
    setBusy(true);
    setErr(null);
    const r = await fetch('/api/admin/submissions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'approve' ? { id: s.id, action, name, reference_text_devanagari: deva, reference_text_roman: roman, category, deity_id: deity } : { id: s.id, action }),
    });
    setBusy(false);
    if (r.ok) onDone(); else setErr((await r.json().catch(() => ({}))).error || 'Could not save');
  };
  const field = 'min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 focus:border-brand-pink focus:outline-none';
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-brand-purple">{s.name}</p>
          <p className="text-sm text-text-secondary">by {s.owner_name ? `${s.owner_name} · ` : ''}{s.owner_email ?? 'unknown'} · {new Date(s.updated_at).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <audio src={s.reference_audio_url} controls preload="none" className="mt-3 w-full" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium">Name</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label><span className="mb-1 block text-sm font-medium">Devanagari</span><textarea lang="sa" rows={3} className={`${field} font-mantra py-2 text-lg`} value={deva} onChange={(e) => setDeva(e.target.value)} /></label>
        <label><span className="mb-1 block text-sm font-medium">Roman (used for scoring)</span><textarea rows={3} className={`${field} py-2`} value={roman} onChange={(e) => setRoman(e.target.value)} /></label>
        <label><span className="mb-1 block text-sm font-medium">Category</span>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">None</option>{MANTRA_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span className="mb-1 block text-sm font-medium">Deity</span>
          <select className={field} value={deity} onChange={(e) => setDeity(e.target.value)}><option value="">None</option>{deities.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/practice/${s.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-brand-purple hover:bg-card-purple-light"><PlayIcon aria-hidden className="h-4 w-4" /> Check it</Link>
        {s.status !== 'rejected' && (
          <button type="button" disabled={busy} onClick={() => act('approve')} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-success px-4 text-sm font-medium text-white disabled:opacity-50"><CheckIcon aria-hidden className="h-4 w-4" /> Approve into library</button>
        )}
        {s.status === 'submitted' && (
          <button type="button" disabled={busy} onClick={() => act('reject')} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-danger px-4 text-sm text-danger disabled:opacity-50"><XMarkIcon aria-hidden className="h-4 w-4" /> Reject</button>
        )}
        {s.status === 'rejected' && (
          <button type="button" disabled={busy} onClick={() => act('reopen')} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-brand-purple disabled:opacity-50"><ArrowUturnLeftIcon aria-hidden className="h-4 w-4" /> Back to review</button>
        )}
      </div>
    </Card>
  );
}

export default function SubmissionsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('submitted');
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [deities, setDeities] = useState<Deity[]>([]);
  const load = () => { setRows(null); fetch(`/api/admin/submissions?status=${tab}`).then((r) => (r.ok ? r.json() : { mantras: [] })).then((d) => setRows(d.mantras)).catch(() => setRows([])); };
  useEffect(load, [tab]);
  useEffect(() => { fetch('/api/deities').then((r) => (r.ok ? r.json() : { deities: [] })).then((d) => setDeities(d.deities || [])).catch(() => {}); }, []);

  return (
    <>
      <PageTitle title="User submissions" sub="Mantras recorded by users. Private ones are shared by link only; submitted ones are asking to join the library. Fix the text if needed, check it, then approve." />
      <div role="tablist" className="mb-4 inline-flex flex-wrap rounded-full bg-white p-1 shadow-sm">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`min-h-10 rounded-full px-4 text-sm ${tab === k ? 'bg-card-pink font-medium text-brand-pink' : 'text-brand-purple'}`}>{label}</button>
        ))}
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Card className="py-10 text-center text-text-secondary">Nothing here.</Card>
      ) : (
        <div className="flex flex-col gap-4">{rows.map((s) => <Review key={s.id} s={s} deities={deities} onDone={load} />)}</div>
      )}
    </>
  );
}
