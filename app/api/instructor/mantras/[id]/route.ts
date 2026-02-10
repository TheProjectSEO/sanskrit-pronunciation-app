import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { z } from 'zod';

const patchMantraSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  reference_text_devanagari: z.string().min(1).optional(),
  reference_text_roman: z.string().min(1).optional(),
  deity_id: z.string().uuid().nullable().optional(),
}).refine(
  (data) => data.name || data.reference_text_devanagari || data.reference_text_roman || data.deity_id !== undefined,
  { message: 'At least one field must be provided' }
);

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
        deity_id,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchMantraSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const userId = session.user.id;

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('mantras')
      .select('id, created_by')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    // Build update object, syncing legacy columns
    const updates: Record<string, string | null> = {};
    if (parsed.data.name) {
      updates.name = parsed.data.name;
    }
    if (parsed.data.reference_text_devanagari) {
      updates.reference_text_devanagari = parsed.data.reference_text_devanagari;
      updates.text_devanagari = parsed.data.reference_text_devanagari;
    }
    if (parsed.data.reference_text_roman) {
      updates.reference_text_roman = parsed.data.reference_text_roman;
      updates.text_latin = parsed.data.reference_text_roman;
    }
    if (parsed.data.deity_id !== undefined) {
      updates.deity_id = parsed.data.deity_id;
    }

    const { data: updated, error: updateError } = await supabase
      .from('mantras')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating mantra:', updateError);
      return NextResponse.json({ error: 'Failed to update mantra' }, { status: 500 });
    }

    return NextResponse.json({ mantra: updated });
  } catch (error) {
    console.error('Error in PATCH /api/instructor/mantras/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
