/**
 * One-off script: Re-split all mantras using Whisper timestamps.
 *
 * Usage: npx tsx scripts/resplit-all-mantras.ts
 *
 * Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Load env from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('Missing env vars. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

async function splitMantra(mantraId: string, mantraName: string, audioUrl: string) {
  console.log(`\n--- Processing: ${mantraName} (${mantraId}) ---`);

  try {
    // Download audio
    console.log('  Downloading audio...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`  FAILED: Could not download audio (${audioResponse.status})`);
      return false;
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log(`  Audio size: ${(audioBuffer.length / 1024).toFixed(1)}KB`);

    // Whisper transcription with word timestamps
    console.log('  Getting word timestamps from Whisper...');
    const file = new File([new Uint8Array(audioBuffer)], 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      prompt: 'Sanskrit mantra shloka. Om Namah Shivaya. Hare Krishna. Gayatri mantra. Transcribe accurately preserving Sanskrit pronunciation.',
    });

    const words: WordTimestamp[] = (transcription as unknown as { words?: WordTimestamp[] }).words || [];

    if (words.length === 0) {
      console.error('  FAILED: Whisper detected no words');
      return false;
    }

    console.log(`  Detected ${words.length} words: ${words.map(w => w.word).join(', ')}`);

    // Delete existing word audio
    const { error: deleteError } = await supabase
      .from('mantra_word_audio')
      .delete()
      .eq('mantra_id', mantraId);

    if (deleteError) {
      console.error('  Warning: delete failed:', deleteError.message);
    }

    // Insert new timestamps using midpoint clamping (no overlap between words)
    const validWords = words.filter(w => w.word.trim());
    let inserted = 0;
    for (let i = 0; i < validWords.length; i++) {
      const wordInfo = validWords[i];
      const word = wordInfo.word.trim();

      let start = wordInfo.start;
      let end = wordInfo.end;

      // Clamp end to midpoint of gap before next word
      if (i < validWords.length - 1) {
        const nextStart = validWords[i + 1].start;
        if (end > nextStart) {
          end = (end + nextStart) / 2;
        } else {
          const gap = nextStart - end;
          end = end + Math.min(gap / 2, 0.03);
        }
      }

      // Clamp start to midpoint of gap after previous word
      if (i > 0) {
        const prevEnd = validWords[i - 1].end;
        if (start < prevEnd) {
          start = (prevEnd + start) / 2;
        } else {
          const gap = start - prevEnd;
          start = start - Math.min(gap / 2, 0.03);
        }
      }

      start = Math.max(0, start);

      const { error: insertError } = await supabase
        .from('mantra_word_audio')
        .insert({
          mantra_id: mantraId,
          word: word.toLowerCase(),
          word_position: i,
          start_time: start,
          end_time: end,
        });

      if (insertError) {
        console.error(`  Insert failed for "${word}":`, insertError.message);
        continue;
      }
      inserted++;
    }

    console.log(`  SUCCESS: ${inserted}/${words.length} words stored`);
    return true;
  } catch (err) {
    console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  console.log('=== Re-splitting all mantras with Whisper timestamps ===\n');

  // Fetch all mantras with audio
  const { data: mantras, error } = await supabase
    .from('mantras')
    .select('id, name, reference_audio_url, audio_url')
    .or('reference_audio_url.not.is.null,audio_url.not.is.null')
    .order('created_at', { ascending: true });

  if (error || !mantras) {
    console.error('Failed to fetch mantras:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${mantras.length} mantras with audio\n`);

  let success = 0;
  let failed = 0;

  for (const mantra of mantras) {
    const audioUrl = mantra.reference_audio_url || mantra.audio_url;
    if (!audioUrl) {
      console.log(`Skipping ${mantra.name}: no audio URL`);
      continue;
    }

    const result = await splitMantra(mantra.id, mantra.name, audioUrl);
    if (result) success++;
    else failed++;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== DONE: ${success} succeeded, ${failed} failed out of ${mantras.length} total ===`);
}

main().catch(console.error);
