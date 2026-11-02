'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import type { FeedbackLanguage } from '@/lib/constants/languages';
import { LANG_ATTR } from '@/lib/practice/copy';

interface Deity { id: string; name: string; name_devanagari: string | null }
interface Mantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  deity_id: string | null;
  verse_count: number;
}

const HOME: Record<FeedbackLanguage, { contents: string; other: string; verses: (n: number) => string; empty: string; signOut: string; signIn: string; instructor: string; invite: string; start: string }> = {
  hindi: { contents: 'मंत्र-सूची', other: 'अन्य मंत्र', verses: (n) => `${n} श्लोक`, empty: 'अभी कोई मंत्र नहीं है। जल्द ही जोड़े जाएँगे।', signOut: 'बाहर निकलें', signIn: 'प्रवेश करें', instructor: 'गुरु पृष्ठ', invite: 'गुरुजी की आवाज़ के साथ अभ्यास करने और अपना मार्गदर्शन पाने के लिए प्रवेश करें।', start: 'शुरू करें' },
  english: { contents: 'Contents', other: 'Other mantras', verses: (n) => `${n} verses`, empty: 'No mantras yet. They will be added soon.', signOut: 'Sign out', signIn: 'Sign in', instructor: 'Teacher pages', invite: 'Sign in to practise with the teacher’s voice and get your own guidance.', start: 'Begin' },
  tamil: { contents: 'பொருளடக்கம்', other: 'மற்ற மந்திரங்கள்', verses: (n) => `${n} ஸ்லோகங்கள்`, empty: 'இன்னும் மந்திரங்கள் இல்லை.', signOut: 'வெளியேறு', signIn: 'உள்நுழை', instructor: 'குரு பக்கங்கள்', invite: 'குருவின் குரலுடன் பயிற்சி செய்ய உள்நுழையுங்கள்.', start: 'தொடங்கு' },
  kannada: { contents: 'ಪರಿವಿಡಿ', other: 'ಇತರ ಮಂತ್ರಗಳು', verses: (n) => `${n} ಶ್ಲೋಕಗಳು`, empty: 'ಇನ್ನೂ ಮಂತ್ರಗಳಿಲ್ಲ.', signOut: 'ಹೊರಹೋಗಿ', signIn: 'ಪ್ರವೇಶಿಸಿ', instructor: 'ಗುರು ಪುಟಗಳು', invite: 'ಗುರುಗಳ ಧ್ವನಿಯೊಂದಿಗೆ ಅಭ್ಯಾಸ ಮಾಡಲು ಪ್ರವೇಶಿಸಿ.', start: 'ಪ್ರಾರಂಭಿಸಿ' },
  telugu: { contents: 'విషయ సూచిక', other: 'ఇతర మంత్రాలు', verses: (n) => `${n} శ్లోకాలు`, empty: 'ఇంకా మంత్రాలు లేవు.', signOut: 'బయటకు', signIn: 'ప్రవేశించండి', instructor: 'గురువు పేజీలు', invite: 'గురువుగారి స్వరంతో సాధన చేయడానికి ప్రవేశించండి.', start: 'ప్రారంభించండి' },
};

