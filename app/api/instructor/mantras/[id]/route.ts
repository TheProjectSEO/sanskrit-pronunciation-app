import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify authentication and instructor role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const userId = session.user.id;

    // Fetch mantra with processing job info
    const { data: mantra, error: mantraError } = await supabase
      .from('mantras')
      .select(`
        id,
        name,
        status,
        reference_text_devanagari,
        reference_text_roman,
        reference_audio_url,
        text_latin,
        text_devanagari,
        audio_url,
        created_at,
        mantra_processing_jobs (
          status,
          error_message
        )
      `)
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (mantraError) {
      console.error('Error fetching mantra:', mantraError);
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    // Transform data
    const processingJob = mantra.mantra_processing_jobs?.[0];
    const transformedMantra = {
      ...mantra,
      processing_status: processingJob?.status || 'completed',
      processing_error: processingJob?.error_message,
    };

    return NextResponse.json({ mantra: transformedMantra });
  } catch (error) {
    console.error('Error in GET /api/instructor/mantras/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
