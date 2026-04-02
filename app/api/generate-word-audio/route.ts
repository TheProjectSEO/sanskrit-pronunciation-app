import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import OpenAI from 'openai';

let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export async function POST(request: NextRequest) {
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

    // Step 2: Send to Whisper with word-level timestamps
    console.log('Getting word timestamps from Whisper...');
    const file = new File([new Uint8Array(audioBuffer)], 'audio.webm', { type: 'audio/webm' });

    const transcription = await getOpenAI().audio.transcriptions.create({
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

    // Step 3: Delete existing word audio for this mantra
    await supabase
      .from('mantra_word_audio')
      .delete()
      .eq('mantra_id', mantra_id);

    // Step 4: Store timestamps in DB (no FFmpeg, no file splitting needed)
    // Use midpoint clamping: each word's boundaries are clamped to the
    // midpoint of the gap between adjacent words. This prevents any overlap
    // that causes audio bleed (hearing "Om n..." instead of just "Om").
    const processedWords: Array<{ word: string; position: number; start: number; end: number }> = [];

    // Filter out empty words first so indexing is correct
    const validWords = words.filter(w => w.word.trim());

    for (let i = 0; i < validWords.length; i++) {
      const wordInfo = validWords[i];
      const word = wordInfo.word.trim();

      let start = wordInfo.start;
      let end = wordInfo.end;

      // Clamp end to midpoint of gap before next word (prevents bleed forward)
      if (i < validWords.length - 1) {
        const nextStart = validWords[i + 1].start;
        if (end > nextStart) {
          // Words overlap in Whisper output — split at midpoint
          end = (end + nextStart) / 2;
        } else {
          // Gap exists — extend end to midpoint of the gap (natural tail)
          const gap = nextStart - end;
          end = end + Math.min(gap / 2, 0.03); // max 30ms into gap
        }
      }

      // Clamp start to midpoint of gap after previous word (prevents bleed backward)
      if (i > 0) {
        const prevEnd = validWords[i - 1].end;
        if (start < prevEnd) {
          // Words overlap — split at midpoint
          start = (prevEnd + start) / 2;
        } else {
          const gap = start - prevEnd;
          start = start - Math.min(gap / 2, 0.03); // max 30ms into gap
        }
      }

      start = Math.max(0, start);

      const { error: insertError } = await supabase
        .from('mantra_word_audio')
        .insert({
          mantra_id,
          word: word.toLowerCase(),
          word_position: i,
          start_time: start,
          end_time: end,
        });

      if (insertError) {
        console.error(`Insert failed for word "${word}":`, insertError);
        continue;
      }

      processedWords.push({
        word,
        position: i,
        start,
        end,
      });

      console.log(`Stored word ${i + 1}/${words.length}: "${word}" (${start.toFixed(3)}s - ${end.toFixed(3)}s)`);
    }

    return NextResponse.json({
      success: true,
      mantra_id,
      source: 'instructor_voice',
      audio_url: audioUrl,
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
  }
}
