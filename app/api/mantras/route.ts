import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Fetch published mantras for users
    const { data: mantras, error } = await supabase
      .from('mantras')
      .select(`
        id,
        name,
        reference_text_devanagari,
        reference_text_roman,
        reference_audio_url,
        difficulty_level,
        category
      `)
      .eq('status', 'published')
      .order('difficulty_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching mantras:', error);
      return NextResponse.json({ error: 'Failed to fetch mantras' }, { status: 500 });
    }

    return NextResponse.json({ mantras: mantras || [] });
  } catch (error) {
    console.error('Error in GET /api/mantras:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
