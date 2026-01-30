/**
 * Tests for Supabase JWT utilities.
 *
 * NOTE: These tests require SUPABASE_JWT_SECRET to be set in the environment.
 * For testing purposes, use any 32+ character string.
 */

import { mintSupabaseDBToken, verifySupabaseToken } from '../jwt';

// Mock environment variable for testing
const TEST_JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-hs256';

describe('Supabase JWT Utilities', () => {
  beforeAll(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET;
  });

  afterAll(() => {
    delete process.env.SUPABASE_JWT_SECRET;
  });

  describe('mintSupabaseDBToken', () => {
    it('should create a valid JWT token with 3 parts', async () => {
      const token = await mintSupabaseDBToken({
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // header.payload.signature
    });

    it('should include custom claims in the token', async () => {
      const token = await mintSupabaseDBToken({
        userId: 'test-user-456',
        email: 'admin@example.com',
        userRole: 'admin',
      });

      const decoded = await verifySupabaseToken(token);

      expect(decoded.sub).toBe('test-user-456');
      expect(decoded.user_role).toBe('admin');
      expect(decoded.email).toBe('admin@example.com');
      expect(decoded.aud).toBe('authenticated');
      expect(decoded.role).toBe('authenticated');
    });

    it('should respect custom expiry time', async () => {
      const shortExpiry = 5; // 5 seconds
      const token = await mintSupabaseDBToken({
        userId: 'test-user-789',
        email: 'user@example.com',
        expiresInSeconds: shortExpiry,
      });

      const decoded = await verifySupabaseToken(token);
      const now = Math.floor(Date.now() / 1000);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(now + shortExpiry + 1); // +1 for timing tolerance
    });
  });

  describe('verifySupabaseToken', () => {
    it('should verify a valid token', async () => {
      const token = await mintSupabaseDBToken({
        userId: 'verify-test-user',
        email: 'verify@example.com',
      });

      const decoded = await verifySupabaseToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe('verify-test-user');
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(verifySupabaseToken(invalidToken)).rejects.toThrow();
    });

    it('should reject an expired token', async () => {
      // Create a token that expires immediately
      const token = await mintSupabaseDBToken({
        userId: 'expired-user',
        email: 'expired@example.com',
        expiresInSeconds: 0,
      });

      // Wait a moment to ensure expiry
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await expect(verifySupabaseToken(token)).rejects.toThrow();
    });
  });
});
