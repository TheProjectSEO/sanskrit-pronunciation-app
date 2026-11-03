'use client';

import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AppShell } from '@/components/shell/AppShell';
import { MantraCard } from '@/components/mantra/MantraCard';
import { MyRecordings } from '@/components/mantra/MyRecordings';
import { useLibrary } from '@/lib/mantras/useLibrary';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';

export default function MantrasPage() {
  const { t } = useAppLanguage();
  const { mantras, deities, deityMap, loading } = useLibrary();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [q, setQ] = useState('');
  const [deity, setDeity] = useState<string | null>(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'mine') setTab('mine'); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mantras.filter((m) =>
      (!deity || m.deity_id === deity) &&
      (!needle || m.name.toLowerCase().includes(needle) || m.reference_text_roman.toLowerCase().includes(needle) || m.reference_text_devanagari.includes(q.trim())),
    );
  }, [mantras, q, deity]);
  const usedDeities = deities.filter((d) => mantras.some((m) => m.deity_id === d.id));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-8 md:px-8 md:pt-8">
        <h1 className="mb-4 text-2xl font-bold text-brand-purple md:text-3xl">{t.mantras.title}</h1>

        <div role="tablist" className="mb-5 inline-flex rounded-full bg-card-purple p-1">
          {(['all', 'mine'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
              className={`min-h-10 rounded-full px-5 text-sm font-medium transition-colors ${tab === k ? 'bg-white text-brand-pink shadow-sm' : 'text-brand-purple'}`}>
              {k === 'all' ? t.mantras.all : t.mantras.mine}
            </button>
          ))}
        </div>

        {tab === 'mine' ? <MyRecordings /> : (
          <>
            <label className="relative mb-3 block">
              <span className="sr-only">{t.mantras.search}</span>
              <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-icon-inactive" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.mantras.search}
                className="min-h-12 w-full rounded-xl border border-line-strong bg-white pr-4 pl-11 text-text-primary placeholder:text-icon-inactive focus:border-brand-pink focus:outline-none" />
            </label>
            {usedDeities.length > 0 && (
              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
                {[null, ...usedDeities].map((d) => {
                  const on = (d?.id ?? null) === deity;
                  return (
                    <button key={d?.id ?? 'all'} type="button" onClick={() => setDeity(d?.id ?? null)}
                      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap ${on ? 'border-brand-pink bg-card-pink text-brand-pink' : 'border-line-strong text-brand-purple hover:bg-card-purple-light'}`}>
                      {d ? d.name : t.mantras.allDeities}
                    </button>
                  );
                })}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-pink" /></div>
            ) : shown.length === 0 ? (
              <p className="py-16 text-center text-text-secondary">{t.mantras.none}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
                {shown.map((m, i) => (
                  <MantraCard key={m.id} mantra={m} idx={i} deity={m.deity_id ? deityMap[m.deity_id] : null} versesLabel={t.home.verses} fluid />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
