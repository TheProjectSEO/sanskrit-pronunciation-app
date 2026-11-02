'use client';

/**
 * Browser-side preprocessing for a practice recording:
 * decode -> mono -> 16 kHz -> trim silence -> normalise -> 16-bit PCM WAV.
 * Rejects clips that are too short or too quiet before they cost an API call.
 */

export type PrepareProblem = 'too_short' | 'too_quiet' | 'too_long' | 'decode_failed';

export interface PreparedRecording {
  wav: Blob;
  durationSec: number;
  rmsDb: number;
}

const RATE = 16000;
const MIN_SEC = 0.6;
const MAX_SEC = 20;
const QUIET_DB = -45;

export async function prepareRecording(input: Blob): Promise<PreparedRecording | { problem: PrepareProblem }> {
  let decoded: AudioBuffer;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    decoded = await ctx.decodeAudioData(await input.arrayBuffer());
    ctx.close().catch(() => {});
  } catch {
    return { problem: 'decode_failed' };
  }

  // Resample + mix to mono in one pass.
  const frames = Math.max(1, Math.ceil(decoded.duration * RATE));
  const off = new OfflineAudioContext(1, frames, RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);

  // Trim leading/trailing silence using 20 ms windows relative to the loudest window.
  const win = Math.round(RATE * 0.02);
  const energies: number[] = [];
  for (let i = 0; i < mono.length; i += win) {
    let s = 0;
    const end = Math.min(mono.length, i + win);
    for (let j = i; j < end; j++) s += mono[j] * mono[j];
    energies.push(Math.sqrt(s / Math.max(1, end - i)));
  }
  const peakEnergy = Math.max(...energies, 1e-9);
  const floor = peakEnergy * 0.08;
  let first = energies.findIndex((e) => e > floor);
  let last = energies.length - 1 - [...energies].reverse().findIndex((e) => e > floor);
  if (first < 0) return { problem: 'too_quiet' };
  first = Math.max(0, first - 10); // keep 200 ms of lead-in
  last = Math.min(energies.length - 1, last + 15); // and 300 ms of tail (visarga, final vowels)
  const trimmed = mono.slice(first * win, Math.min(mono.length, (last + 1) * win));

  const durationSec = trimmed.length / RATE;
  if (durationSec < MIN_SEC) return { problem: 'too_short' };
  if (durationSec > MAX_SEC + 1) return { problem: 'too_long' };

  let sum = 0;
  let peak = 0;
  for (let i = 0; i < trimmed.length; i++) {
    sum += trimmed[i] * trimmed[i];
    peak = Math.max(peak, Math.abs(trimmed[i]));
  }
  const rms = Math.sqrt(sum / trimmed.length);
  const rmsDb = 20 * Math.log10(rms + 1e-12);
  if (rmsDb < QUIET_DB) return { problem: 'too_quiet' };

  // Peak-normalise to -1 dBFS.
  const gain = peak > 0 ? 0.89 / peak : 1;
  return { wav: encodeWav(trimmed, gain), durationSec, rmsDb };
}

function encodeWav(samples: Float32Array, gain: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] * gain));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
