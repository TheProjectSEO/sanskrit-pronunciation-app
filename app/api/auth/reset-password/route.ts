import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { getServiceSupabase } from '@/lib/supabase/service';

// Schema for reset password request validation
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
 * Verify a password reset token
 */
async function verifyResetToken(token: string): Promise<{ email: string } | null> {
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Verify token type and extract email
    if (payload.type !== 'password-reset' || typeof payload.email !== 'string') {
      return null;
    }

    return { email: payload.email };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * POST /api/auth/reset-password
 * Validates token and updates user password
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // Verify token
    const tokenPayload = await verifyResetToken(token);
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const { email } = tokenPayload;

    // Get service Supabase client
    const supabase = getServiceSupabase();

    // Check if token exists in database and hasn't been used
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, expires_at, used_at')
      .eq('token', token)
      .eq('email', email)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (tokenRecord.used_at) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (markUsedError) {
      console.error('Error marking token as used:', markUsedError);
      // Don't fail the request if we can't mark the token as used
      // The password has already been updated successfully
    }

    // Return success
    return NextResponse.json(
      {
        success: true,
        message: 'Password has been reset successfully',
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
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
