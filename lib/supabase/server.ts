/**
 * Authenticated Supabase client factory for server-side use.
 *
 * This client uses the user's NextAuth session to mint a short-lived JWT
 * that allows RLS-protected access to Supabase. The JWT includes custom
 * claims (user_role, email) that can be referenced in RLS policies.
 *
 * Usage:
 *   const session = await getServerSession(authOptions);
 *   const supabase = await getAuthenticatedSupabase(session);
 *   if (supabase) {
 *     const { data } = await supabase.from('mantras').select('*');
 *   }
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Session } from 'next-auth';
import { mintSupabaseDBToken } from './jwt';

/**
 * Create an authenticated Supabase client using a NextAuth session.
 *
 * This function:
 * 1. Validates the session exists
 * 2. Mints a short-lived JWT using the session data
 * 3. Creates a Supabase client with the JWT in the Authorization header
 * 4. Disables auto-refresh and session persistence (security best practice)
 *
 * @param session - NextAuth session object
 * @returns Authenticated Supabase client, or null if no session
 */
export async function getAuthenticatedSupabase(
  session: Session | null
): Promise<SupabaseClient | null> {
  if (!session?.user?.id || !session?.user?.email) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required'
    );
  }

  // Mint a short-lived JWT token for this user
  const token = await mintSupabaseDBToken({
    userId: session.user.id,
    email: session.user.email,
    userRole: session.user.role || 'user',
    expiresInSeconds: 600, // 10 minutes
  });

  // Create Supabase client with the JWT token
  // Note: We use the anon key as the second parameter, but the actual
  // authentication happens via the Authorization header with our JWT
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      // Disable auto-refresh since we're using custom JWT tokens
      autoRefreshToken: false,
      // Disable session persistence since this is server-side only
      persistSession: false,
    },
  });

  return supabase;
}
