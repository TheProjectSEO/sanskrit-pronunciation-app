import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { getServiceSupabase } from '@/lib/supabase/service';

// Schema for forgot password request validation
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Get JWT secret for password reset tokens
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate a password reset token (JWT with 1 hour expiry)
 */
async function generateResetToken(email: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 3600; // 1 hour

  const token = await new SignJWT({ email, type: 'password-reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secret);

  return token;
}

/**
 * POST /api/auth/forgot-password
 * Generates a password reset token and sends email
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const normalizedEmail = email.toLowerCase();

    // Get service Supabase client
    const supabase = getServiceSupabase();

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    // Security: Always return success, don't reveal if email exists
    // This prevents email enumeration attacks
    if (!user) {
      return NextResponse.json(
        {
          success: true,
          message: 'If an account exists, a reset link has been sent',
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const token = await generateResetToken(normalizedEmail);
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    // Store token in database
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: normalizedEmail,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing reset token:', insertError);
      return NextResponse.json(
        { error: 'Failed to generate reset token' },
        { status: 500 }
      );
    }

    // TODO: Send password reset email (will be implemented in Task 14)
    // For now, log the reset URL to console (development only)
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password/confirm?token=${token}`;
    console.log('Password reset link:', resetUrl);
    console.log('Token expires at:', expiresAt.toISOString());

    // Return success response (don't reveal if email exists)
    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists, a reset link has been sent',
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
