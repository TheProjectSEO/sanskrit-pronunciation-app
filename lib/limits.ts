import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Takes one of today's slots for this user and kind, atomically in the database
 * (public.tapaswe_take_slot). Returns false when the limit is reached or the check
 * fails, so callers fail closed.
 */
export async function takeSlot(sb: SupabaseClient, userId: string, kind: 'attempt' | 'ugc_create', max: number): Promise<boolean> {
  const { data, error } = await sb.rpc('tapaswe_take_slot', { p_user: userId, p_kind: kind, p_max: max });
  if (error) {
    console.error('daily limit check failed', error.message);
    return false;
  }
  return data === true;
}
