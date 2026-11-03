import Link from 'next/link';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { deityEmoji, type Deity, type LibraryMantra } from '@/lib/mantras/useLibrary';

const THEMES = [
  { bg: 'bg-card-purple', imgBg: 'bg-card-purple-light' },
  { bg: 'bg-card-pink', imgBg: 'bg-card-pink-light' },
] as const;

/** The original Tapaswe mantra card: deity picture on a tinted panel, name, verse count. */
export function MantraCard({ mantra, idx, deity, versesLabel, fluid = false }: {
  mantra: Pick<LibraryMantra, 'id' | 'name' | 'verse_count' | 'reference_text_devanagari'>;
  idx: number;
  deity?: Deity | null;
  versesLabel: (n: number) => string;
  fluid?: boolean;
}) {
  const theme = THEMES[idx % 2];
  return (
    <Link
      href={`/practice/${mantra.id}`}
      className={`${fluid ? 'w-full' : 'w-[205px] flex-shrink-0'} ${theme.bg} overflow-hidden rounded-[15px] transition-transform hover:scale-[1.02] active:scale-[0.97]`}
    >
      <div className={`${theme.imgBg} flex h-[110px] items-center justify-center`}>
        {deity?.image_url ? (
          <img src={deity.image_url} alt={deity.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl" aria-hidden>{deityEmoji(deity)}</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-brand-purple">{mantra.name}</h3>
        <p lang="sa" className="font-mantra mb-1.5 truncate text-[0.95rem] text-text-primary">{mantra.reference_text_devanagari.split(/[।॥\n|]/)[0]}</p>
        {mantra.verse_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <BookOpenIcon aria-hidden className="h-3.5 w-3.5" /> {versesLabel(mantra.verse_count)}
          </span>
        )}
      </div>
    </Link>
  );
}
