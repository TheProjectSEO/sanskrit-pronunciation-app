'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon, MicrophoneIcon, PauseIcon, PlayIcon, StopIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { FEEDBACK_LANGUAGES, type FeedbackLanguage } from '@/lib/constants/languages';
import { copyFor, LANG_ATTR } from '@/lib/practice/copy';
import { findTimestamp, iastToDevanagari, matchWordAudio, playTimeRange, stopTimeRange, type WordBoundary } from '@/lib/practice/audio';
import { useRecorder, type Take } from '@/lib/practice/useRecorder';
import { playTTS, stopTTS } from '@/lib/audio/tts-player';
import { splitWords } from '@/lib/pronunciation/phonetic';
import type { AttemptResult } from '@/lib/pronunciation/types';
import { Folio } from '@/components/practice/Folio';
import { StepRail } from '@/components/practice/StepRail';
import { Segmented } from '@/components/practice/Segmented';
import { ResultPanel } from '@/components/practice/ResultPanel';
import { WordDrill } from '@/components/practice/WordDrill';
import { EarsPanel } from '@/components/practice/EarsPanel';
import { OwnerBar } from '@/components/practice/OwnerBar';
import { AppShell } from '@/components/shell/AppShell';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';
import { isAdmin } from '@/lib/roles';
import { VerdictAsk } from '@/components/practice/VerdictAsk';
import { ProgressTrail, type Attempt } from '@/components/practice/ProgressTrail';

interface Verse {
  id: string;
  verse_number: number;
  title: string | null;
  text_devanagari: string;
  text_roman: string;
  audio_start_time: number | null;
  audio_end_time: number | null;
}

interface Mantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  reference_audio_url: string;
  is_owner?: boolean;
  status?: string;
}

type Phase = 'listen' | 'repeat' | 'analyzing' | 'result';
type InlineError = { message: string; detail?: string; retry?: () => void };

