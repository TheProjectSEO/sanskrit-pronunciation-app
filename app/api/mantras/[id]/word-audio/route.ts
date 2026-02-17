import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mantraId } = await params;
    const supabase = getServiceSupabase();

    // Fetch word audio mappings for this mantra
    const { data: wordAudio, error } = await supabase
      .from('mantra_word_audio')
      .select(`
        word,
        word_position,
        word_audio_cache (
          audio_url
        )
      `)
      .eq('mantra_id', mantraId)
      .order('word_position', { ascending: true });

    if (error) {
      console.error('Error fetching word audio:', error);
      return NextResponse.json(
        { error: 'Failed to fetch word audio' },
        { status: 500 }
      );
    }

    // Transform to word → audio_url map
    const wordAudioMap: Record<string, string> = {};
    (wordAudio || []).forEach((item: any) => {
      if (item.word_audio_cache?.audio_url) {
        wordAudioMap[item.word] = item.word_audio_cache.audio_url;
      }
    });

    return NextResponse.json({
      mantra_id: mantraId,
      word_audio_map: wordAudioMap,
      total_words: Object.keys(wordAudioMap).length,
    });
  } catch (error) {
    console.error('Error in GET /api/mantras/[id]/word-audio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
