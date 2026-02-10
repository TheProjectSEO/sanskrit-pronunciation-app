'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Deity {
  id: string;
  name: string;
  name_devanagari: string | null;
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [deities, setDeities] = useState<Deity[]>([]);
  const [selectedDeity, setSelectedDeity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeities();
  }, []);

  useEffect(() => {
    fetchMantras(selectedDeity);
  }, [selectedDeity]);

  const fetchDeities = async () => {
    try {
      const response = await fetch('/api/deities');
      if (response.ok) {
        const data = await response.json();
        setDeities(data.deities || []);
      }
    } catch (err) {
      console.error('Error fetching deities:', err);
    }
  };

  const fetchMantras = async (deityId: string | null) => {
    try {
      setLoading(true);
      const url = deityId ? `/api/mantras?deity_id=${deityId}` : '/api/mantras';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMantras(data.mantras || []);
      }
    } catch (err) {
      console.error('Error fetching mantras:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪷</span>
              <span className="text-lg font-bold text-gray-900">Tapaswe</span>
            </div>
            <div className="flex items-center gap-3">
              {status === 'authenticated' ? (
                <>
                  {session?.user?.role === 'instructor' && (
                    <Link
                      href="/instructor/mantras"
                      className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full font-medium"
                    >
                      Instructor
                    </Link>
                  )}
                  <Link
                    href="/api/auth/signout"
                    className="text-sm text-gray-500"
                  >
                    Logout
                  </Link>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="text-sm px-4 py-1.5 bg-orange-500 text-white rounded-full font-medium"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Welcome Card */}
        {status === 'authenticated' && session?.user && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 mb-6 text-white">
            <p className="text-orange-100 text-sm">Welcome back</p>
            <h2 className="text-xl font-bold">{session.user.name || 'Practitioner'}</h2>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                <span>🔥</span>
                <span className="text-sm">3 day streak</span>
              </div>
              <div className="flex items-center gap-1">
                <span>✨</span>
                <span className="text-sm">0 XP</span>
              </div>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Practice Mantras</h2>
          <span className="text-sm text-gray-500">{mantras.length} available</span>
        </div>

        {/* Deity Filter Tabs */}
        {deities.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            <button
              onClick={() => setSelectedDeity(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDeity === null
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
              }`}
            >
              All
            </button>
            {deities.map((deity) => (
              <button
                key={deity.id}
                onClick={() => setSelectedDeity(deity.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedDeity === deity.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                }`}
              >
                {deity.name_devanagari || deity.name}
              </button>
            ))}
          </div>
        )}

        {/* Mantras List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : mantras.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <span className="text-4xl mb-4 block">🙏</span>
            <p className="text-gray-500">No mantras available yet.</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mantras.map((mantra) => (
              <Link
                key={mantra.id}
                href={`/practice/${mantra.id}`}
                className="block bg-white rounded-2xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🙏</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                      {mantra.name}
                    </h3>
                    <p className="text-orange-600 text-base mb-0.5 truncate">
                      {mantra.reference_text_devanagari}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      {mantra.reference_text_roman}
                    </p>
                    {mantra.verse_count > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded-full">
                        {mantra.verse_count} {mantra.verse_count === 1 ? 'verse' : 'verses'}
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-orange-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Sign Up CTA for non-authenticated users */}
        {status !== 'authenticated' && !loading && mantras.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl p-6 text-center">
            <h3 className="font-bold text-gray-900 mb-2">Start Your Journey</h3>
            <p className="text-gray-500 text-sm mb-4">
              Sign in to track progress and get personalized feedback
            </p>
            <Link
              href="/signup"
              className="inline-block w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
