'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import {
  HomeIcon as HomeOutline, BookOpenIcon as BookOutline, MicrophoneIcon as MicOutline, UserIcon as UserOutline, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolid, BookOpenIcon as BookSolid, MicrophoneIcon as MicSolid, UserIcon as UserSolid,
} from '@heroicons/react/24/solid';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';
import { isAdmin } from '@/lib/roles';

const TABS = [
  { href: '/', key: 'home', Outline: HomeOutline, Solid: HomeSolid },
  { href: '/mantras', key: 'mantras', Outline: BookOutline, Solid: BookSolid },
  { href: '/record', key: 'record', Outline: MicOutline, Solid: MicSolid },
  { href: '/profile', key: 'profile', Outline: UserOutline, Solid: UserSolid },
] as const;

/**
 * The user-side frame: Tapaswe header, top links on desktop, bottom tabs on phones.
 * The Admin link exists only for admins and super admins.
 */
export function AppShell({ children, hideBottomNav = false }: { children: ReactNode; hideBottomNav?: boolean }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { t } = useAppLanguage();
  const admin = isAdmin(session?.user?.role);
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-8">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-brand-pink md:text-xl">तपस्वे</span>
            <span className="text-lg font-bold text-brand-purple md:text-xl">Tapaswe</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 pb-0.5 text-sm font-medium transition-colors ${active(tab.href) ? 'border-brand-pink text-brand-pink' : 'border-transparent text-text-secondary hover:text-brand-purple'}`}
              >
                {t.nav[tab.key]}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {admin && (
              <Link href="/instructor" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-purple px-3.5 text-sm font-medium text-white hover:bg-brand-purple-hover">
                <ShieldCheckIcon aria-hidden className="h-4 w-4" />
                {t.nav.admin}
              </Link>
            )}
            {status === 'unauthenticated' && (
              <Link href="/signin" className="inline-flex min-h-10 items-center rounded-full bg-brand-pink px-5 text-sm font-medium text-white hover:bg-brand-pink-hover">
                {t.nav.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className={hideBottomNav ? '' : 'pb-24 md:pb-0'}>{children}</div>

      {!hideBottomNav && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white shadow-[0_-2px_10px_rgba(46,40,113,0.06)] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
            {TABS.map((tab) => {
              const on = active(tab.href);
              const Icon = on ? tab.Solid : tab.Outline;
              return (
                <Link key={tab.href} href={tab.href} aria-current={on ? 'page' : undefined} className={`flex min-w-16 flex-col items-center gap-0.5 py-1 ${on ? 'text-brand-pink' : 'text-icon-inactive'}`}>
                  <Icon aria-hidden className="h-6 w-6" />
                  <span className="text-[11px] font-medium">{t.nav[tab.key]}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
