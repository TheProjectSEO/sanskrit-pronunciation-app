'use client';

import type { ScoredWord } from '@/lib/pronunciation/types';

interface Props {
  devanagariWords: string[];
  romanWords: string[];
  verseNumber?: number | null;
  marks?: ScoredWord[] | null;
  focusIndex?: number | null;
  playingIndex: number | null;
  onWord: (index: number, source: 'deva' | 'roman') => void;
  hint: string;
  heardLabel: string;
}

const DEVA_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const devaNum = (n: number) => String(n).split('').map((d) => DEVA_DIGITS[+d] ?? d).join('');

/**
 * The mantra on a soft purple card: Devanagari large, IAST beneath each word.
 * After a result, a wrong word turns orange-red and underlined, an unsure one amber
 * and dotted. Every word is a button that plays the teacher saying it.
 */
export function Folio({ devanagariWords, romanWords, verseNumber, marks, focusIndex, playingIndex, onWord, hint, heardLabel }: Props) {
  const paired = devanagariWords.length === romanWords.length;
  const count = paired ? romanWords.length : Math.max(devanagariWords.length, romanWords.length);

  return (
    <section aria-label="mantra" className="relative">
      <div className="rounded-[15px] bg-card-purple-light px-3 py-6 md:px-6">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 px-1" lang="sa">
          {Array.from({ length: count }).map((_, i) => {
            const deva = paired ? devanagariWords[i] : devanagariWords[i] ?? '';
            const roman = romanWords[i] ?? '';
            const mark = paired ? marks?.[i] : undefined;
            const status = mark?.status ?? 'ok';
            const isFocus = paired && focusIndex === i;
            const playing = paired && playingIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onWord(i, paired ? 'roman' : 'deva')}
                aria-label={`${roman || deva}${status !== 'ok' && mark?.heard ? `, ${heardLabel}: ${mark.heard}` : ''}`}
                aria-pressed={playing}
                className={[
                  'group relative flex min-h-12 min-w-12 flex-col items-center rounded-md px-1.5 pt-1 pb-1.5 transition-colors',
                  'hover:bg-card-purple active:bg-card-purple',
                  playing ? 'bg-card-purple' : '',
                  isFocus ? 'bg-card-pink' : '',
                ].join(' ')}
              >
                {deva && (
                  <span
                    className={[
                      'font-mantra text-[2.1rem] leading-[1.35] sm:text-[2.5rem]',
                      status === 'ok' ? 'text-brand-purple' : status === 'check' ? 'text-warning' : 'text-danger',
                      status === 'check' ? 'underline decoration-dotted decoration-2 underline-offset-[10px]' : '',
                      status === 'wrong' ? 'underline decoration-2 underline-offset-[10px]' : '',
                    ].join(' ')}
                  >
                    {deva}
                  </span>
                )}
                {paired && roman && (
                  <span lang="sa-Latn" className={`font-mantra text-base italic ${status === 'ok' ? 'text-text-secondary' : status === 'check' ? 'text-warning' : 'text-danger'}`}>
                    {roman}
                  </span>
                )}
              </button>
            );
          })}
          {verseNumber != null && (
            <span aria-hidden className="font-mantra self-start pt-1 text-[2.1rem] leading-[1.35] text-brand-pink">
              ॥{devaNum(verseNumber)}॥
            </span>
          )}
        </div>
        {!paired && romanWords.length > 0 && (
          <div lang="sa-Latn" className="mt-4 flex flex-wrap justify-center gap-x-1 gap-y-1">
            {romanWords.map((w, i) => {
              const status = marks?.[i]?.status ?? 'ok';
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onWord(i, 'roman')}
                  aria-pressed={playingIndex === i}
                  aria-label={`${w}${status !== 'ok' && marks?.[i]?.heard ? `, ${heardLabel}: ${marks[i].heard}` : ''}`}
                  className={[
                    'font-mantra min-h-11 rounded-md px-1.5 text-lg italic transition-colors hover:bg-card-purple',
                    status === 'ok' ? 'text-text-secondary' : status === 'check' ? 'text-warning' : 'text-danger',
                    status === 'check' ? 'underline decoration-dotted decoration-2 underline-offset-4' : '',
                    status === 'wrong' ? 'underline decoration-2 underline-offset-4' : '',
                    focusIndex === i ? 'bg-card-pink' : '',
                    playingIndex === i ? 'bg-card-purple' : '',
                  ].join(' ')}
                >
                  {w}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-sm text-text-secondary">{hint}</p>
    </section>
  );
}
