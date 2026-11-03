import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

async function own(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  const sb = getServiceSupabase();
  const { data } = await sb.from('mantras').select('id, status, created_by, reference_audio_url').eq('id', id).single();
  if (!data || data.created_by !== userId || !['private', 'submitted', 'rejected'].includes(data.status)) {
    return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) };
  }
  return { sb, mantra: data };
}

/** Owner actions: submit to the library, or withdraw back to private. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await own(id);
  if (r.error) return r.error;
  const { action } = await request.json().catch(() => ({}));
  const status = action === 'submit' ? 'submitted' : action === 'withdraw' ? 'private' : null;
  if (!status) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const { error } = await r.sb.from('mantras').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await own(id);
  if (r.error) return r.error;
  const path = r.mantra.reference_audio_url?.match(/\/storage\/v1\/object\/public\/audio\/(.+)$/)?.[1];
  const { error } = await r.sb.from('mantras').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  if (path) await r.sb.storage.from('audio').remove([decodeURIComponent(path)]);
  return NextResponse.json({ ok: true });
}
