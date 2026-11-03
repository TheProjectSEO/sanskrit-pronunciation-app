import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { literalEar } from '@/lib/pronunciation/ears';
import { transliterate } from '@/lib/pronunciation/transliterate';
import { devanagariToRoman } from '@/lib/pronunciation/phonetic';
import { UGC_STATUSES } from '@/lib/mantra-access';

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_PER_USER = 30;
const MAX_CREATES_PER_DAY = 10;

/** Recognises the audio containers we accept by their magic bytes. */
function sniffAudio(b: Buffer): { ext: string; mime: string } | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', mime: 'audio/webm' };
  if (b.subarray(4, 8).toString('ascii') === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  if (b.subarray(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg' };
  if (b.subarray(0, 4).toString('ascii') === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  return null;
}

/** The signed-in user's own recordings. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ mantras: [] }, { status: 401 });
  const { data, error } = await getServiceSupabase()
    .from('mantras')
    .select('id, name, status, reference_text_devanagari, reference_text_roman, deity_id, created_at')
    .eq('created_by', session.user.id)
    .in('status', [...UGC_STATUSES, 'published'])
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load your recordings.' }, { status: 500 });
  return NextResponse.json({ mantras: data ?? [] });
}

/** Creates a private mantra from the user's recording. Text is optional. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const form = await request.formData();
  const audio = form.get('audio') as File | null;
  const rawName = String(form.get('name') || '').trim().slice(0, 120);
  let deva = String(form.get('devanagari') || '').trim().slice(0, 4000);
  let roman = String(form.get('roman') || '').trim().slice(0, 4000);
  const deityId = String(form.get('deity_id') || '') || null;
  if (!rawName) return NextResponse.json({ error: 'name' }, { status: 400 });
  if (!audio || audio.size === 0) return NextResponse.json({ error: 'audio' }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'tooLong' }, { status: 413 });

  const sb = getServiceSupabase();
  const { count } = await sb.from('mantras').select('id', { count: 'exact', head: true }).eq('created_by', userId).in('status', [...UGC_STATUSES]);
  if ((count ?? 0) >= MAX_PER_USER) return NextResponse.json({ error: 'You have reached the limit of recordings. Delete one to add another.' }, { status: 429 });

  const buffer = Buffer.from(await audio.arrayBuffer());
  // The type comes from the file's own bytes, never from what the browser claims.
  const kind = sniffAudio(buffer);
  if (!kind) return NextResponse.json({ error: 'Please upload an audio recording (webm, wav, mp3 or m4a).' }, { status: 415 });
  const { ext, mime } = kind;

  // Creating a recording can call paid transcription, so creations are counted per day
  // in the attempt log (deleting a recording does not give the slot back).
  // Reserve first, then count every reservation up to and including this one, so
  // parallel requests cannot all pass. Any error fails closed.
  const tooMany = NextResponse.json({ error: 'You have added enough recordings for today. Please continue tomorrow.' }, { status: 429 });
  const { data: slot, error: slotError } = await sb.from('pronunciation_logs')
    .insert({ session_id: `user:${userId}`, mantra_id: 'ugc', request_timestamp: new Date().toISOString(), success: true, metadata: { user_id: userId, kind: 'ugc_create' } })
    .select('id, created_at').single();
  if (slotError || !slot) return tooMany;
  const { count: today, error: countError } = await sb.from('pronunciation_logs').select('id', { count: 'exact', head: true })
    .eq('metadata->>user_id', userId).eq('metadata->>kind', 'ugc_create')
    .gte('created_at', new Date(Date.now() - 864e5).toISOString())
    .lte('created_at', slot.created_at);
  if (countError || (today ?? 0) > MAX_CREATES_PER_DAY) {
    await sb.from('pronunciation_logs').delete().eq('id', slot.id);
    return tooMany;
  }

  try {
    // No text given: write down exactly what was recited, then fill the other script.
    if (!deva && !roman) {
      const lit = await literalEar(buffer, `recording.${ext}`, mime);
      roman = /[ऀ-ॿ]/.test(lit.text) ? devanagariToRoman(lit.text) : lit.text;
    }
    if (!deva && roman) deva = await transliterate(roman, 'devanagari');
    if (!roman && deva) roman = await transliterate(deva, 'roman');
    if (!roman.trim()) return NextResponse.json({ error: 'We could not hear any words in that recording.' }, { status: 422 });

    const id = crypto.randomUUID();
    const path = `ugc/${userId}/${id}.${ext}`;
    const up = await sb.storage.from('audio').upload(path, buffer, { contentType: mime, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const audioUrl = sb.storage.from('audio').getPublicUrl(path).data.publicUrl;

    // mantras.name is unique across the whole library.
    let name = rawName;
    const { data: same } = await sb.from('mantras').select('name').ilike('name', `${rawName}%`);
    if (same?.some((s) => s.name === rawName)) name = `${rawName} (${same.length + 1})`;

    const { data: mantra, error } = await sb
      .from('mantras')
      .insert({
        id, name, status: 'private', created_by: userId, deity_id: deityId,
        reference_text_roman: roman, reference_text_devanagari: deva, text_latin: roman, text_devanagari: deva,
        reference_audio_url: audioUrl, audio_url: audioUrl, difficulty_level: 1,
      })
      .select('id, name, status, reference_text_devanagari, reference_text_roman')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ mantra }, { status: 201 });
  } catch (e) {
    console.error('ugc create failed', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
