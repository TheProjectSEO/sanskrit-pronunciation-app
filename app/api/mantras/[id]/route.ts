import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceSupabase();

    // Fetch published mantra
    const { data: mantra, error } = await supabase
      .from('mantras')
      .select(`
        id,
        name,
        reference_text_devanagari,
        reference_text_roman,
        reference_audio_url,
        critical_sounds,
        difficulty_level,
        category
      `)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    return NextResponse.json({ mantra });
  } catch (error) {
    console.error('Error fetching mantra:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
