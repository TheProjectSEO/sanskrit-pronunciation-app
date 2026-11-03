'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Card, PageTitle, Spinner, StatusBadge } from '@/components/admin/ui';

interface Row { id: string; name: string; status: string; has_audio: boolean; words: number; word_timings: number; teacher_literal: boolean; parts: { label: string; timed: boolean; ready: boolean }[] }
interface RunResult { label: string; ok: boolean; habits?: string[]; error?: string }

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${ok ? 'text-success' : 'text-warning'}`}>
      {ok ? <CheckCircleIcon aria-hidden className="h-4 w-4" /> : <ExclamationCircleIcon aria-hidden className="h-4 w-4" />} {label}
    </span>
  );
}

export default function PronunciationPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult[]>>({});
  const load = () => fetch('/api/admin/pronunciation').then((r) => (r.ok ? r.json() : { mantras: [] })).then((d) => setRows(d.mantras)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const run = async (id: string, force: boolean) => {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/pronunciation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mantra_id: id, force }) });
      const d = await r.json();
      setResults((x) => ({ ...x, [id]: d.results ?? [{ label: 'Error', ok: false, error: d.error }] }));
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Pronunciation" sub="Learners are judged against the teacher’s own recording. For that, each mantra (and each verse) needs a teacher reading. Word timings let learners tap a word and hear the teacher say it." />
      <Card className="mb-4 text-sm text-text-secondary">
        <b className="text-brand-purple">Teacher reading</b>: the engine listens to the teacher once and remembers how it hears each word, so a learner who sounds like the teacher is never marked wrong.
        {' '}<b className="text-brand-purple">Re-run</b> after replacing the recording or editing the text.
        {' '}<b className="text-brand-purple">Word timings</b> are set in the mantra editor.
      </Card>
      {!rows ? <Spinner /> : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const ready = r.has_audio && r.teacher_literal && r.parts.every((p) => !p.timed || p.ready);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-purple">{r.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <StatusBadge status={r.status} />
                      <Tick ok={r.has_audio} label={r.has_audio ? 'Teacher recording' : 'No recording'} />
                      {r.parts.filter((p) => p.timed).map((p) => <Tick key={p.label} ok={p.ready} label={`${p.label}: ${p.ready ? 'reading ready' : 'not prepared'}`} />)}
                      {r.parts.some((p) => !p.timed) && <Tick ok={false} label={`${r.parts.filter((p) => !p.timed).length} verse(s) without timing`} />}
                      <Tick ok={r.word_timings >= r.words} label={`Word timings ${r.word_timings}/${r.words}`} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/instructor/mantras/${r.id}`} className="inline-flex min-h-10 items-center rounded-full border border-line-strong px-4 text-sm text-brand-purple hover:bg-card-purple-light">Edit timings</Link>
                    <button type="button" disabled={!r.has_audio || busy === r.id} onClick={() => run(r.id, ready)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-pink px-4 text-sm font-medium text-white hover:bg-brand-pink-hover disabled:opacity-50">
                      <ArrowPathIcon aria-hidden className={`h-4 w-4 ${busy === r.id ? 'animate-spin' : ''}`} /> {busy === r.id ? 'Listening…' : ready ? 'Re-run' : 'Prepare'}
                    </button>
                  </div>
                </div>
                {results[r.id] && (
                  <ul className="mt-3 rounded-xl bg-card-purple-light p-3 text-sm">
                    {results[r.id].map((x) => (
                      <li key={x.label} className={x.ok ? 'text-text-primary' : 'text-danger'}>
                        <b>{x.label}</b>: {x.ok ? (x.habits?.length ? `ready · words the engine also mishears in the teacher: ${x.habits.join(', ')}` : 'ready') : x.error}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
