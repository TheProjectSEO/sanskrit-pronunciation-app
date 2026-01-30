import { describe, it, expect, beforeEach, vi } from 'vitest';
import emailjs from '@emailjs/browser';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  isEmailJsConfigured,
} from '../emailjs';

// Mock emailjs
vi.mock('@emailjs/browser', () => ({
  default: {
    send: vi.fn(),
  },
}));

describe('EmailJS Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = {
      ...originalEnv,
      EMAILJS_SERVICE_ID: 'test_service_id',
      EMAILJS_PUBLIC_KEY: 'test_public_key',
      EMAILJS_WELCOME_TEMPLATE_ID: 'test_welcome_template',
      EMAILJS_RESET_TEMPLATE_ID: 'test_reset_template',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct parameters', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockResolvedValueOnce({} as any);

      const result = await sendWelcomeEmail('user@example.com', 'John');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(
        'test_service_id',
        'test_welcome_template',
        {
          to_email: 'user@example.com',
          to_name: 'John',
          app_name: 'Tapaswe Sanskrit Pronunciation',
        },
        'test_public_key'
      );
    });

    it('should return failure if template ID is missing', async () => {
      delete process.env.EMAILJS_WELCOME_TEMPLATE_ID;

      const result = await sendWelcomeEmail('user@example.com', 'John');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not configured');
      expect(emailjs.send).not.toHaveBeenCalled();
    });

    it('should return failure if email sending fails', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockRejectedValueOnce(new Error('Email send failed'));

      const result = await sendWelcomeEmail('user@example.com', 'John');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email send failed');
    });

    it('should return failure if service ID is missing', async () => {
      delete process.env.EMAILJS_SERVICE_ID;

      const result = await sendWelcomeEmail('user@example.com', 'John');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service not configured');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email with correct parameters', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockResolvedValueOnce({} as any);

      const resetUrl = 'http://localhost:3000/reset-password/confirm?token=test_reset_token_123';
      const result = await sendPasswordResetEmail('user@example.com', resetUrl);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(
        'test_service_id',
        'test_reset_template',
        {
          to_email: 'user@example.com',
          reset_url: resetUrl,
          app_name: 'Tapaswe Sanskrit Pronunciation',
        },
        'test_public_key'
      );
    });

    it('should return failure if email sending fails', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockRejectedValueOnce(new Error('Email send failed'));

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:3000/reset-password/confirm?token=test_token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email send failed');
    });

    it('should return failure if template ID is missing', async () => {
      delete process.env.EMAILJS_RESET_TEMPLATE_ID;

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:3000/reset-password/confirm?token=test_token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not configured');
      expect(emailjs.send).not.toHaveBeenCalled();
    });

    it('should accept full reset URL from caller', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockResolvedValueOnce({} as any);

      const resetUrl = 'https://tapaswe.app/reset-password/confirm?token=abc123xyz';
      const result = await sendPasswordResetEmail('user@example.com', resetUrl);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          reset_url: resetUrl,
        }),
        expect.any(String)
      );
    });
  });

  describe('isEmailJsConfigured', () => {
    it('should return true when all required env vars are set', () => {
      expect(isEmailJsConfigured()).toBe(true);
    });

    it('should return true when only reset template is set', () => {
      delete process.env.EMAILJS_WELCOME_TEMPLATE_ID;
      expect(isEmailJsConfigured()).toBe(true);
    });

    it('should return true when only welcome template is set', () => {
      delete process.env.EMAILJS_RESET_TEMPLATE_ID;
      expect(isEmailJsConfigured()).toBe(true);
    });

    it('should return false when service ID is missing', () => {
      delete process.env.EMAILJS_SERVICE_ID;
      expect(isEmailJsConfigured()).toBe(false);
    });

    it('should return false when public key is missing', () => {
      delete process.env.EMAILJS_PUBLIC_KEY;
      expect(isEmailJsConfigured()).toBe(false);
    });

    it('should return false when all template IDs are missing', () => {
      delete process.env.EMAILJS_WELCOME_TEMPLATE_ID;
      delete process.env.EMAILJS_RESET_TEMPLATE_ID;
      expect(isEmailJsConfigured()).toBe(false);
    });
  });
});
