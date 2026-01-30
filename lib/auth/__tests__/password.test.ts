import { describe, it, expect } from '@jest/globals';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should create valid bcrypt hashes', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      // Bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[ab]\$/);
      // Bcrypt hashes are 60 characters long
      expect(hash).toHaveLength(60);
    });

    it('should generate different hashes for same password (salt verification)', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should validate correct passwords', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, 'WrongPassword456');
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const result = validatePasswordStrength('StrongPass123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const result = validatePasswordStrength('Short1A');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePasswordStrength('weakpass123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain an uppercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePasswordStrength('WeakPassword');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain a number');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePasswordStrength('WEAKPASS123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain a lowercase letter');
    });

    it('should return multiple errors for weak passwords', () => {
      const result = validatePasswordStrength('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters');
      expect(result.errors).toContain('Password must contain an uppercase letter');
      expect(result.errors).toContain('Password must contain a number');
    });
  });
});
