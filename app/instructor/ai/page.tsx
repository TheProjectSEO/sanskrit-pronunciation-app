'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SparklesIcon, PlayIcon, TrashIcon, SpeakerWaveIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { BetaBadge, Card, PageTitle, Spinner } from '@/components/admin/ui';
import type { AiMantra } from '@/lib/ai/generate-mantras';

interface Draft { id: string; name: string; reference_text_devanagari: string; reference_audio_url: string; common_errors: { ai?: { confidence?: string; meaning?: string } } | null; created_at: string }

const IDEAS = ['5 short Ganesha mantras for beginners', 'Hanuman Chalisa, opening dohas', 'Mahamrityunjaya mantra split into lines', 'Shanti mantras for the start of a class'];
const CONF: Record<string, string> = { high: 'bg-success-bg text-success', medium: 'bg-warning-bg text-warning', low: 'bg-danger-bg text-danger' };

function Candidate({ m: initial, prompt, onSaved }: { m: AiMantra; prompt: string; onSaved: () => void }) {
  const [m, setM] = useState(initial);
  const [voice, setVoice] = useState(true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState('');
  const save = async () => {
    setState('saving');
    const r = await fetch('/api/admin/ai/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mantra: m, voice, prompt }) });
    if (r.ok) { setState('saved'); onSaved(); } else { setState('error'); setErr((await r.json().catch(() => ({}))).error || 'Could not save'); }
  };
  const field = 'w-full rounded-xl border border-line-strong bg-white px-3 py-2 focus:border-brand-pink focus:outline-none';
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${field} min-w-48 flex-1 font-bold text-brand-purple`} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} aria-label="Name" />
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONF[m.confidence]}`}>AI confidence: {m.confidence}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label><span className="mb-1 block text-sm font-medium">Devanagari</span>
          <textarea lang="sa" rows={4} className={`${field} font-mantra text-lg`} value={m.devanagari} onChange={(e) => setM({ ...m, devanagari: e.target.value })} /></label>
        <label><span className="mb-1 block text-sm font-medium">IAST (used for scoring)</span>
          <textarea rows={4} className={`${field} font-mantra`} value={m.iast} onChange={(e) => setM({ ...m, iast: e.target.value })} /></label>
      </div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="font-medium text-brand-purple">Meaning</dt><dd className="text-text-primary">{m.meaning || '—'}</dd></div>
        <div><dt className="font-medium text-brand-purple">Source</dt><dd className="text-text-primary">{m.source_note || '—'}</dd></div>
        <div><dt className="font-medium text-brand-purple">Deity · Category</dt><dd className="text-text-primary">{m.deity || '—'} · {m.category || '—'}</dd></div>
        <div><dt className="font-medium text-brand-purple">Verses</dt><dd className="text-text-primary">{m.verses.length > 1 ? `${m.verses.length} lines` : 'Single line'}</dd></div>
        {m.pronunciation_tips.length > 0 && (
          <div className="md:col-span-2"><dt className="font-medium text-brand-purple">Pronunciation tips</dt>
            <dd><ul className="mt-1 list-disc pl-5 text-text-primary">{m.pronunciation_tips.map((t, i) => <li key={i}><span className="font-mantra">{t.word}</span>: {t.tip}</li>)}</ul></dd></div>
        )}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-text-primary">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="h-4 w-4 accent-brand-pink" />
          <SpeakerWaveIcon aria-hidden className="h-4 w-4 text-brand-purple" /> Add AI voice (ElevenLabs)
        </label>
        <button type="button" onClick={save} disabled={state === 'saving' || state === 'saved'} className="ml-auto inline-flex min-h-10 items-center rounded-full bg-brand-purple px-5 text-sm font-medium text-white hover:bg-brand-purple-hover disabled:opacity-60">
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved as AI draft' : 'Save as AI draft'}
        </button>
      </div>
      {state === 'error' && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </Card>
  );
}

export default function AiStudioPage() {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cands, setCands] = useState<AiMantra[] | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const loadDrafts = () => fetch('/api/admin/ai/drafts').then((r) => (r.ok ? r.json() : { drafts: [] })).then((d) => setDrafts(d.drafts)).catch(() => setDrafts([]));
  useEffect(() => { loadDrafts(); }, []);

  const generate = async () => {
    setBusy(true); setErr(''); setCands(null);
    try {
      const r = await fetch('/api/admin/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, count }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not generate');
      setCands(d.mantras); setLastPrompt(prompt);
      if (!d.mantras.length) setErr('The AI did not find anything it could draft reliably. Try a more specific request.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not generate'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    await fetch(`/api/admin/ai/drafts?id=${id}`, { method: 'DELETE' });
    setConfirm(null); loadDrafts();
  };

  return (
    <>
      <PageTitle title="AI studio" sub="Draft mantras with AI: text, verses, meaning, pronunciation tips and an AI voice. Everything here is an AI draft: only admins can see it, and it cannot be published to users." action={<BetaBadge />} />
      <p className="mb-5 flex items-start gap-2 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning">
        <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        AI can get Sanskrit wrong. Treat every draft as a starting point: check the text with the teacher, then record the teacher on Record &amp; publish to put it in front of learners.
      </p>

      <Card className="mb-6">
        <label className="block"><span className="mb-1 block font-bold text-brand-purple">What should the AI draft?</span>
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. 5 short Ganesha mantras for beginners, with meanings"
            className="w-full rounded-xl border border-line-strong px-3 py-2 focus:border-brand-pink focus:outline-none" /></label>
        <div className="mt-2 flex flex-wrap gap-2">
          {IDEAS.map((i) => <button key={i} type="button" onClick={() => setPrompt(i)} className="min-h-9 rounded-full border border-line-strong px-3 text-sm text-brand-purple hover:bg-card-purple-light">{i}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">How many
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="min-h-10 rounded-xl border border-line-strong px-2 text-brand-purple">
              {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </select></label>
          <button type="button" onClick={generate} disabled={busy || prompt.trim().length < 3} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-pink px-6 font-semibold text-white hover:bg-brand-pink-hover disabled:opacity-50">
            <SparklesIcon aria-hidden className={`h-5 w-5 ${busy ? 'animate-pulse' : ''}`} /> {busy ? 'Drafting…' : 'Generate'}
          </button>
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      </Card>

      {busy && <Spinner />}
      {cands && cands.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-brand-purple">Review the drafts</h2>
          <div className="flex flex-col gap-4">{cands.map((m, i) => <Candidate key={`${lastPrompt}-${i}`} m={m} prompt={lastPrompt} onSaved={loadDrafts} />)}</div>
        </section>
      )}

      <h2 className="mb-3 text-lg font-bold text-brand-purple">Saved AI drafts</h2>
      {!drafts ? <Spinner /> : drafts.length === 0 ? <Card className="py-8 text-center text-text-secondary">No AI drafts yet.</Card> : (
        <Card className="p-0 md:p-0">
          <ul className="divide-y divide-line">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-brand-purple">{d.name}</span>
                  <span lang="sa" className="font-mantra block truncate text-sm text-text-secondary">{d.reference_text_devanagari}</span>
                </span>
                {d.reference_audio_url ? <audio src={d.reference_audio_url} controls preload="none" className="h-9 w-48" /> : <span className="text-xs text-text-secondary">No voice</span>}
                {d.reference_audio_url && (
                  <Link href={`/practice/${d.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-brand-purple hover:bg-card-purple-light"><PlayIcon aria-hidden className="h-4 w-4" /> Try it</Link>
                )}
                {confirm === d.id ? (
                  <span className="inline-flex items-center gap-2 text-sm">Delete?
                    <button type="button" onClick={() => remove(d.id)} className="min-h-10 rounded-full bg-danger px-3 font-medium text-white">Delete</button>
                    <button type="button" onClick={() => setConfirm(null)} className="min-h-10 px-2 text-text-secondary">Cancel</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(d.id)} aria-label={`Delete ${d.name}`} className="inline-flex min-h-10 items-center rounded-full px-2 text-text-secondary hover:text-danger"><TrashIcon aria-hidden className="h-5 w-5" /></button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
