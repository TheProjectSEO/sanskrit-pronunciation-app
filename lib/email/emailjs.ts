import emailjs from '@emailjs/nodejs';

/**
 * EmailJS configuration
 * Environment variables required:
 * - EMAILJS_SERVICE_ID
 * - EMAILJS_PUBLIC_KEY
 * - EMAILJS_WELCOME_TEMPLATE_ID
 * - EMAILJS_RESET_TEMPLATE_ID
 */

/**
 * Validate EmailJS configuration
 * @param templateId Template ID to validate
 * @returns Object with validation result and config values
 */
function validateEmailConfig(templateId: string | undefined): {
  isValid: boolean;
  error?: string;
  serviceId?: string;
  publicKey?: string;
  templateId?: string;
} {
  if (!templateId) {
    return { isValid: false, error: 'Template not configured' };
  }

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !publicKey) {
    return { isValid: false, error: 'Email service not configured' };
  }

  return { isValid: true, serviceId, publicKey, templateId };
}

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
  const validation = validateEmailConfig(process.env.EMAILJS_WELCOME_TEMPLATE_ID);

  if (!validation.isValid) {
    console.warn('EMAILJS_WELCOME_TEMPLATE_ID not configured, skipping welcome email');
    return { success: false, error: validation.error };
  }

  const { serviceId, publicKey, templateId } = validation;

  try {
    await emailjs.send(
      serviceId!,
      templateId!,
      {
        to_email: email,
        to_name: firstName,
        app_name: 'Tapaswe Sanskrit Pronunciation',
      },
      {
        publicKey: publicKey!,
      }
    );

    console.log('Welcome email sent successfully');
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
  const validation = validateEmailConfig(process.env.EMAILJS_RESET_TEMPLATE_ID);

  if (!validation.isValid) {
    console.warn('EMAILJS_RESET_TEMPLATE_ID not configured, skipping reset email');
    return { success: false, error: validation.error };
  }

  const { serviceId, publicKey, templateId } = validation;

  try {
    await emailjs.send(
      serviceId!,
      templateId!,
      {
        to_email: email,
        reset_url: resetUrl,
        app_name: 'Tapaswe Sanskrit Pronunciation',
      },
      {
        publicKey: publicKey!,
      }
    );

    console.log('Password reset email sent successfully');
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
