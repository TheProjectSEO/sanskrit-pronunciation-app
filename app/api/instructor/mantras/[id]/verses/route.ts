import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { z } from 'zod';

const createVerseSchema = z.object({
  verse_number: z.number().int().min(1),
  title: z.string().max(255).optional(),
  text_devanagari: z.string().min(1),
  text_roman: z.string().min(1),
  audio_start_time: z.number().min(0).optional(),
  audio_end_time: z.number().min(0).optional(),
});

const updateVerseSchema = z.object({
  verse_id: z.string().uuid(),
  verse_number: z.number().int().min(1).optional(),
  title: z.string().max(255).nullable().optional(),
  text_devanagari: z.string().min(1).optional(),
  text_roman: z.string().min(1).optional(),
  audio_start_time: z.number().min(0).nullable().optional(),
  audio_end_time: z.number().min(0).nullable().optional(),
});

const deleteVerseSchema = z.object({
  verse_id: z.string().uuid(),
});

// GET /api/instructor/mantras/[id]/verses - List verses for a mantra
export async function GET(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    // Verify mantra ownership
    const { data: mantra } = await supabase
      .from('mantras')
      .select('id')
      .eq('id', id)
      .eq('created_by', session.user.id)
      .single();

    if (!mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { data: verses, error } = await supabase
      .from('mantra_verses')
      .select('*')
      .eq('mantra_id', id)
      .order('verse_number', { ascending: true });

    if (error) {
      console.error('Error fetching verses:', error);
      return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 500 });
    }

    return NextResponse.json({ verses: verses || [] });
  } catch (error) {
    console.error('Error in GET /api/instructor/mantras/[id]/verses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/instructor/mantras/[id]/verses - Create a new verse
export async function POST(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createVerseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Verify mantra ownership
    const { data: mantra } = await supabase
      .from('mantras')
      .select('id')
      .eq('id', id)
      .eq('created_by', session.user.id)
      .single();

    if (!mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { data: verse, error } = await supabase
      .from('mantra_verses')
      .insert({
        mantra_id: id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Verse number ${parsed.data.verse_number} already exists for this mantra` },
          { status: 409 }
        );
      }
      console.error('Error creating verse:', error);
      return NextResponse.json({ error: 'Failed to create verse' }, { status: 500 });
    }

    return NextResponse.json({ verse }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/instructor/mantras/[id]/verses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/instructor/mantras/[id]/verses - Update a verse
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateVerseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Verify mantra ownership
    const { data: mantra } = await supabase
      .from('mantras')
      .select('id')
      .eq('id', id)
      .eq('created_by', session.user.id)
      .single();

    if (!mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { verse_id, ...updates } = parsed.data;

    const { data: verse, error } = await supabase
      .from('mantra_verses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', verse_id)
      .eq('mantra_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'That verse number is already taken' },
          { status: 409 }
        );
      }
      console.error('Error updating verse:', error);
      return NextResponse.json({ error: 'Failed to update verse' }, { status: 500 });
    }

    if (!verse) {
      return NextResponse.json({ error: 'Verse not found' }, { status: 404 });
    }

    return NextResponse.json({ verse });
  } catch (error) {
    console.error('Error in PATCH /api/instructor/mantras/[id]/verses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/instructor/mantras/[id]/verses - Delete a verse
export async function DELETE(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = deleteVerseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Verify mantra ownership
    const { data: mantra } = await supabase
      .from('mantras')
      .select('id')
      .eq('id', id)
      .eq('created_by', session.user.id)
      .single();

    if (!mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('mantra_verses')
      .delete()
      .eq('id', parsed.data.verse_id)
      .eq('mantra_id', id);

    if (error) {
      console.error('Error deleting verse:', error);
      return NextResponse.json({ error: 'Failed to delete verse' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/instructor/mantras/[id]/verses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
