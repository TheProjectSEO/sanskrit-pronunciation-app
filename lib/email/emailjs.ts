import emailjs from '@emailjs/browser';

/**
 * EmailJS configuration
 * Environment variables required:
 * - EMAILJS_SERVICE_ID
 * - EMAILJS_PUBLIC_KEY
 * - EMAILJS_WELCOME_TEMPLATE_ID
 * - EMAILJS_RESET_TEMPLATE_ID
 */

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID!;
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY!;

/**
 * Send welcome email to new users
 * @param email User's email address
 * @param name User's full name
 * @returns Promise<void>
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  const templateId = process.env.EMAILJS_WELCOME_TEMPLATE_ID;

  if (!templateId) {
    console.warn('EMAILJS_WELCOME_TEMPLATE_ID not configured, skipping welcome email');
    return;
  }

  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.error('EmailJS not configured properly');
    throw new Error('Email service not configured');
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      templateId,
      {
        to_email: email,
        user_name: name,
        app_name: 'Tapaswe Sanskrit Pronunciation',
        app_url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      PUBLIC_KEY
    );

    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - welcome email failure shouldn't block signup
  }
}

/**
 * Send password reset email with reset link
 * @param email User's email address
 * @param resetToken JWT token for password reset
 * @returns Promise<void>
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<void> {
  const templateId = process.env.EMAILJS_RESET_TEMPLATE_ID;

  if (!templateId) {
    console.warn('EMAILJS_RESET_TEMPLATE_ID not configured, skipping reset email');
    return;
  }

  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.error('EmailJS not configured properly');
    throw new Error('Email service not configured');
  }

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/confirm?token=${resetToken}`;

  try {
    await emailjs.send(
      SERVICE_ID,
      templateId,
      {
        to_email: email,
        reset_url: resetUrl,
        app_name: 'Tapaswe Sanskrit Pronunciation',
        expires_in: '1 hour',
      },
      PUBLIC_KEY
    );

    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error; // Reset email failure should be reported
  }
}

/**
 * Validate EmailJS configuration
 * @returns boolean indicating if EmailJS is properly configured
 */
export function isEmailJsConfigured(): boolean {
  return !!(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_PUBLIC_KEY &&
    (process.env.EMAILJS_WELCOME_TEMPLATE_ID || process.env.EMAILJS_RESET_TEMPLATE_ID)
  );
}
