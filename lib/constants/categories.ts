// Mantra categories for filtering
export const MANTRA_CATEGORIES = [
  'Meditation',
  'Prayer',
  'Protection',
  'Peace',
  'Healing',
  'Wisdom',
  'Devotion',
  'Prosperity',
] as const;

export type MantraCategory = typeof MANTRA_CATEGORIES[number];
