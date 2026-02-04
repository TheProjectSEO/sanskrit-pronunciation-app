/**
 * Supabase JWT minting and verification utilities.
 *
 * These functions create short-lived JWTs that can be used with Supabase's
 * Row Level Security (RLS) policies. The tokens include custom claims like
 * user_role and email that RLS policies can reference via auth.jwt().
 */

import { SignJWT, jwtVerify } from 'jose';

export interface MintJwtOptions {
  userId: string;
  email: string;
  userRole?: 'admin' | 'user' | 'instructor';
  expiresInSeconds?: number; // Default 600 (10 minutes)
}

/**
 * Get the JWT secret as a Uint8Array for use with jose library.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Mint a short-lived JWT token for Supabase database access.
 *
 * This token includes custom claims that can be used in RLS policies:
 * - sub: user ID
 * - user_role: 'admin' or 'user'
 * - email: user's email
 * - aud: 'authenticated'
 * - role: 'authenticated'
 *
 * @param options - Token minting options
 * @returns JWT token string
 */
export async function mintSupabaseDBToken(
  options: MintJwtOptions
): Promise<string> {
  const {
    userId,
    email,
    userRole = 'user',
    expiresInSeconds = 600, // 10 minutes default
  } = options;

  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    user_role: userRole,
    email,
    aud: 'authenticated',
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secret);

  return token;
}

/**
 * Verify a Supabase JWT token.
 *
 * @param token - JWT token to verify
 * @returns Decoded token payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifySupabaseToken(token: string) {
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    throw new Error(
      `Invalid or expired token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
