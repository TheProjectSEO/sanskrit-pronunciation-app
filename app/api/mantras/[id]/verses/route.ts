import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

// GET /api/mantras/[id]/verses - Public: list verses for a published mantra
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceSupabase();

    // Verify mantra is published
    const { data: mantra } = await supabase
      .from('mantras')
      .select('id')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (!mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { data: verses, error } = await supabase
      .from('mantra_verses')
      .select('id, verse_number, title, text_devanagari, text_roman, audio_start_time, audio_end_time')
      .eq('mantra_id', id)
      .order('verse_number', { ascending: true });

    if (error) {
      console.error('Error fetching verses:', error);
      return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 500 });
    }

    return NextResponse.json({ verses: verses || [] });
  } catch (error) {
    console.error('Error in GET /api/mantras/[id]/verses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
