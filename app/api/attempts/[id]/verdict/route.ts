import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

const MAX_BYTES = 25 * 16000 * 2 + 1024;

/**
 * The learner says whether the verdict was right. Their recording is kept with the
 * answer so the teacher can label it and it can join the evaluation set.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const { id } = await params;
  const form = await request.formData();
  const verdict = String(form.get('verdict') || '');
  if (verdict !== 'right' && verdict !== 'wrong') return NextResponse.json({ error: 'Bad verdict.' }, { status: 400 });
  const note = String(form.get('note') || '').slice(0, 500);
  const audio = form.get('audio') as File | null;

  const supabase = getServiceSupabase();
  const { data: row } = await supabase.from('pronunciation_logs').select('id, metadata').eq('id', id).single();
  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  if (!row || meta.user_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  let audioPath: string | null = (meta.label_audio as string) ?? null;
  if (audio && audio.size > 0 && audio.size <= MAX_BYTES && !audioPath) {
    audioPath = `labels/${id}.wav`;
    const { error } = await supabase.storage.from('audio').upload(audioPath, Buffer.from(await audio.arrayBuffer()), { contentType: 'audio/wav', upsert: true });
    if (error) {
      console.error('label audio upload failed', error.message);
      audioPath = null;
    }
  }

  const { error } = await supabase
    .from('pronunciation_logs')
    .update({ metadata: { ...meta, user_verdict: verdict, user_note: note || null, label_audio: audioPath, labelled_at: new Date().toISOString() } })
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
