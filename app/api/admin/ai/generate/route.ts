import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { getServiceSupabase } from '@/lib/supabase/service';
import { takeSlot } from '@/lib/limits';
import { generateMantras } from '@/lib/ai/generate-mantras';

export const maxDuration = 120;

/** Beta: drafts mantras with AI. Nothing is saved here; the admin reviews first. */
export async function POST(request: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { prompt, count } = await request.json().catch(() => ({}));
  const text = String(prompt ?? '').trim().slice(0, 1000);
  if (text.length < 3) return NextResponse.json({ error: 'Describe what you want to create.' }, { status: 400 });
  const n = Math.max(1, Math.min(5, Number(count) || 1));
  if (!(await takeSlot(getServiceSupabase(), g.session.user.id, 'ai_generate', 40))) {
    return NextResponse.json({ error: 'Daily AI limit reached. Try again tomorrow.' }, { status: 429 });
  }
  try {
    return NextResponse.json({ mantras: await generateMantras(text, n) });
  } catch (e) {
    console.error('ai generate failed', e);
    return NextResponse.json({ error: 'The AI could not answer. Please try again.' }, { status: 502 });
  }
}
