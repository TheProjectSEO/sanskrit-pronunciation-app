'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ShieldCheckIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { AppShell } from '@/components/shell/AppShell';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';
import { FEEDBACK_LANGUAGES, type FeedbackLanguage } from '@/lib/constants/languages';
import { isAdmin, ROLE_LABEL } from '@/lib/roles';

interface Progress { mantras: { mantra_id: string; name: string; devanagari: string; attempts: number; last: number; best: number }[] }

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { t, lang, setLang } = useAppLanguage();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<FeedbackLanguage>('hindi');

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/me/progress').then((r) => (r.ok ? r.json() : null)).then(setProgress).catch(() => {});
    fetch('/api/user/preferences').then((r) => (r.ok ? r.json() : null)).then((d) => d?.feedback_language && setFeedback(d.feedback_language)).catch(() => {});
  }, [status]);

  const changeFeedback = (l: FeedbackLanguage) => {
    setFeedback(l);
    fetch('/api/user/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback_language: l }) }).catch(() => {});
  };

  const card = 'rounded-[15px] border border-line bg-white p-4 md:p-5';

  return (
    <AppShell>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5 pb-8 md:pt-8">
        <h1 className="text-2xl font-bold text-brand-purple md:text-3xl">{t.profile.title}</h1>

        <section className={card} aria-labelledby="p-progress">
          <h2 id="p-progress" className="mb-3 font-bold text-brand-purple">{t.profile.progress}</h2>
          {!progress?.mantras.length ? (
            <p className="text-text-secondary">{t.profile.noProgress}</p>
          ) : (
            <ul className="divide-y divide-line">
              {progress.mantras.map((m) => (
                <li key={m.mantra_id}>
                  <Link href={`/practice/${m.mantra_id}`} className="flex items-center gap-3 py-3 hover:bg-card-purple-light">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-brand-purple">{m.name}</span>
                      <span className="text-sm text-text-secondary">{t.profile.attempts(m.attempts)}</span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="block text-text-secondary">{t.profile.last} <b className="text-text-primary">{m.last}%</b></span>
                      <span className="block text-text-secondary">{t.profile.best} <b className={m.best >= 85 ? 'text-success' : 'text-brand-pink'}>{m.best}%</b></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card} aria-labelledby="p-lang">
          <h2 id="p-lang" className="mb-3 font-bold text-brand-purple">{t.profile.language}</h2>
          <div role="radiogroup" className="inline-flex rounded-full bg-card-purple p-1">
            {([['en', 'English'], ['hi', 'हिन्दी']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => setLang(k)}
                className={`min-h-10 rounded-full px-5 text-sm font-medium ${lang === k ? 'bg-white text-brand-pink shadow-sm' : 'text-brand-purple'}`}>{label}</button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-text-primary">{t.profile.feedback}</span>
            <select value={feedback} onChange={(e) => changeFeedback(e.target.value as FeedbackLanguage)}
              className="min-h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-text-primary focus:border-brand-pink focus:outline-none">
              {FEEDBACK_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
        </section>

        <section className={card} aria-labelledby="p-account">
          <h2 id="p-account" className="mb-3 font-bold text-brand-purple">{t.profile.account}</h2>
          <p className="text-text-primary">{session?.user?.name || session?.user?.email}</p>
          <p className="text-sm text-text-secondary">{session?.user?.email}</p>
          <p className="mt-1 text-sm text-text-secondary">{t.profile.role}: {ROLE_LABEL[session?.user?.role ?? 'user'] ?? 'User'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isAdmin(session?.user?.role) && (
              <Link href="/instructor" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-purple px-5 font-medium text-white hover:bg-brand-purple-hover">
                <ShieldCheckIcon aria-hidden className="h-5 w-5" /> {t.profile.admin}
              </Link>
            )}
            <button type="button" onClick={() => signOut({ callbackUrl: '/signin' })} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong px-5 text-brand-purple hover:bg-card-purple-light">
              <ArrowRightOnRectangleIcon aria-hidden className="h-5 w-5" /> {t.profile.signOut}
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
