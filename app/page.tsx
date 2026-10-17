'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MANTRA_CATEGORIES } from '@/lib/constants/categories';
import {
  Cog6ToothIcon,
  Bars3Icon,
  ClockIcon,
  HomeIcon as HomeOutlineIcon,
  BookOpenIcon as BookOpenOutlineIcon,
  UserGroupIcon as UserGroupOutlineIcon,
  UserIcon as UserOutlineIcon,
} from '@heroicons/react/24/outline';
import {
  StarIcon,
  HomeIcon as HomeSolidIcon,
  BookOpenIcon as BookOpenSolidIcon,
  UserGroupIcon as UserGroupSolidIcon,
  UserIcon as UserSolidIcon,
} from '@heroicons/react/24/solid';

interface Deity {
  id: string;
  name: string;
  name_devanagari: string | null;
  image_url: string | null;
}

interface Mantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  reference_audio_url: string;
  difficulty_level: number;
  category: string | null;
  deity_id: string | null;
  verse_count: number;
}

type NavTab = 'home' | 'mantras' | 'community' | 'profile';

const CARD_THEMES = [
  { bg: 'bg-card-purple', imgBg: 'bg-card-purple-light' },
  { bg: 'bg-card-pink', imgBg: 'bg-card-pink-light' },
] as const;

const STREAK_CARDS = [
  { title: 'Nitya Puja', count: 12, bg: 'bg-card-purple', text: 'text-brand-purple' },
  { title: 'Sthuthis', count: 8, bg: 'bg-card-pink', text: 'text-brand-pink' },
  { title: 'Mahamantras', count: 5, bg: 'bg-card-blue', text: 'text-brand-purple' },
] as const;

