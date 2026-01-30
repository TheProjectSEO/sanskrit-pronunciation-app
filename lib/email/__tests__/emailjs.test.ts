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

      await sendWelcomeEmail('user@example.com', 'John Doe');

      expect(mockSend).toHaveBeenCalledWith(
        'test_service_id',
        'test_welcome_template',
        {
          to_email: 'user@example.com',
          user_name: 'John Doe',
          app_name: 'Tapaswe Sanskrit Pronunciation',
          app_url: 'http://localhost:3000',
        },
        'test_public_key'
      );
    });

    it('should not throw error if template ID is missing', async () => {
      delete process.env.EMAILJS_WELCOME_TEMPLATE_ID;

      await expect(
        sendWelcomeEmail('user@example.com', 'John Doe')
      ).resolves.not.toThrow();

      expect(emailjs.send).not.toHaveBeenCalled();
    });

    it('should not throw error if email sending fails', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockRejectedValueOnce(new Error('Email send failed'));

      // Should not throw - welcome email failures are non-critical
      await expect(
        sendWelcomeEmail('user@example.com', 'John Doe')
      ).resolves.not.toThrow();
    });

    it('should throw error if service ID is missing', async () => {
      delete process.env.EMAILJS_SERVICE_ID;

      await expect(
        sendWelcomeEmail('user@example.com', 'John Doe')
      ).rejects.toThrow('Email service not configured');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email with correct parameters', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockResolvedValueOnce({} as any);

      const resetToken = 'test_reset_token_123';
      await sendPasswordResetEmail('user@example.com', resetToken);

      expect(mockSend).toHaveBeenCalledWith(
        'test_service_id',
        'test_reset_template',
        {
          to_email: 'user@example.com',
          reset_url: `http://localhost:3000/reset-password/confirm?token=${resetToken}`,
          app_name: 'Tapaswe Sanskrit Pronunciation',
          expires_in: '1 hour',
        },
        'test_public_key'
      );
    });

    it('should throw error if email sending fails', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockRejectedValueOnce(new Error('Email send failed'));

      // Reset email failures should be reported
      await expect(
        sendPasswordResetEmail('user@example.com', 'test_token')
      ).rejects.toThrow('Email send failed');
    });

    it('should not send email if template ID is missing', async () => {
      delete process.env.EMAILJS_RESET_TEMPLATE_ID;

      await sendPasswordResetEmail('user@example.com', 'test_token');

      expect(emailjs.send).not.toHaveBeenCalled();
    });

    it('should generate correct reset URL', async () => {
      const mockSend = vi.mocked(emailjs.send);
      mockSend.mockResolvedValueOnce({} as any);

      process.env.NEXT_PUBLIC_APP_URL = 'https://tapaswe.app';
      const resetToken = 'abc123xyz';

      await sendPasswordResetEmail('user@example.com', resetToken);

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          reset_url: `https://tapaswe.app/reset-password/confirm?token=${resetToken}`,
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
