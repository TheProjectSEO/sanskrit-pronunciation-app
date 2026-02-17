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
      .select('word, word_position, start_time, end_time, word_audio_cache(audio_url)')
      .eq('mantra_id', mantraId)
      .order('word_position', { ascending: true });

    if (error) {
      console.error('Error fetching word audio:', error);
      return NextResponse.json(
        { error: 'Failed to fetch word audio' },
        { status: 500 }
      );
    }

    // Build word data: timestamps for time-range playback, or legacy audio_url
    const wordTimestamps: Record<string, { start: number; end: number }> = {};
    const wordAudioMap: Record<string, string> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wordAudio || []).forEach((item: any) => {
      // New approach: timestamps for time-range playback
      if (item.start_time != null && item.end_time != null) {
        wordTimestamps[item.word] = {
          start: item.start_time,
          end: item.end_time,
        };
      }
      // Legacy approach: separate audio file URLs
      if (item.word_audio_cache?.audio_url) {
        wordAudioMap[item.word] = item.word_audio_cache.audio_url;
      }
    });

    return NextResponse.json({
      mantra_id: mantraId,
      reference_audio_url: referenceAudioUrl,
      word_timestamps: wordTimestamps,
      word_audio_map: wordAudioMap, // backward compat
      total_words: Object.keys(wordTimestamps).length || Object.keys(wordAudioMap).length,
    });
  } catch (error) {
    console.error('Error in GET /api/mantras/[id]/word-audio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
