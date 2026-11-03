'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { MicrophoneIcon, StopIcon, ArrowUpTrayIcon, CheckCircleIcon, LinkIcon } from '@heroicons/react/24/solid';
import { AppShell } from '@/components/shell/AppShell';
import { useAppLanguage } from '@/lib/i18n/AppLanguage';
import { useLibrary } from '@/lib/mantras/useLibrary';

const MAX_SEC = 180;

export default function RecordPage() {
  const { status } = useSession();
  const { t } = useAppLanguage();
  const { deities } = useLibrary();
  const [name, setName] = useState('');
  const [deva, setDeva] = useState('');
  const [roman, setRoman] = useState('');
  const [deityId, setDeityId] = useState('');
  const [audio, setAudio] = useState<{ blob: Blob; url: string; seconds?: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((x) => x.stop()); }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        setAudio({ blob, url: URL.createObjectURL(blob), seconds: secRef.current });
      };
      rec.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      secRef.current = 0;
      timer.current = setInterval(() => {
        secRef.current += 1;
        setSeconds(secRef.current);
        if (secRef.current >= MAX_SEC) stop();
      }, 1000);
    } catch {
      setError(t.record.errors.mic);
    }
  };
  const secRef = useRef(0);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.state === 'recording' && rec.current.stop();
    setRecording(false);
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setError(t.record.errors.tooLong); return; }
    setError(null);
    setAudio({ blob: f, url: URL.createObjectURL(f) });
  };

  const save = async () => {
    if (!name.trim()) { setError(t.record.errors.name); return; }
    if (!audio) { setError(t.record.errors.audio); return; }
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('devanagari', deva);
    fd.append('roman', roman);
    if (deityId) fd.append('deity_id', deityId);
    const ext = audio.blob.type.includes('mp4') ? 'm4a' : audio.blob.type.includes('wav') ? 'wav' : audio.blob.type.includes('mpeg') ? 'mp3' : 'webm';
    fd.append('audio', audio.blob, `recording.${ext}`);
    try {
      const res = await fetch('/api/my/mantras', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = data.error as keyof typeof t.record.errors;
        throw new Error(t.record.errors[key] || data.error || t.record.errors.failed);
      }
      setSaved({ id: data.mantra.id, name: data.mantra.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.record.errors.failed);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!saved) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/practice/${saved.id}`); setCopied(true); } catch { /* shown below */ }
  };

  const field = 'min-h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-text-primary placeholder:text-icon-inactive focus:border-brand-pink focus:outline-none';

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-8 md:pt-8">
        <h1 className="text-2xl font-bold text-brand-purple md:text-3xl">{t.record.title}</h1>
        <p className="mt-1 mb-6 text-text-secondary">{t.record.intro}</p>

        {status === 'unauthenticated' ? (
          <div className="rounded-2xl bg-card-purple p-6 text-center">
            <p className="text-brand-purple">{t.record.signIn}</p>
            <Link href="/signin" className="mt-4 inline-block rounded-xl bg-brand-pink px-6 py-3 font-semibold text-white">{t.nav.signIn}</Link>
          </div>
        ) : saved ? (
          <div className="rounded-2xl bg-success-bg p-6">
            <p className="flex items-center gap-2 text-lg font-bold text-success"><CheckCircleIcon aria-hidden className="h-6 w-6" /> {t.record.saved}: {saved.name}</p>
            <p className="mt-2 text-text-primary">{t.record.savedBody}</p>
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm break-all text-text-secondary select-all">{typeof window !== 'undefined' ? `${window.location.origin}/practice/${saved.id}` : ''}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/practice/${saved.id}`} className="inline-flex min-h-12 items-center rounded-xl bg-brand-pink px-5 font-semibold text-white hover:bg-brand-pink-hover">{t.record.open}</Link>
              <button type="button" onClick={copy} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-brand-purple">
                <LinkIcon aria-hidden className="h-5 w-5" /> {copied ? t.mantras.copied : t.mantras.share}
              </button>
              <Link href="/mantras?tab=mine" className="inline-flex min-h-12 items-center rounded-xl px-4 text-brand-purple underline underline-offset-4">{t.record.mine}</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="rounded-[15px] bg-card-purple-light p-4 md:p-5">
              <h2 className="mb-3 font-bold text-brand-purple">{t.record.step1}</h2>
              <div className="flex flex-col gap-3">
                <label className="block"><span className="mb-1 block text-sm font-medium text-text-primary">{t.record.name}</span>
                  <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.record.namePh} maxLength={120} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium text-text-primary">{t.record.deva}</span>
                  <textarea lang="sa" className={`${field} font-mantra min-h-20 py-3 text-lg`} value={deva} onChange={(e) => setDeva(e.target.value)} rows={2} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium text-text-primary">{t.record.roman}</span>
                  <textarea className={`${field} min-h-20 py-3`} value={roman} onChange={(e) => setRoman(e.target.value)} rows={2} /></label>
                <p className="text-sm text-text-secondary">{t.record.textHint}</p>
                {deities.length > 0 && (
                  <label className="block"><span className="mb-1 block text-sm font-medium text-text-primary">{t.record.deity}</span>
                    <select className={field} value={deityId} onChange={(e) => setDeityId(e.target.value)}>
                      <option value="">{t.record.none}</option>
                      {deities.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select></label>
                )}
              </div>
            </section>

            <section className="rounded-[15px] bg-card-pink-light p-4 text-center md:p-5">
              <h2 className="mb-4 text-left font-bold text-brand-purple">{t.record.step2}</h2>
              {audio && !recording ? (
                <div className="flex flex-col items-center gap-3">
                  <audio src={audio.url} controls className="w-full" />
                  {audio.seconds ? <p className="text-sm text-text-secondary">{t.record.recorded(audio.seconds)}</p> : null}
                  <button type="button" onClick={() => { setAudio(null); start(); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-brand-purple">
                    <MicrophoneIcon aria-hidden className="h-5 w-5" /> {t.record.again}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button type="button" onClick={recording ? stop : start} aria-label={recording ? t.record.stop : t.record.start}
                    className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-all ${recording ? 'scale-105 animate-pulse bg-brand-pink' : 'bg-brand-purple hover:bg-brand-purple-hover'}`}>
                    {recording ? <StopIcon aria-hidden className="h-12 w-12" /> : <MicrophoneIcon aria-hidden className="h-12 w-12" />}
                  </button>
                  <p className="font-semibold text-text-primary">{recording ? `${t.record.stop} · ${seconds}s / ${MAX_SEC}s` : t.record.start}</p>
                  {!recording && (
                    <>
                      <span className="text-sm text-text-secondary">{t.record.or}</span>
                      <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-brand-purple hover:bg-card-purple-light">
                        <ArrowUpTrayIcon aria-hidden className="h-5 w-5" /> {t.record.upload}
                        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                      </label>
                    </>
                  )}
                </div>
              )}
            </section>

            {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-danger">{error}</p>}

            <button type="button" onClick={save} disabled={saving || recording}
              className="min-h-14 rounded-xl bg-brand-pink text-lg font-semibold text-white hover:bg-brand-pink-hover disabled:opacity-60">
              {saving ? t.record.saving : t.record.save}
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
