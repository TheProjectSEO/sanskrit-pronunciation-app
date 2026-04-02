import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mantraId } = await params;
    const supabase = getServiceSupabase();

    // Fetch mantra to get reference audio URL
    const { data: mantra } = await supabase
      .from('mantras')
      .select('reference_audio_url, audio_url')
      .eq('id', mantraId)
      .single();

    const referenceAudioUrl = mantra?.reference_audio_url || mantra?.audio_url || '';

    // Fetch word timestamps for this mantra
    const { data: wordAudio, error } = await supabase
      .from('mantra_word_audio')
      .select('word, word_position, start_time, end_time, verified')
      .eq('mantra_id', mantraId)
      .order('word_position', { ascending: true });

    if (error) {
      console.error('[word-audio] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch word audio' },
        { status: 500 }
      );
    }

    // Build legacy word_timestamps dict (kept for backward compat)
    const wordTimestamps: Record<string, { start: number; end: number }> = {};
    // Build position-indexed array (handles duplicate words correctly)
    const wordBoundaries: Array<{
      word: string;
      position: number;
      start: number;
      end: number;
      verified: boolean;
    }> = [];

    (wordAudio || []).forEach((item) => {
      if (item.start_time != null && item.end_time != null) {
        wordTimestamps[item.word] = {
          start: item.start_time,
          end: item.end_time,
        };
        wordBoundaries.push({
          word: item.word,
          position: item.word_position,
          start: item.start_time,
          end: item.end_time,
          verified: item.verified ?? false,
        });
      }
    });

    console.log(`[word-audio] mantra=${mantraId} words=${wordBoundaries.length} refUrl=${referenceAudioUrl ? 'YES' : 'NONE'}`);

    return NextResponse.json({
      mantra_id: mantraId,
      reference_audio_url: referenceAudioUrl,
      word_timestamps: wordTimestamps,
      word_boundaries: wordBoundaries,
      word_audio_map: {},
      total_words: wordBoundaries.length,
    });
  } catch (error) {
    console.error('[word-audio] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
