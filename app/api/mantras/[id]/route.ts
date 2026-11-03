import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { auth } from '@/auth';
import { canPractise } from '@/lib/mantra-access';
import { isAdmin } from '@/lib/roles';

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
        category,
        status,
        created_by
      `)
      .eq('id', id)
      .single();

    const session = await auth();
    if (error || !mantra || !canPractise(mantra, session?.user)) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { created_by, ...rest } = mantra;
    // Owners and admins see the status (for share / submit controls); others do not need it.
    const owner = !!session?.user?.id && created_by === session.user.id;
    return NextResponse.json({ mantra: { ...rest, is_owner: owner, status: owner || isAdmin(session?.user?.role) ? rest.status : undefined } });
  } catch (error) {
    console.error('Error fetching mantra:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
