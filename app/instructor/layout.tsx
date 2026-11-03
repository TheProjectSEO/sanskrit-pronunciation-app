'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Squares2X2Icon, BookOpenIcon, MicrophoneIcon, CheckBadgeIcon, AdjustmentsHorizontalIcon, InboxArrowDownIcon, SparklesIcon, UserGroupIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { isSuperAdmin, ROLE_LABEL } from '@/lib/roles';

const MENU = [
  { href: '/instructor', label: 'Overview', Icon: Squares2X2Icon, exact: true },
  { href: '/instructor/mantras', label: 'Mantras', Icon: BookOpenIcon },
  { href: '/instructor/upload', label: 'Record & publish', Icon: MicrophoneIcon },
  { href: '/instructor/check', label: 'Check', Icon: CheckBadgeIcon },
  { href: '/instructor/pronunciation', label: 'Pronunciation', Icon: AdjustmentsHorizontalIcon },
  { href: '/instructor/submissions', label: 'User submissions', Icon: InboxArrowDownIcon },
  { href: '/instructor/deities', label: 'Deities', Icon: SparklesIcon },
  { href: '/instructor/team', label: 'Team', Icon: UserGroupIcon, superOnly: true },
];

/** Admin frame in the Tapaswe colours: side menu on desktop, scrolling tabs on phones. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const menu = MENU.filter((m) => !m.superOnly || isSuperAdmin(session?.user?.role));
  const on = (m: (typeof MENU)[number]) => (m.exact ? pathname === m.href : pathname.startsWith(m.href));

  return (
    <div className="min-h-dvh bg-card-purple-light">
      <header className="sticky top-0 z-30 border-b border-line bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:h-16 md:px-8">
          <Link href="/instructor" className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-pink md:text-xl">तपस्वे</span>
            <span className="text-lg font-bold text-brand-purple md:text-xl">Tapaswe</span>
            <span className="rounded-full bg-brand-purple px-2.5 py-0.5 text-xs font-semibold text-white">{ROLE_LABEL[session?.user?.role ?? 'admin'] ?? 'Admin'}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-brand-purple hover:bg-card-purple">
              <ArrowLeftIcon aria-hidden className="h-4 w-4" /> <span className="hidden sm:inline">User view</span>
            </Link>
            <span className="hidden text-right text-sm md:block">
              <span className="block font-medium text-text-primary">{session?.user?.name || session?.user?.email}</span>
            </span>
            <button type="button" onClick={() => signOut({ callbackUrl: '/signin' })} aria-label="Sign out" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-brand-purple hover:bg-card-purple-light">
              <ArrowRightOnRectangleIcon aria-hidden className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto border-t border-line scrollbar-hide md:hidden">
          <div className="flex gap-1 px-3 py-2">
            {menu.map((m) => (
              <Link key={m.href} href={m.href} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap ${on(m) ? 'bg-card-pink font-medium text-brand-pink' : 'text-brand-purple'}`}>
                <m.Icon aria-hidden className="h-4 w-4" /> {m.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 md:px-8 md:py-8">
        <nav aria-label="Admin" className="hidden w-56 shrink-0 md:block">
          <ul className="sticky top-24 flex flex-col gap-1">
            {menu.map((m) => (
              <li key={m.href}>
                <Link href={m.href} aria-current={on(m) ? 'page' : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm ${on(m) ? 'bg-white font-semibold text-brand-pink shadow-sm' : 'text-brand-purple hover:bg-white/70'}`}>
                  <m.Icon aria-hidden className="h-5 w-5" /> {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
