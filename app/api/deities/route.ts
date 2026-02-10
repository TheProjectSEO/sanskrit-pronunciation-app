import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Fetch all deities with count of published mantras
    const { data: deities, error } = await supabase
      .from('deities')
      .select('id, name, name_devanagari, description, image_url')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching deities:', error);
      return NextResponse.json({ error: 'Failed to fetch deities' }, { status: 500 });
    }

    return NextResponse.json({ deities: deities || [] });
  } catch (error) {
    console.error('Error in GET /api/deities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
