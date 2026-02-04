import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET() {
  try {
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

    // Fetch mantras with their processing jobs
    const { data: mantras, error: mantrasError } = await supabase
      .from('mantras')
      .select(`
        id,
        name,
        status,
        text_latin,
        text_devanagari,
        audio_url,
        created_at,
        mantra_processing_jobs (
          status,
          error_message
        )
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (mantrasError) {
      console.error('Error fetching mantras:', mantrasError);
      return NextResponse.json({ error: 'Failed to fetch mantras' }, { status: 500 });
    }

    // Transform data to include processing status
    const transformedMantras = (mantras || []).map((mantra) => {
      const processingJob = mantra.mantra_processing_jobs?.[0];
      // Use name field, fallback to text_latin
      const title = mantra.name || mantra.text_latin?.substring(0, 50) || 'Untitled Mantra';
      return {
        id: mantra.id,
        title: title,
        status: mantra.status,
        text_latin: mantra.text_latin,
        text_devanagari: mantra.text_devanagari,
        audio_url: mantra.audio_url,
        created_at: mantra.created_at,
        processing_status: processingJob?.status || 'completed',
        processing_error: processingJob?.error_message,
      };
    });

    // Calculate stats
    const stats = {
      total: transformedMantras.length,
      published: transformedMantras.filter((m) => m.status === 'published').length,
      drafts: transformedMantras.filter((m) => m.status === 'draft').length,
      processing: transformedMantras.filter(
        (m) => m.processing_status === 'pending' || m.processing_status === 'processing'
      ).length,
    };

    return NextResponse.json({
      mantras: transformedMantras,
      stats,
    });
  } catch (error) {
    console.error('Error in GET /api/instructor/mantras:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
