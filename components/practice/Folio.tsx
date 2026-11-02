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
 * The mantra as a printed folio: double rule frame, Devanagari at specimen scale,
 * IAST beneath each word, verse number rubricated between dandas.
 * After a result, corrections appear as sindoor marks, never as traffic-light colours.
 */
export function Folio({ devanagariWords, romanWords, verseNumber, marks, focusIndex, playingIndex, onWord, hint, heardLabel }: Props) {
  const paired = devanagariWords.length === romanWords.length;
  const count = paired ? romanWords.length : Math.max(devanagariWords.length, romanWords.length);

  return (
    <section aria-label="mantra" className="relative">
      <div className="border-y-[3px] border-double border-paper-edge py-6">
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
                  'hover:bg-paper-deep active:bg-paper-deep',
                  playing ? 'bg-paper-deep' : '',
                  isFocus ? 'bg-sindoor-wash' : '',
                ].join(' ')}
              >
                {deva && (
                  <span
                    className={[
                      'font-mantra text-[2.1rem] leading-[1.35] sm:text-[2.5rem]',
                      status === 'ok' ? 'text-ink' : 'text-sindoor',
                      status === 'check' ? 'underline decoration-sindoor decoration-dotted decoration-2 underline-offset-[10px]' : '',
                      status === 'wrong' ? 'underline decoration-sindoor decoration-2 underline-offset-[10px]' : '',
                    ].join(' ')}
                  >
                    {deva}
                  </span>
                )}
                {paired && roman && (
                  <span lang="sa-Latn" className={`font-mantra text-base italic ${status === 'ok' ? 'text-ink-soft' : 'text-sindoor'}`}>
                    {roman}
                  </span>
                )}
              </button>
            );
          })}
          {verseNumber != null && (
            <span aria-hidden className="font-mantra self-start pt-1 text-[2.1rem] leading-[1.35] text-sindoor">
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
                    'font-mantra min-h-11 rounded-md px-1.5 text-lg italic transition-colors hover:bg-paper-deep',
                    status === 'ok' ? 'text-ink-soft' : 'text-sindoor',
                    status === 'check' ? 'underline decoration-dotted decoration-2 underline-offset-4' : '',
                    status === 'wrong' ? 'underline decoration-2 underline-offset-4' : '',
                    focusIndex === i ? 'bg-sindoor-wash' : '',
                    playingIndex === i ? 'bg-paper-deep' : '',
                  ].join(' ')}
                >
                  {w}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-sm text-ink-soft">{hint}</p>
    </section>
  );
}
