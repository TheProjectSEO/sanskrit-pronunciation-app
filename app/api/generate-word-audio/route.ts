import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import OpenAI from 'openai';
import { splitWords } from '@/lib/pronunciation/phonetic';
import { toPcm } from '@/lib/pronunciation/reference';
import { alignWords, pcmSamples, projectRough } from '@/lib/audio/word-split';

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

    // Step 3: one clip per word of the mantra text (not per Whisper word, which can split
    // or join words and shift every button after it). Whisper's times are the rough guide;
    // cuts move into the teacher's pauses and clips are trimmed to the voice.
    const textWords = splitWords(mantra.reference_text_roman || mantra.text_latin || '');
    const targetWords = textWords.length ? textWords : words.map((w) => w.word.trim()).filter(Boolean);
    const pcm = pcmSamples(await toPcm(audioBuffer));
    const spans = alignWords(pcm, targetWords, projectRough(targetWords, words));

    // Step 4: replace the stored boundaries
    await supabase.from('mantra_word_audio').delete().eq('mantra_id', mantra_id);
    const processedWords = targetWords.map((word, i) => ({ word, position: i, start: spans[i].start, end: spans[i].end }));
    const { error: insertError } = await supabase.from('mantra_word_audio').insert(
      processedWords.map((w) => ({ mantra_id, word: w.word.toLowerCase(), word_position: w.position, start_time: w.start, end_time: w.end })),
    );
    if (insertError) {
      console.error('Word boundary insert failed:', insertError);
      return NextResponse.json({ error: 'Could not save word boundaries.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mantra_id,
      source: 'instructor_voice',
      audio_url: audioUrl,
      total_words: targetWords.length,
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