/** First line of the mantra, as a contents entry would print it. */
function incipit(text: string) {
  const firstLine = text.split(/[।॥\n|]/)[0].trim();
  const words = firstLine.split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(' ')} …` : firstLine;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [deities, setDeities] = useState<Deity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<FeedbackLanguage>('hindi');
  const t = HOME[lang];

  useEffect(() => {
    Promise.all([
      fetch('/api/mantras').then((r) => (r.ok ? r.json() : { mantras: [] })),
      fetch('/api/deities').then((r) => (r.ok ? r.json() : { deities: [] })),
    ])
      .then(([m, d]) => { setMantras(m.mantras || []); setDeities(d.deities || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/user/preferences').then((r) => (r.ok ? r.json() : null)).then((d) => d?.feedback_language && setLang(d.feedback_language)).catch(() => {});
  }, [session]);

  const groups = useMemo(() => {
    const byDeity = new Map<string, Mantra[]>();
    for (const m of mantras) {
      const key = m.deity_id && deities.some((d) => d.id === m.deity_id) ? m.deity_id : '_';
      byDeity.set(key, [...(byDeity.get(key) || []), m]);
    }
    const out = deities.filter((d) => byDeity.has(d.id)).map((d) => {
      const deva = d.name_devanagari && /[ऀ-ॿ]/.test(d.name_devanagari) ? d.name_devanagari : null;
      return { id: d.id, title: deva || d.name, sub: deva && deva !== d.name ? d.name : null, items: byDeity.get(d.id)! };
    });
    if (byDeity.has('_')) out.push({ id: '_', title: out.length ? t.other : t.contents, sub: null, items: byDeity.get('_')! });
    return out;
  }, [mantras, deities, t]);

  return (
    <div className="min-h-dvh bg-paper" lang={LANG_ATTR[lang]}>
      <header className="bg-cloth text-cloth-ink" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <Link href="/" className="flex min-h-12 items-center gap-2">
            <span lang="sa" className="font-mantra text-[1.7rem] leading-none">तपस्वे</span>
            <span lang="en" className="text-sm tracking-[0.08em] opacity-80">TAPASWE</span>
          </Link>
          <nav className="flex items-center gap-1 text-[0.95rem]">
            {session?.user?.role === 'instructor' && (
              <Link href="/instructor/mantras" className="inline-flex min-h-12 items-center rounded-full px-3 hover:bg-white/10">{t.instructor}</Link>
            )}
            {status === 'authenticated' ? (
              <Link href="/api/auth/signout" className="inline-flex min-h-12 items-center rounded-full px-3 opacity-85 hover:bg-white/10">{t.signOut}</Link>
            ) : (
              <Link href="/signin" className="inline-flex min-h-12 items-center rounded-full border border-cloth-ink/40 px-4 hover:bg-white/10">{t.signIn}</Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-16" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        {loading ? (
          <p className="py-24 text-center"><span className="font-mantra animate-pulse text-5xl text-sindoor" aria-label="loading">ॐ</span></p>
        ) : mantras.length === 0 ? (
          <p className="py-24 text-center text-lg text-ink-soft">{t.empty}</p>
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((g) => (
              <section key={g.id} aria-labelledby={`g-${g.id}`}>
                <h2 id={`g-${g.id}`} className="flex items-baseline gap-3 border-b-[3px] border-double border-paper-edge pb-2">
                  <span className="font-mantra text-[1.6rem] text-sindoor">{g.title}</span>
                  {g.sub && <span className="text-[0.95rem] text-ink-soft">{g.sub}</span>}
                </h2>
                <ol className="divide-y divide-paper-edge/70">
                  {g.items.map((m) => (
                    <li key={m.id}>
                      <Link href={`/practice/${m.id}`} className="group flex min-h-20 items-center gap-3 py-3 hover:bg-paper-deep/60 active:bg-paper-deep">
                        <span className="min-w-0 flex-1">
                          <span lang="sa" className="font-mantra block text-[1.5rem] leading-snug text-ink">{incipit(m.reference_text_devanagari)}</span>
                          <span className="mt-0.5 block truncate text-[0.95rem] text-ink-soft">
                            {m.name}
                            {m.verse_count > 0 && <span className="text-sindoor"> · {t.verses(m.verse_count)}</span>}
                          </span>
                        </span>
                        <ChevronRightIcon aria-hidden className="h-6 w-6 shrink-0 text-paper-edge transition-transform group-hover:translate-x-0.5 group-hover:text-cloth" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

            {status === 'unauthenticated' && (
              <section className="border-y-[3px] border-double border-paper-edge py-6 text-center">
                <p className="mx-auto max-w-md text-[1.1rem] leading-relaxed text-ink">{t.invite}</p>
                <Link href="/signup" className="mt-4 inline-flex min-h-14 items-center rounded-xl bg-cloth px-8 text-lg font-semibold text-cloth-ink">{t.start}</Link>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
