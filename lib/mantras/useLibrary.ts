'use client';

import { useEffect, useMemo, useState } from 'react';

export interface Deity { id: string; name: string; name_devanagari: string | null; image_url: string | null }
export interface LibraryMantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  difficulty_level: number;
  category: string | null;
  deity_id: string | null;
  verse_count: number;
}

/** Published mantras and deities, loaded once per page. */
export function useLibrary() {
  const [mantras, setMantras] = useState<LibraryMantra[]>([]);
  const [deities, setDeities] = useState<Deity[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch('/api/mantras').then((r) => (r.ok ? r.json() : { mantras: [] })),
      fetch('/api/deities').then((r) => (r.ok ? r.json() : { deities: [] })),
    ])
      .then(([m, d]) => { setMantras(m.mantras || []); setDeities(d.deities || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const deityMap = useMemo(() => Object.fromEntries(deities.map((d) => [d.id, d])) as Record<string, Deity>, [deities]);
  return { mantras, deities, deityMap, loading };
}

export function deityEmoji(deity?: Deity | null) {
  const name = deity?.name.toLowerCase() ?? '';
  if (!name) return '🙏';
  if (name.includes('ganesh') || name.includes('ganapati')) return '🐘';
  if (name.includes('shiva')) return '🔱';
  if (name.includes('vishnu') || name.includes('krishna')) return '🪈';
  if (name.includes('lakshmi')) return '🪷';
  if (name.includes('saraswati')) return '🎵';
  if (name.includes('hanuman')) return '🐒';
  if (name.includes('durga') || name.includes('devi')) return '⚔️';
  return '🕉️';
}
