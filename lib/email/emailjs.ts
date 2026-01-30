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
 * @param firstName User's first name
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  const templateId = process.env.EMAILJS_WELCOME_TEMPLATE_ID;

  if (!templateId) {
    console.warn('EMAILJS_WELCOME_TEMPLATE_ID not configured, skipping welcome email');
    return { success: false, error: 'Template not configured' };
  }

  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.error('EmailJS not configured properly');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      templateId,
      {
        to_email: email,
        to_name: firstName,
        app_name: 'Tapaswe Sanskrit Pronunciation',
      },
      PUBLIC_KEY
    );

    console.log(`Welcome email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Send password reset email with reset link
 * @param email User's email address
 * @param resetUrl Full URL for password reset (including token)
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string }> {
  const templateId = process.env.EMAILJS_RESET_TEMPLATE_ID;

  if (!templateId) {
    console.warn('EMAILJS_RESET_TEMPLATE_ID not configured, skipping reset email');
    return { success: false, error: 'Template not configured' };
  }

  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.error('EmailJS not configured properly');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      templateId,
      {
        to_email: email,
        reset_url: resetUrl,
        app_name: 'Tapaswe Sanskrit Pronunciation',
      },
      PUBLIC_KEY
    );

    console.log(`Password reset email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
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
