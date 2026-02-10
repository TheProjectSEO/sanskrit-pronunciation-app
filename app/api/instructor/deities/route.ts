import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { z } from 'zod';

const createDeitySchema = z.object({
  name: z.string().min(1).max(255),
  name_devanagari: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    const { data: deities, error } = await supabase
      .from('deities')
      .select('id, name, name_devanagari, description, image_url, created_at')
      .eq('created_by', session.user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching deities:', error);
      return NextResponse.json({ error: 'Failed to fetch deities' }, { status: 500 });
    }

    return NextResponse.json({ deities: deities || [] });
  } catch (error) {
    console.error('Error in GET /api/instructor/deities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createDeitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: deity, error } = await supabase
      .from('deities')
      .insert({
        name: parsed.data.name,
        name_devanagari: parsed.data.name_devanagari || null,
        description: parsed.data.description || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating deity:', error);
      return NextResponse.json({ error: 'Failed to create deity' }, { status: 500 });
    }

    return NextResponse.json({ deity }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/instructor/deities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
