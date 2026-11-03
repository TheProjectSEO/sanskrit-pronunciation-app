import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';
import { takeSlot } from '@/lib/limits';
import { synthesize } from '@/lib/audio/elevenlabs';
import type { AiMantra } from '@/lib/ai/generate-mantras';

export const maxDuration = 120;

/** Beta AI drafts: status `ai_draft`, visible to admins only, never publishable as is. */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { data } = await getServiceSupabase()
    .from('mantras')
    .select('id, name, reference_text_devanagari, reference_text_roman, reference_audio_url, category, common_errors, created_at')
    .eq('status', 'ai_draft')
    .order('created_at', { ascending: false });
  return NextResponse.json({ drafts: data ?? [] });
}

/** Saves one reviewed AI mantra as an AI draft, optionally with an AI voice. */
export async function POST(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const body = await request.json().catch(() => ({}));
  const m = body.mantra as AiMantra | undefined;
  if (!m?.name || !m.devanagari || !m.iast) return NextResponse.json({ error: 'Name, Devanagari and IAST are required.' }, { status: 400 });
  const sb = getServiceSupabase();

  let audioUrl = '';
  const id = crypto.randomUUID();
  if (body.voice) {
    if (!(await takeSlot(sb, g.session.user.id, 'ai_voice', 60))) return NextResponse.json({ error: 'Daily AI voice limit reached.' }, { status: 429 });
    try {
      const mp3 = await synthesize(m.devanagari.slice(0, 2500));
      const path = `ai/${id}.mp3`;
      const up = await sb.storage.from('audio').upload(path, mp3, { contentType: 'audio/mpeg', upsert: false });
      if (up.error) throw new Error(up.error.message);
      audioUrl = sb.storage.from('audio').getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.error('ai voice failed', e);
      return NextResponse.json({ error: 'Could not create the AI voice. Save without voice, or try again.' }, { status: 502 });
    }
  }

  let deityId: string | null = null;
  if (m.deity) {
    const { data: d } = await sb.from('deities').select('id').ilike('name', m.deity.trim()).limit(1).maybeSingle();
    deityId = d?.id ?? null;
  }
  let name = `${m.name.trim()} (AI)`;
  const { data: same } = await sb.from('mantras').select('name').ilike('name', `${name}%`);
  if (same?.some((s) => s.name === name)) name = `${m.name.trim()} (AI ${same.length + 1})`;

  const { error } = await sb.from('mantras').insert({
    id, name, status: 'ai_draft', created_by: g.session.user.id, deity_id: deityId, category: m.category,
    reference_text_devanagari: m.devanagari, reference_text_roman: m.iast, text_devanagari: m.devanagari, text_latin: m.iast,
    reference_audio_url: audioUrl, audio_url: audioUrl, difficulty_level: 1,
    critical_sounds: m.pronunciation_tips ?? [],
    common_errors: { ai: { meaning: m.meaning, source_note: m.source_note, confidence: m.confidence, prompt: String(body.prompt ?? '').slice(0, 1000), generated_at: new Date().toISOString(), voice: body.voice ? 'elevenlabs' : null } },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (m.verses?.length > 1) {
    await sb.from('mantra_verses').insert(m.verses.map((v, i) => ({ mantra_id: id, verse_number: i + 1, text_devanagari: v.devanagari, text_roman: v.iast })));
  }
  return NextResponse.json({ id, name }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const id = request.nextUrl.searchParams.get('id');
  const sb = getServiceSupabase();
  const { data: m } = await sb.from('mantras').select('id, status, reference_audio_url').eq('id', id ?? '').single();
  if (!m || m.status !== 'ai_draft') return NextResponse.json({ error: 'Not an AI draft.' }, { status: 404 });
  await sb.from('mantra_verses').delete().eq('mantra_id', m.id);
  const { error } = await sb.from('mantras').delete().eq('id', m.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const path = m.reference_audio_url?.match(/\/storage\/v1\/object\/public\/audio\/(.+)$/)?.[1];
  if (path) await sb.storage.from('audio').remove([decodeURIComponent(path)]);
  return NextResponse.json({ ok: true });
}
