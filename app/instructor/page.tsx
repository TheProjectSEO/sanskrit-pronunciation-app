'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpenIcon, MicrophoneIcon, InboxArrowDownIcon, CheckBadgeIcon, AdjustmentsHorizontalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { PageTitle, Spinner } from '@/components/admin/ui';

interface Overview { published: number; drafts: number; submitted: number; userPrivate: number; users: number; attemptsThisWeek: number; flaggedWrong: number }

const STEPS = [
  { href: '/instructor/upload', Icon: MicrophoneIcon, title: '1. Record & publish', body: 'Record or upload the teacher’s voice, check the text, then publish it to the library.' },
  { href: '/instructor/pronunciation', Icon: AdjustmentsHorizontalIcon, title: '2. Prepare pronunciation', body: 'Make sure each mantra has its teacher reading and word timings, so learners are judged against the teacher.' },
  { href: '/instructor/check', Icon: CheckBadgeIcon, title: '3. Check it', body: 'Practise any mantra as a learner and see exactly what the ears heard.' },
  { href: '/instructor/submissions', Icon: InboxArrowDownIcon, title: '4. Review user recordings', body: 'Users can record their own mantras. Approve the good ones into the library.' },
];

export default function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => { fetch('/api/admin/overview').then((r) => (r.ok ? r.json() : null)).then(setO).catch(() => {}); }, []);

  const tiles = o ? [
    { label: 'In the library', value: o.published, href: '/instructor/mantras', bg: 'bg-card-purple' },
    { label: 'Drafts', value: o.drafts, href: '/instructor/mantras', bg: 'bg-card-blue' },
    { label: 'Waiting for review', value: o.submitted, href: '/instructor/submissions', bg: 'bg-card-pink' },
    { label: 'Learners and admins', value: o.users, href: '/instructor/team', bg: 'bg-card-purple' },
    { label: 'Recitations this week', value: o.attemptsThisWeek, href: '/instructor/check', bg: 'bg-card-blue' },
  ] : [];

  return (
    <>
      <PageTitle title="Overview" sub="Everything a teacher or admin does in Tapaswe, in order." />
      {!o ? <Spinner /> : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className={`${t.bg} rounded-[15px] p-4 transition-transform hover:scale-[1.02]`}>
              <p className="text-3xl font-bold text-brand-purple">{t.value}</p>
              <p className="mt-1 text-sm text-text-secondary">{t.label}</p>
            </Link>
          ))}
        </div>
      )}
      {o && o.flaggedWrong > 0 && (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-warning-bg px-4 py-3 text-warning">
          <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          Learners marked {o.flaggedWrong} verdict{o.flaggedWrong === 1 ? '' : 's'} as wrong. Their recordings are saved for checking accuracy.
        </p>
      )}
      <h2 className="mb-3 text-lg font-bold text-brand-purple">How it works</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((s) => (
          <Link key={s.href} href={s.href} className="flex gap-3 rounded-[15px] border border-line bg-white p-4 hover:border-brand-pink">
            <s.Icon aria-hidden className="h-7 w-7 shrink-0 text-brand-pink" />
            <span>
              <span className="block font-bold text-brand-purple">{s.title}</span>
              <span className="text-sm text-text-secondary">{s.body}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-text-secondary">
        <BookOpenIcon aria-hidden className="mr-1 inline h-4 w-4" />
        Mantras lists the library and drafts; open one to edit its text, verses and word timings.
      </p>
    </>
  );
}
