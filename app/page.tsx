'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MANTRA_CATEGORIES } from '@/lib/constants/categories';
import { AppShell } from '@/components/shell/AppShell';
import { MantraCard } from '@/components/mantra/MantraCard';
import { useLibrary, type LibraryMantra } from '@/lib/mantras/useLibrary';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';

interface Progress { week: { attempts: number; mantras: number }; mantras: { mantra_id: string; name: string; best: number; last: number; attempts: number }[] }

function Row({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide md:hidden">{children}</div>
      <div className="hidden gap-5 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
    </>
  );
}

export default function HomePage() {
  const { status } = useSession();
  const { t } = useAppLanguage();
  const { mantras, deityMap, loading } = useLibrary();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/me/progress').then((r) => (r.ok ? r.json() : null)).then(setProgress).catch(() => {});
  }, [status]);

  const groups = useMemo(() => {
    const out: { category: string; mantras: LibraryMantra[] }[] = [];
    for (const cat of MANTRA_CATEGORIES) {
      const items = mantras.filter((m) => m.category === cat);
      if (items.length) out.push({ category: cat, mantras: items });
    }
    const rest = mantras.filter((m) => !m.category || !(MANTRA_CATEGORIES as readonly string[]).includes(m.category));
    if (rest.length) out.push({ category: out.length ? t.home.other : t.nav.mantras, mantras: rest });
    return out;
  }, [mantras, t]);

  const recent = (progress?.mantras ?? []).slice(0, 5);
  const byId = useMemo(() => Object.fromEntries(mantras.map((m) => [m.id, m])), [mantras]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-8 md:px-8 md:pt-8">
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-pink" /></div>
        ) : mantras.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-card-purple p-8 text-center">
            <span className="mb-4 block text-4xl">🙏</span>
            <p className="font-medium text-brand-purple">{t.home.empty}</p>
            <p className="mt-1 text-sm text-text-secondary">{t.home.emptySub}</p>
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-xl font-bold text-brand-purple md:mb-4 md:text-2xl">{t.home.continue}</h2>
                <Row>
                  {recent.filter((r) => byId[r.mantra_id]).map((r, i) => (
                    <MantraCard key={r.mantra_id} mantra={byId[r.mantra_id]} idx={i} deity={byId[r.mantra_id].deity_id ? deityMap[byId[r.mantra_id].deity_id!] : null} versesLabel={t.home.verses} fluid={false} />
                  ))}
                </Row>
              </section>
            )}

            {groups.map((g) => (
              <section key={g.category} className="mb-8">
                <h2 className="mb-3 text-xl font-bold text-brand-purple md:mb-4 md:text-2xl">{g.category}</h2>
                <Row>
                  {g.mantras.map((m, i) => (
                    <MantraCard key={m.id} mantra={m} idx={i} deity={m.deity_id ? deityMap[m.deity_id] : null} versesLabel={t.home.verses} />
                  ))}
                </Row>
              </section>
            ))}

            {progress && progress.week.attempts > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-xl font-bold text-brand-purple md:mb-4 md:text-2xl">{t.home.week}</h2>
                <div className="flex flex-wrap gap-3 md:gap-4">
                  <div className="w-[150px] rounded-[15px] bg-card-purple p-4 md:w-[180px] md:p-5">
                    <p className="text-2xl font-bold text-brand-purple">{progress.week.attempts}</p>
                    <p className="mt-1 text-xs text-text-secondary">{t.home.attempts(progress.week.attempts)}</p>
                  </div>
                  <div className="w-[150px] rounded-[15px] bg-card-pink p-4 md:w-[180px] md:p-5">
                    <p className="text-2xl font-bold text-brand-pink">{progress.week.mantras}</p>
                    <p className="mt-1 text-xs text-text-secondary">{t.home.mantrasPractised(progress.week.mantras)}</p>
                  </div>
                  {recent[0] && (
                    <div className="w-[150px] rounded-[15px] bg-card-blue p-4 md:w-[180px] md:p-5">
                      <p className="text-2xl font-bold text-brand-purple">{Math.max(...recent.map((r) => r.best))}%</p>
                      <p className="mt-1 text-xs text-text-secondary">{t.home.bestScore(Math.max(...recent.map((r) => r.best)))}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {status === 'unauthenticated' && (
              <div className="mx-auto mb-6 max-w-md rounded-2xl bg-card-purple p-6 text-center md:max-w-lg md:p-8">
                <h3 className="mb-2 text-lg font-bold text-brand-purple">{t.home.ctaTitle}</h3>
                <p className="mb-4 text-sm text-text-secondary">{t.home.ctaBody}</p>
                <Link href="/signup" className="inline-block rounded-xl bg-brand-pink px-8 py-3 font-semibold text-white hover:bg-brand-pink-hover">{t.home.ctaButton}</Link>
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