function MantraCard({ mantra, idx, deityMap, getDuration, getDeityEmoji }: {
  mantra: Mantra;
  idx: number;
  deityMap: Record<string, Deity>;
  getDuration: (m: Mantra) => string;
  getDeityEmoji: (id: string | null) => string;
}) {
  const theme = CARD_THEMES[idx % 2];
  const deity = mantra.deity_id ? deityMap[mantra.deity_id] : null;
  return (
    <Link
      href={`/practice/${mantra.id}`}
      className={`flex-shrink-0 w-[205px] ${theme.bg} rounded-[15px] overflow-hidden active:scale-[0.97] hover:scale-[1.02] transition-transform`}
    >
      <div className={`${theme.imgBg} h-[110px] flex items-center justify-center`}>
        {deity?.image_url ? (
          <img src={deity.image_url} alt={deity.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">{getDeityEmoji(mantra.deity_id)}</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-brand-purple leading-tight line-clamp-2 mb-2">
          {mantra.name}
        </h3>
        <div className="flex items-center gap-3 text-text-secondary">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            <span className="text-xs">{getDuration(mantra)}</span>
          </div>
          <div className="flex items-center gap-1">
            <StarIcon className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-xs">4.8</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [deities, setDeities] = useState<Deity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  useEffect(() => {
    Promise.all([
      fetch('/api/mantras').then(r => r.ok ? r.json() : { mantras: [] }),
      fetch('/api/deities').then(r => r.ok ? r.json() : { deities: [] }),
    ]).then(([mantraData, deityData]) => {
      setMantras(mantraData.mantras || []);
      setDeities(deityData.deities || []);
    }).catch(err => {
      console.error('Error fetching data:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const deityMap = useMemo(() => {
    const map: Record<string, Deity> = {};
    deities.forEach(d => { map[d.id] = d; });
    return map;
  }, [deities]);

  const categoryGroups = useMemo(() => {
    const groups: { category: string; mantras: Mantra[] }[] = [];
    for (const cat of MANTRA_CATEGORIES) {
      const items = mantras.filter(m => m.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, mantras: items });
      }
    }
    const uncategorized = mantras.filter(m => !m.category || !MANTRA_CATEGORIES.includes(m.category as typeof MANTRA_CATEGORIES[number]));
    if (uncategorized.length > 0) {
      groups.push({ category: 'Other', mantras: uncategorized });
    }
    return groups;
  }, [mantras]);

  const getDuration = (mantra: Mantra) => {
    if (mantra.verse_count > 0) return `${mantra.verse_count * 3} min`;
    return '5 min';
  };

  const getDeityEmoji = (deityId: string | null) => {
    if (!deityId) return '🙏';
    const deity = deityMap[deityId];
    if (!deity) return '🙏';
    const name = deity.name.toLowerCase();
    if (name.includes('ganesh')) return '🐘';
    if (name.includes('shiva')) return '🔱';
    if (name.includes('vishnu') || name.includes('krishna')) return '🪈';
    if (name.includes('lakshmi')) return '🪷';
    if (name.includes('saraswati')) return '🎵';
    if (name.includes('hanuman')) return '🐒';
    if (name.includes('durga') || name.includes('devi')) return '⚔️';
    return '🕉️';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex justify-between items-center h-14 md:h-16">
            {/* Left: settings on mobile, logo on desktop */}
            <div className="flex items-center gap-3">
              <button className="p-1 md:hidden">
                <Cog6ToothIcon className="w-6 h-6 text-icon-inactive" />
              </button>
              <div className="md:flex items-center gap-2 hidden">
                <span className="text-xl font-bold text-brand-pink">तपस्वे</span>
                <span className="text-xl font-bold text-brand-purple">Tapaswe</span>
              </div>
            </div>

            {/* Center: logo on mobile only */}
            <div className="text-center md:hidden">
              <span className="text-lg font-bold text-brand-pink">तपस्वे</span>
              <span className="text-lg font-bold text-brand-purple ml-1">Tapaswe</span>
            </div>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-8">
              {(['home', 'mantras', 'community', 'profile'] as NavTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm font-medium capitalize pb-0.5 border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'text-brand-pink border-brand-pink'
                      : 'text-text-secondary border-transparent hover:text-brand-purple'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {/* Right: auth actions */}
            <div className="flex items-center gap-3">
              {status === 'authenticated' ? (
                <>
                  {session?.user?.role === 'instructor' && (
                    <Link
                      href="/instructor/mantras"
                      className="hidden md:inline-block text-sm px-4 py-1.5 bg-brand-purple text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                      Instructor Dashboard
                    </Link>
                  )}
                  <Link
                    href="/api/auth/signout"
                    className="hidden md:inline-block text-sm text-text-secondary hover:text-brand-purple"
                  >
                    Logout
                  </Link>
                  {/* Mobile hamburger for instructor */}
                  {session?.user?.role === 'instructor' && (
                    <Link href="/instructor/mantras" className="p-1 md:hidden">
                      <Bars3Icon className="w-6 h-6 text-icon-inactive" />
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="hidden md:inline-block text-sm px-5 py-2 bg-brand-pink text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                  >
                    Sign In
                  </Link>
                  <div className="w-6 md:hidden" />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-24 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-pink" />
          </div>
        ) : mantras.length === 0 ? (
          <div className="bg-card-purple rounded-2xl p-8 text-center mt-8 max-w-md mx-auto">
            <span className="text-4xl mb-4 block">🙏</span>
            <p className="text-brand-purple font-medium">No mantras available yet.</p>
            <p className="text-text-secondary text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Category Sections */}
            {categoryGroups.map((group) => (
              <section key={group.category} className="mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-brand-purple mb-3 md:mb-4">
                  {group.category}
                </h2>

                {/* Mobile: horizontal scroll */}
                <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 md:hidden">
                  {group.mantras.map((mantra, idx) => (
                    <MantraCard
                      key={mantra.id}
                      mantra={mantra}
                      idx={idx}
                      deityMap={deityMap}
                      getDuration={getDuration}
                      getDeityEmoji={getDeityEmoji}
                    />
                  ))}
                </div>

                {/* Desktop: wrapping grid */}
                <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {group.mantras.map((mantra, idx) => (
                    <MantraCard
                      key={mantra.id}
                      mantra={mantra}
                      idx={idx}
                      deityMap={deityMap}
                      getDuration={getDuration}
                      getDeityEmoji={getDeityEmoji}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Weekly Streak Section */}
            <section className="mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-brand-purple mb-3 md:mb-4">
                Weekly Streak
              </h2>
              {/* Mobile: horizontal scroll */}
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 md:hidden">
                {STREAK_CARDS.map((card) => (
                  <div key={card.title} className={`flex-shrink-0 w-[150px] ${card.bg} rounded-[15px] p-4`}>
                    <p className={`text-sm font-bold ${card.text}`}>{card.title}</p>
                    <p className="text-text-secondary text-xs mt-1">{card.count} mantras</p>
                  </div>
                ))}
              </div>
              {/* Desktop: inline row */}
              <div className="hidden md:flex gap-4">
                {STREAK_CARDS.map((card) => (
                  <div key={card.title} className={`w-[180px] ${card.bg} rounded-[15px] p-5`}>
                    <p className={`text-sm font-bold ${card.text}`}>{card.title}</p>
                    <p className="text-text-secondary text-xs mt-1">{card.count} mantras</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Sign Up CTA */}
            {status !== 'authenticated' && (
              <div className="bg-card-purple rounded-2xl p-6 md:p-8 text-center mb-6 max-w-md md:max-w-lg mx-auto">
                <h3 className="font-bold text-brand-purple text-lg mb-2">Start Your Journey</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Sign in to track progress and get personalized feedback
                </p>
                <Link
                  href="/signup"
                  className="inline-block px-8 py-3 bg-brand-pink text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  Get Started Free
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation - mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:hidden">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {([
              { id: 'home' as NavTab, label: 'Home', OutlineIcon: HomeOutlineIcon, SolidIcon: HomeSolidIcon },
              { id: 'mantras' as NavTab, label: 'Mantras', OutlineIcon: BookOpenOutlineIcon, SolidIcon: BookOpenSolidIcon },
              { id: 'community' as NavTab, label: 'Community', OutlineIcon: UserGroupOutlineIcon, SolidIcon: UserGroupSolidIcon },
              { id: 'profile' as NavTab, label: 'Profile', OutlineIcon: UserOutlineIcon, SolidIcon: UserSolidIcon },
            ]).map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = isActive ? tab.SolidIcon : tab.OutlineIcon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-0.5 py-1 px-3 ${
                    isActive ? 'text-brand-pink' : 'text-icon-inactive'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center pb-1">
            <div className="w-32 h-1 bg-gray-900 rounded-full" />
          </div>
        </div>
      </nav>
    </div>
  );
}
