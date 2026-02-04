import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and instructor role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const { mantra_id } = await request.json();
    if (!mantra_id) {
      return NextResponse.json({ error: 'Mantra ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const userId = session.user.id;

    // Verify the mantra exists and belongs to this user
    const { data: mantra, error: fetchError } = await supabase
      .from('mantras')
      .select('id, status, reference_text_devanagari, reference_text_roman, reference_audio_url')
      .eq('id', mantra_id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    // Validate mantra has required fields before publishing
    if (!mantra.reference_text_devanagari || !mantra.reference_text_roman) {
      return NextResponse.json({
        error: 'Mantra must have transcription before publishing'
      }, { status: 400 });
    }

    if (!mantra.reference_audio_url) {
      return NextResponse.json({
        error: 'Mantra must have audio before publishing'
      }, { status: 400 });
    }

    // Update status to published
    const { error: updateError } = await supabase
      .from('mantras')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mantra_id);

    if (updateError) {
      console.error('Error publishing mantra:', updateError);
      return NextResponse.json({ error: 'Failed to publish mantra' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mantra published successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/instructor/publish-mantra:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publishing failed' },
      { status: 500 }
    );
  }
}
