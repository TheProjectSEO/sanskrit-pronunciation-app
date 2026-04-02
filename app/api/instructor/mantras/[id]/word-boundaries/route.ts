import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { z } from 'zod';

const wordBoundarySchema = z.object({
  boundaries: z.array(z.object({
    word: z.string().min(1),
    start: z.number().min(0),
    end: z.number().positive(),
  })).min(1),
  detection_method: z.enum(['energy', 'whisperx', 'manual']),
  verified: z.boolean(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mantraId } = await params;

    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    // Verify mantra exists and belongs to this instructor
    const { data: mantra, error: mantraError } = await supabase
      .from('mantras')
      .select('id, created_by')
      .eq('id', mantraId)
      .single();

    if (mantraError || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    if (mantra.created_by !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only modify your own mantras' }, { status: 403 });
    }

    // Validate body
    const body = await request.json();
    const parsed = wordBoundarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { boundaries, detection_method, verified } = parsed.data;

    // Delete existing word audio rows for this mantra
    const { error: deleteError } = await supabase
      .from('mantra_word_audio')
      .delete()
      .eq('mantra_id', mantraId);

    if (deleteError) {
      console.error('[word-boundaries] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to clear existing boundaries' }, { status: 500 });
    }

    // Insert new boundaries
    const rows = boundaries.map((b, i) => ({
      mantra_id: mantraId,
      word: b.word.toLowerCase(),
      word_position: i,
      start_time: b.start,
      end_time: b.end,
      verified,
      detection_method,
    }));

    const { error: insertError } = await supabase
      .from('mantra_word_audio')
      .insert(rows);

    if (insertError) {
      console.error('[word-boundaries] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save boundaries' }, { status: 500 });
    }

    console.log(`[word-boundaries] Saved ${boundaries.length} boundaries for mantra ${mantraId} (method=${detection_method}, verified=${verified})`);

    return NextResponse.json({
      success: true,
      mantra_id: mantraId,
      total_words: boundaries.length,
      detection_method,
      verified,
      boundaries: boundaries.map((b, i) => ({
        word: b.word.toLowerCase(),
        position: i,
        start: b.start,
        end: b.end,
      })),
    });
  } catch (error) {
    console.error('[word-boundaries] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
