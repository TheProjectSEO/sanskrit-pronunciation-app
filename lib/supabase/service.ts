/**
 * Service role Supabase client factory (BYPASSES RLS - USE WITH EXTREME CAUTION).
 *
 * ⚠️  CRITICAL SECURITY WARNING ⚠️
 *
 * This client uses the SUPABASE_SERVICE_ROLE_KEY which bypasses ALL Row Level
 * Security (RLS) policies. It has unrestricted access to your entire database.
 *
 * ONLY use this client when you absolutely need to:
 * - Perform administrative operations that require bypassing RLS
 * - Access data across all users (e.g., admin dashboards)
 * - Create/modify data that users shouldn't be able to modify directly
 *
 * NEVER use this client for:
 * - Regular user operations (use getAuthenticatedSupabase instead)
 * - Client-side operations (this will throw an error)
 * - Operations where RLS policies should apply
 *
 * ALWAYS:
 * - Verify user permissions manually before using this client
 * - Validate all inputs thoroughly
 * - Log all operations for audit purposes
 * - Consider if getAuthenticatedSupabase() would be safer for your use case
 *
 * Example safe usage:
 *   // In an admin API route, after verifying the user is an admin
 *   if (session.user.role !== 'admin') {
 *     return res.status(403).json({ error: 'Forbidden' });
 *   }
 *   const supabase = getServiceSupabase();
 *   await supabase.from('users').update({ status: 'banned' }).eq('id', userId);
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Singleton instance of the service role Supabase client.
 * Only created once to reuse the same connection.
 */
let serviceSupabaseInstance: SupabaseClient | null = null;

/**
 * Get a Supabase client with service role privileges (BYPASSES RLS).
 *
 * ⚠️  WARNING: This client has unrestricted database access!
 *
 * This function:
 * 1. Throws an error if called client-side (typeof window !== 'undefined')
 * 2. Validates SUPABASE_SERVICE_ROLE_KEY is set
 * 3. Returns a singleton instance (created once, reused thereafter)
 *
 * @returns Supabase client with service role privileges
 * @throws Error if called client-side or if env vars are missing
 */
export function getServiceSupabase(): SupabaseClient {
  // CRITICAL: Prevent client-side usage
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServiceSupabase() cannot be called client-side. ' +
        'The service role key would be exposed to users, compromising your database security. ' +
        'Use getAuthenticatedSupabase() for client-side operations.'
    );
  }

  // Return existing instance if already created
  if (serviceSupabaseInstance) {
    return serviceSupabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables: ' +
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
        'SUPABASE_SERVICE_ROLE_KEY should only be set in .env.local (never commit it).'
    );
  }

  // Create singleton instance
  serviceSupabaseInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh since this is server-side only
      autoRefreshToken: false,
      // Disable session persistence since this is server-side only
      persistSession: false,
    },
  });

  return serviceSupabaseInstance;
}

/**
 * Reset the singleton instance (useful for testing).
 * @internal
 */
export function resetServiceSupabaseInstance(): void {
  serviceSupabaseInstance = null;
}
