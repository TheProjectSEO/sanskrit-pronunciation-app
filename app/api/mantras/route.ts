import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const deityId = searchParams.get('deity_id');

    // Fetch published mantras for users
    let query = supabase
      .from('mantras')
      .select(`
        id,
        name,
        reference_text_devanagari,
        reference_text_roman,
        reference_audio_url,
        difficulty_level,
        category,
        deity_id,
        mantra_verses(id)
      `)
      .eq('status', 'published');

    if (deityId) {
      query = query.eq('deity_id', deityId);
    }

    const { data: mantras, error } = await query
      .order('difficulty_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching mantras:', error);
      return NextResponse.json({ error: 'Failed to fetch mantras' }, { status: 500 });
    }

    // Add verse_count to each mantra
    const mantrasWithCount = (mantras || []).map((m: Record<string, unknown>) => {
      const verses = m.mantra_verses as unknown[] | null;
      return {
        ...m,
        verse_count: verses?.length || 0,
        mantra_verses: undefined,
      };
    });

    return NextResponse.json({ mantras: mantrasWithCount });
  } catch (error) {
    console.error('Error in GET /api/mantras:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