export default function PracticePage() {
  const { data: session } = useSession();
  const mantraId = useParams().id as string;

  const [mantra, setMantra] = useState<Mantra | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);

  const [boundaries, setBoundaries] = useState<WordBoundary[]>([]);
  const [timestamps, setTimestamps] = useState<Record<string, { start: number; end: number }>>({});
  const [wordAudioMap, setWordAudioMap] = useState<Record<string, string>>({});
  const [wordRefUrl, setWordRefUrl] = useState('');

  const [lang, setLang] = useState<FeedbackLanguage>('hindi');
  // The interface follows the app language; `lang` is the guru's feedback language.
  const { lang: appLang } = useAppLanguage();
  const copy = copyFor(appLang === 'hi' ? 'hindi' : 'english');
  const langAttr = LANG_ATTR[appLang === 'hi' ? 'hindi' : 'english'];

  const [phase, setPhase] = useState<Phase>('listen');
  const [speed, setSpeed] = useState<number>(1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playingWord, setPlayingWord] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [result, setResult] = useState<AttemptResult | null>(null);
  const [inlineError, setInlineError] = useState<InlineError | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [guruSpeaking, setGuruSpeaking] = useState(false);
  const [drill, setDrill] = useState<{ roman: string; devanagari: string; index: number } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  // ---------- data ----------
  useEffect(() => {
    if (!mantraId) return;
    (async () => {
      try {
        const res = await fetch(`/api/mantras/${mantraId}`);
        if (!res.ok) throw new Error();
        setMantra((await res.json()).mantra);
        setLoadState('ready');
      } catch {
        setLoadState('failed');
      }
    })();
    fetch(`/api/mantras/${mantraId}/verses`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setVerses(d.verses || [])).catch(() => {});
    fetch(`/api/mantras/${mantraId}/word-audio`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      setWordAudioMap(d.word_audio_map || {});
      setTimestamps(d.word_timestamps || {});
      setBoundaries(d.word_boundaries || []);
      setWordRefUrl(d.reference_audio_url || '');
    }).catch(() => {});
  }, [mantraId]);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/user/preferences').then((r) => (r.ok ? r.json() : null)).then((d) => d?.feedback_language && setLang(d.feedback_language)).catch(() => {});
  }, [session]);

  const loadProgress = useCallback(() => {
    if (!session?.user || !mantraId) return;
    const qs = new URLSearchParams({ mantra_id: mantraId });
    if (verse) qs.set('verse_id', verse.id);
    fetch(`/api/progress?${qs}`).then((r) => (r.ok ? r.json() : null)).then((d) => setAttempts(d?.attempts || [])).catch(() => {});
  }, [session, mantraId, verse]);
  useEffect(() => { loadProgress(); }, [loadProgress]);

  const changeLang = (l: FeedbackLanguage) => {
    setLang(l);
    if (session?.user) fetch('/api/user/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback_language: l }) }).catch(() => {});
  };

  // ---------- active text ----------
  const devanagari = verse?.text_devanagari || mantra?.reference_text_devanagari || '';
  const roman = verse?.text_roman || mantra?.reference_text_roman || '';
  const devaWords = useMemo(() => splitWords(devanagari), [devanagari]);
  const romanWords = useMemo(() => splitWords(roman), [roman]);
  const range = verse && verse.audio_start_time != null && verse.audio_end_time != null ? { start: verse.audio_start_time, end: verse.audio_end_time } : null;

  // Word boundaries are indexed over the whole mantra; a verse uses the ones inside its time range.
  const activeBoundaries = useMemo(
    () => (range ? boundaries.filter((b) => b.start >= range.start - 0.15 && b.end <= range.end + 0.15) : boundaries),
    [boundaries, range],
  );

  const selectVerse = (v: Verse | null) => {
    stopAll();
    setVerse(v);
    setResult(null);
    setTake(null);
    setInlineError(null);
    setPhase('listen');
  };

  // ---------- teacher playback ----------
  const stopAll = () => {
    audioRef.current?.pause();
    setPlaying(false);
    stopTimeRange();
    stopTTS();
    setGuruSpeaking(false);
  };

  const playTeacher = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    stopTimeRange();
    a.playbackRate = speed;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    if (range && (a.currentTime < range.start || a.currentTime >= range.end - 0.05)) a.currentTime = range.start;
    if (!range && a.ended) a.currentTime = 0;
    try {
      await a.play();
      setPlaying(true);
    } catch {
      setInlineError({ message: copy.errors.network });
    }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    const start = range?.start ?? 0;
    const end = range?.end ?? (a.duration || 1);
    setProgress(Math.min(1, Math.max(0, (a.currentTime - start) / Math.max(0.01, end - start))));
    if (range && a.currentTime >= range.end) {
      a.pause();
      a.currentTime = range.start;
      onTeacherFinished();
    }
  };
  const onTeacherFinished = () => {
    setPlaying(false);
    setProgress(0);
    setPhase((p) => (p === 'listen' ? 'repeat' : p));
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const playWord = useCallback(async (index: number, source: 'deva' | 'roman' = 'roman') => {
    const word = (source === 'deva' ? devaWords[index] : romanWords[index]) || '';
    audioRef.current?.pause();
    setPlaying(false);
    setPlayingWord(index);
    try {
      const ts = findTimestamp(word, index, activeBoundaries, timestamps);
      if (ts && wordRefUrl) await playTimeRange(wordRefUrl, ts.start, ts.end);
      else {
        const url = matchWordAudio(word, wordAudioMap);
        if (url) await new Audio(url).play();
        else await playTTS(word);
      }
    } catch {
      /* playback failure is not worth interrupting the learner */
    } finally {
      setPlayingWord(null);
    }
  }, [romanWords, devaWords, activeBoundaries, timestamps, wordRefUrl, wordAudioMap]);

  // ---------- recording + analysis ----------
  const analyze = useCallback(async (t: Take) => {
    if (!mantra) return;
    setTake(t);
    setPhase('analyzing');
    setInlineError(null);
    try {
      const fd = new FormData();
      fd.append('audio', t.wav, 'attempt.wav');
      fd.append('mantra_id', mantra.id);
      if (verse) fd.append('verse_id', verse.id);
      fd.append('feedback_language', lang);
      const res = await fetch('/api/analyze-pronunciation', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || copy.errors.network);
      setResult(data as AttemptResult);
      setPhase('result');
      if (data.status === 'ok') loadProgress();
      if (data.guru_line) speakGuru(data.guru_line);
    } catch (e) {
      setPhase('repeat');
      setInlineError({ message: e instanceof Error ? e.message : copy.errors.network, retry: () => analyze(t) });
    }
    // speakGuru is stable enough; lang/verse captured per attempt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mantra, verse, lang, copy, loadProgress]);

  const recorder = useRecorder(analyze);

  useEffect(() => {
    if (!recorder.error) return;
    const e = recorder.error;
    setInlineError({
      message: e === 'micDenied' ? copy.errors.micDenied : copy.errors[e],
      detail: e === 'micDenied' ? copy.errors.micDeniedSteps : undefined,
      retry: () => { recorder.clearError(); setInlineError(null); recorder.start(); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.error, copy]);

  const startChant = () => {
    stopAll();
    setInlineError(null);
    setResult(null);
    setPhase('repeat');
    recorder.start();
  };

  const speakGuru = async (text: string) => {
    setGuruSpeaking(true);
    try { await playTTS(text); } catch { /* text is on screen */ } finally { setGuruSpeaking(false); }
  };

  const hearYourself = () => {
    if (!take) return;
    stopAll();
    new Audio(take.url).play().catch(() => {});
  };

  const nextVerse = verse ? verses.find((v) => v.verse_number === verse.verse_number + 1) ?? null : verses[0] ?? null;
  const focusIndex = result?.focus ? romanWords.findIndex((w) => w === result.focus!.word) : -1;

  // ---------- render ----------
  if (loadState === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white">
        <span className="font-mantra animate-pulse text-5xl text-brand-pink" aria-label="loading">ॐ</span>
      </main>
    );
  }
  if (loadState === 'failed' || !mantra) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-lg text-text-primary" lang={langAttr}>{copy.errors.loadFailed}</p>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-full bg-brand-purple px-6 font-semibold text-white">{copy.back}</Link>
      </main>
    );
  }

  const step: 0 | 1 | 2 = phase === 'listen' ? 0 : phase === 'result' ? 2 : 1;
  const busy = recorder.preparing || phase === 'analyzing';

  return (
    <AppShell hideBottomNav>
    <div className="pb-40">
      <div className="border-b border-line bg-card-purple-light">
        <div className="mx-auto flex max-w-xl items-center gap-1 px-2 py-1.5">
          <Link href="/" aria-label={copy.back} className="flex h-12 w-12 items-center justify-center rounded-full text-brand-purple hover:bg-card-purple">
            <ChevronLeftIcon aria-hidden className="h-6 w-6" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-brand-purple">{mantra.name}</h1>
        </div>
      </div>
      {mantra.is_owner && mantra.status && mantra.status !== 'published' && <OwnerBar mantraId={mantra.id} status={mantra.status} />}

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-5" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        {verses.length > 0 && (
          <nav aria-label={copy.fullMantra} className="-mx-4 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex gap-1 border-b border-line-strong" role="tablist">
              {[null, ...verses].map((v) => {
                const on = (v?.id ?? null) === (verse?.id ?? null);
                return (
                  <button
                    key={v?.id ?? 'full'}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => selectVerse(v)}
                    className={`-mb-px min-h-12 shrink-0 border-b-2 px-3 text-[0.95rem] whitespace-nowrap ${on ? 'border-brand-pink font-semibold text-brand-pink' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                    lang={langAttr}
                  >
                    {v ? copy.verse(v.verse_number) : copy.fullMantra}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <Folio
          devanagariWords={devaWords}
          romanWords={romanWords}
          verseNumber={verse?.verse_number ?? null}
          marks={result?.status === 'ok' ? result.words : null}
          focusIndex={focusIndex >= 0 ? focusIndex : null}
          playingIndex={playingWord}
          onWord={(i, source) => {
            if (source === 'deva') { playWord(i, 'deva'); return; }
            const mark = result?.status === 'ok' ? result.words[i] : null;
            if (mark && mark.status !== 'ok') setDrill({ roman: romanWords[i], devanagari: devaWords.length === romanWords.length ? devaWords[i] : iastToDevanagari(romanWords[i]), index: i });
            else playWord(i);
          }}
          hint={copy.tapWord}
          heardLabel={copy.heard}
        />

        <StepRail steps={copy.steps} current={step} />

        <section className="flex flex-col gap-4" lang={langAttr}>
          {phase !== 'result' && (
            <>
              <h2 className="text-center text-[1.15rem] font-semibold text-text-primary">{phase === 'listen' ? copy.listenTitle : copy.repeatTitle}</h2>
              <div className="h-1.5 overflow-hidden rounded-full bg-card-purple" aria-hidden>
                <div className="h-full bg-brand-purple transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
              <Segmented<number>
                label={copy.speedLabel}
                value={speed}
                onChange={setSpeed}
                options={[
                  { value: 0.6, label: copy.speeds.veryslow },
                  { value: 0.8, label: copy.speeds.slow },
                  { value: 1, label: copy.speeds.normal },
                ]}
              />
            </>
          )}

          {phase === 'result' && result && (
            <ResultPanel
              result={result}
              copy={copy}
              langAttr={langAttr}
              guruSpeaking={guruSpeaking}
              onHearGuru={() => (guruSpeaking ? (stopTTS(), setGuruSpeaking(false)) : speakGuru(result.guru_line))}
              onHearTeacher={() => { stopAll(); playTeacher(); }}
              onHearYourself={take ? hearYourself : null}
              onHearFocusWord={() => focusIndex >= 0 && playWord(focusIndex)}
              onPracticeFocusWord={() => focusIndex >= 0 && setDrill({ roman: romanWords[focusIndex], devanagari: result.focus?.devanagari || iastToDevanagari(romanWords[focusIndex]), index: focusIndex })}
            />
          )}

          {phase === 'result' && result?.debug && isAdmin(session?.user?.role) && <EarsPanel debug={result.debug} />}

          {phase === 'result' && result?.log_id && result.status !== 'say_again' && (
            <VerdictAsk key={result.log_id} logId={result.log_id} wav={take?.wav ?? null} copy={copy} langAttr={langAttr} />
          )}

          {(phase === 'listen' || phase === 'result') && <ProgressTrail attempts={attempts} copy={copy} langAttr={langAttr} />}

          {inlineError && (
            <div role="alert" className="rounded-md border border-brand-pink/40 bg-card-pink px-4 py-3 text-text-primary">
              <p className="font-semibold text-brand-pink">{inlineError.message}</p>
              {inlineError.detail && <p className="mt-1 text-[0.95rem] leading-relaxed">{inlineError.detail}</p>}
              {inlineError.retry && (
                <button type="button" onClick={inlineError.retry} className="mt-2 inline-flex min-h-12 items-center gap-2 font-semibold text-brand-purple underline underline-offset-4">
                  <ArrowPathIcon aria-hidden className="h-5 w-5" /> {copy.errors.retry}
                </button>
              )}
            </div>
          )}

          <label className="flex items-center justify-between gap-3 text-[0.95rem] text-text-secondary">
            {copy.feedbackIn}
            <select
              value={lang}
              onChange={(e) => changeLang(e.target.value as FeedbackLanguage)}
              className="min-h-12 rounded-lg border border-line-strong bg-card-purple-light px-3 text-text-primary"
            >
              {FEEDBACK_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        </section>
      </main>

      {/* Thumb zone: one primary action for the current step */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-white/95 backdrop-blur-sm" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-3" lang={langAttr}>
          {phase === 'listen' && (
            <>
              <button type="button" onClick={playTeacher} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-purple text-lg font-semibold text-white shadow-[0_6px_14px_-8px_rgba(43,26,16,0.7)]">
                {playing ? <PauseIcon aria-hidden className="h-6 w-6" /> : <PlayIcon aria-hidden className="h-6 w-6" />}
                {playing ? copy.pause : copy.listen}
              </button>
              <button type="button" onClick={() => { stopAll(); setPhase('repeat'); }} aria-label={copy.startChant} className="flex h-14 w-14 items-center justify-center rounded-xl border border-line-strong bg-card-purple-light text-brand-purple">
                <MicrophoneIcon aria-hidden className="h-6 w-6" />
              </button>
            </>
          )}

          {(phase === 'repeat' || phase === 'analyzing') && (
            <>
              <button type="button" onClick={playTeacher} disabled={recorder.recording || busy} aria-label={playing ? copy.pause : copy.listenAgain} className="flex h-14 w-14 items-center justify-center rounded-xl border border-line-strong bg-card-purple-light text-brand-purple disabled:opacity-40">
                {playing ? <PauseIcon aria-hidden className="h-6 w-6" /> : <PlayIcon aria-hidden className="h-6 w-6" />}
              </button>
              {busy ? (
                <p className="flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-card-purple-light text-[1.05rem] text-text-primary" role="status">
                  <span aria-hidden className="font-mantra animate-pulse text-2xl text-brand-pink">ॐ</span>
                  {copy.listening}
                </p>
              ) : recorder.recording ? (
                <button type="button" onClick={recorder.stop} className="relative inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-pink text-lg font-semibold text-white ring-4 ring-brand-gold/60">
                  <StopIcon aria-hidden className="h-6 w-6" />
                  {copy.stopChant}
                  <span className="absolute right-4 tabular-nums text-base font-normal opacity-90">{recorder.maxSeconds - recorder.seconds}</span>
                </button>
              ) : (
                <button type="button" onClick={startChant} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-purple text-lg font-semibold text-white shadow-[0_6px_14px_-8px_rgba(43,26,16,0.7)]">
                  <MicrophoneIcon aria-hidden className="h-6 w-6" />
                  {copy.startChant}
                </button>
              )}
            </>
          )}

          {phase === 'result' && (
            <>
              {nextVerse && result?.status === 'ok' && result.band === 'close' ? (
                <button type="button" onClick={() => selectVerse(nextVerse)} className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl border border-line-strong bg-card-purple-light text-[1.05rem] font-semibold text-text-primary">
                  {copy.nextVerse}
                </button>
              ) : (
                <button type="button" onClick={() => { stopAll(); setResult(null); setPhase('listen'); }} aria-label={copy.listenAgain} className="flex h-14 w-14 items-center justify-center rounded-xl border border-line-strong bg-card-purple-light text-brand-purple">
                  <PlayIcon aria-hidden className="h-6 w-6" />
                </button>
              )}
              <button type="button" onClick={startChant} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-purple text-lg font-semibold text-white shadow-[0_6px_14px_-8px_rgba(43,26,16,0.7)]">
                <MicrophoneIcon aria-hidden className="h-6 w-6" />
                {copy.tryAgain}
              </button>
            </>
          )}
        </div>
        {recorder.recording && <p className="mx-auto mt-2 max-w-xl px-4 text-center text-sm text-text-secondary" lang={langAttr} role="status">{copy.recordingHint}</p>}
      </div>

      <audio
        ref={audioRef}
        src={mantra.reference_audio_url}
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onEnded={onTeacherFinished}
        onPause={() => setPlaying(false)}
        className="hidden"
      />

      {drill && (
        <WordDrill
          word={{ roman: drill.roman, devanagari: drill.devanagari }}
          mantraId={mantra.id}
          language={lang}
          langAttr={langAttr}
          copy={copy}
          onHearTeacher={() => playWord(drill.index)}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
    </AppShell>
  );
}
