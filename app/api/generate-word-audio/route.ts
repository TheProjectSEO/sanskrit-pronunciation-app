import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import OpenAI from 'openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get ffmpeg binary path - resolve from node_modules to avoid Next.js bundling issues
function getFfmpegPath(): string {
  // First try: direct path to node_modules binary (most reliable with Next.js)
  const directPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
  try {
    const fs = require('fs');
    if (fs.existsSync(directPath)) {
      return directPath;
    }
  } catch {}

  // Second try: require ffmpeg-static (works when not bundled)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static');
    if (staticPath) return staticPath;
  } catch {}

  // Fallback: system ffmpeg
  return 'ffmpeg';
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const { mantra_id } = await request.json();

    if (!mantra_id) {
      return NextResponse.json({ error: 'mantra_id is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get the mantra with its reference audio
    const { data: mantra, error: mantraError } = await supabase
      .from('mantras')
      .select('id, name, reference_audio_url, audio_url, reference_text_roman, text_latin')
      .eq('id', mantra_id)
      .single();

    if (mantraError || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const audioUrl = mantra.reference_audio_url || mantra.audio_url;
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No reference audio found for this mantra. Please upload audio first.' },
        { status: 400 }
      );
    }

    // Step 1: Download the reference audio
    console.log('Downloading reference audio...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json({ error: 'Failed to download reference audio' }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const contentType = audioResponse.headers.get('content-type') || 'audio/webm';
    const ext = contentType.includes('mp3') ? 'mp3' : contentType.includes('wav') ? 'wav' : 'webm';

    // Save to temp file
    const tempDir = path.join(os.tmpdir(), 'tapaswe-word-audio');
    await mkdir(tempDir, { recursive: true });
    const tempInputPath = path.join(tempDir, `input-${mantra_id}.${ext}`);
    await writeFile(tempInputPath, audioBuffer);
    tempFiles.push(tempInputPath);

    // Step 2: Convert to WAV for Whisper (if not already wav)
    let whisperInputPath = tempInputPath;
    if (ext !== 'wav') {
      const tempWavPath = path.join(tempDir, `input-${mantra_id}.wav`);
      const ffmpegPath = getFfmpegPath();
      await execFileAsync(ffmpegPath, [
        '-i', tempInputPath,
        '-ar', '16000',
        '-ac', '1',
        '-f', 'wav',
        '-y',
        tempWavPath,
      ]);
      whisperInputPath = tempWavPath;
      tempFiles.push(tempWavPath);
    }

    // Step 3: Get word-level timestamps from Whisper
    console.log('Getting word timestamps from Whisper...');
    const whisperFile = await readFile(whisperInputPath);
    const file = new File([whisperFile], 'audio.wav', { type: 'audio/wav' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      prompt: 'Sanskrit mantra shloka. Om Namah Shivaya. Hare Krishna. Gayatri mantra. Transcribe accurately preserving Sanskrit pronunciation.',
    });

    const words: WordTimestamp[] = (transcription as unknown as { words?: WordTimestamp[] }).words || [];

    if (words.length === 0) {
      return NextResponse.json(
        { error: 'Whisper could not detect word boundaries in the audio. Try re-recording with clearer pauses between words.' },
        { status: 400 }
      );
    }

    console.log(`Detected ${words.length} words:`, words.map(w => `${w.word}(${w.start}-${w.end})`).join(', '));

    // Step 4: Split audio into word segments using FFmpeg
    const ffmpegPath = getFfmpegPath();
    const processedWords: Array<{ word: string; position: number; audio_url: string; start: number; end: number }> = [];

    for (let i = 0; i < words.length; i++) {
      const wordInfo = words[i];
      const word = wordInfo.word.trim();
      if (!word) continue;

      // Add small padding around word boundaries for natural sound
      const padding = 0.05; // 50ms
      const start = Math.max(0, wordInfo.start - padding);
      const duration = (wordInfo.end - wordInfo.start) + (padding * 2);

      // Extract word audio segment
      const tempWordPath = path.join(tempDir, `word-${mantra_id}-${i}-${word.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`);
      tempFiles.push(tempWordPath);

      try {
        await execFileAsync(ffmpegPath, [
          '-i', whisperInputPath,
          '-ss', start.toFixed(3),
          '-t', duration.toFixed(3),
          '-ar', '44100',
          '-ac', '1',
          '-b:a', '128k',
          '-f', 'mp3',
          '-y',
          tempWordPath,
        ]);

        // Read the extracted segment
        const wordAudioBuffer = await readFile(tempWordPath);

        // Upload to Supabase Storage
        const fileName = `word-audio/${mantra_id}/${i}-${word.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('mantra-audio')
          .upload(fileName, wordAudioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for word "${word}":`, uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('mantra-audio')
          .getPublicUrl(uploadData.path);

        const audioUrl = urlData.publicUrl;

        // Save to word_audio_cache (upsert by word)
        const { data: cacheData, error: cacheError } = await supabase
          .from('word_audio_cache')
          .upsert(
            {
              word: word.toLowerCase(),
              audio_url: audioUrl,
              tts_provider: 'instructor_voice',
              tts_model: 'whisper_split',
              language: 'sa',
            },
            { onConflict: 'word,tts_provider,tts_model,language' }
          )
          .select('id')
          .single();

        if (cacheError) {
          console.error(`Cache upsert failed for word "${word}":`, cacheError);
          // Still continue - the audio is uploaded
        }

        // Link to mantra
        if (cacheData) {
          await supabase.from('mantra_word_audio').upsert(
            {
              mantra_id,
              word: word.toLowerCase(),
              word_audio_id: cacheData.id,
              word_position: i,
            },
            { onConflict: 'mantra_id,word_position' }
          );
        }

        processedWords.push({
          word,
          position: i,
          audio_url: audioUrl,
          start: wordInfo.start,
          end: wordInfo.end,
        });

        console.log(`Processed word ${i + 1}/${words.length}: "${word}" (${wordInfo.start}s - ${wordInfo.end}s)`);
      } catch (ffmpegError) {
        console.error(`FFmpeg error for word "${word}":`, ffmpegError);
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      mantra_id,
      source: 'instructor_voice',
      total_words: words.length,
      processed_words: processedWords.length,
      words: processedWords,
    });
  } catch (error) {
    console.error('Word audio generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    for (const f of tempFiles) {
      try { await unlink(f); } catch {}
    }
  }
}
