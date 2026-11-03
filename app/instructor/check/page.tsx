'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, PlayIcon } from '@heroicons/react/24/outline';
import { Card, PageTitle, Spinner, StatusBadge } from '@/components/admin/ui';

interface Row { id: string; name: string; status: string; owner_email: string | null; owner_role: string | null; reference_text_devanagari: string }

export default function CheckPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  useEffect(() => { fetch('/api/admin/catalog').then((r) => (r.ok ? r.json() : { mantras: [] })).then((d) => setRows(d.mantras)).catch(() => setRows([])); }, []);
  const shown = useMemo(() => (rows ?? []).filter((r) => (status === 'all' || r.status === status) && (!q || r.name.toLowerCase().includes(q.toLowerCase()))), [rows, q, status]);

  return (
    <>
      <PageTitle title="Check" sub="Practise any mantra exactly as a learner would. As an admin you also see what each ear heard, word by word, under the result." />
      <Card className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search</span>
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-icon-inactive" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mantras" className="min-h-11 w-full rounded-xl border border-line-strong pr-3 pl-10 focus:border-brand-pink focus:outline-none" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-line-strong px-3 text-brand-purple">
          {['all', 'published', 'draft', 'submitted', 'private', 'rejected'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
      </Card>
      {!rows ? <Spinner /> : (
        <Card className="p-0 md:p-0">
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-brand-purple">{r.name}</span>
                  <span lang="sa" className="font-mantra block truncate text-sm text-text-secondary">{r.reference_text_devanagari}</span>
                  {r.owner_role === 'user' && <span className="text-xs text-text-secondary">by {r.owner_email}</span>}
                </span>
                <StatusBadge status={r.status} />
                <Link href={`/practice/${r.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-purple px-4 text-sm font-medium text-white hover:bg-brand-purple-hover">
                  <PlayIcon aria-hidden className="h-4 w-4" /> Practise
                </Link>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-10 text-center text-text-secondary">Nothing matches.</li>}
          </ul>
        </Card>
      )}
    </>
  );
}
