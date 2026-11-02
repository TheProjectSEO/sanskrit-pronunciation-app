'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareRecording, type PrepareProblem } from '@/lib/audio/prepare-recording';

export type RecorderError = 'micDenied' | 'micMissing' | PrepareProblem;
export interface Take { wav: Blob; url: string; durationSec: number }

const MAX_SEC = 20;

/**
 * Microphone capture with the failure modes named, so the UI can explain them
 * in place instead of replacing the page. The learner's raw clip URL is kept for
 * side-by-side playback with the teacher.
 */
export function useRecorder(onTake: (t: Take) => void) {
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastUrl = useRef<string | null>(null);
  const onTakeRef = useRef(onTake);
  onTakeRef.current = onTake;

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = s;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const r = new MediaRecorder(s, { mimeType: mime });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = async () => {
        cleanup();
        const raw = new Blob(chunks.current, { type: mime });
        setPreparing(true);
        const prepared = await prepareRecording(raw);
        setPreparing(false);
        if ('problem' in prepared) {
          setError(prepared.problem);
          return;
        }
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        const url = URL.createObjectURL(raw);
        lastUrl.current = url;
        onTakeRef.current({ wav: prepared.wav, url, durationSec: prepared.durationSec });
      };
      rec.current = r;
      r.start(250);
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds((x) => {
          if (x + 1 >= MAX_SEC) stop();
          return x + 1;
        });
      }, 1000);
    } catch (e) {
      cleanup();
      const name = (e as DOMException)?.name;
      setError(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'micMissing' : 'micDenied');
    }
  }, [stop]);

  useEffect(() => () => { cleanup(); if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  return { recording, preparing, seconds, maxSeconds: MAX_SEC, error, clearError: () => setError(null), start, stop };
}
