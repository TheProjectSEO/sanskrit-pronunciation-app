/**
 * Tests for service role Supabase client factory.
 *
 * These tests verify that:
 * 1. The service client throws an error when called client-side
 * 2. The service client can be created successfully server-side
 * 3. The singleton pattern works correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getServiceSupabase,
  resetServiceSupabaseInstance,
} from '../service';

describe('getServiceSupabase', () => {
  // Store original window object
  const originalWindow = global.window;

  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset the singleton instance before each test
    resetServiceSupabaseInstance();

    // Reset environment variables
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;

    // Restore original env
    process.env = originalEnv;

    // Reset singleton
    resetServiceSupabaseInstance();
  });

  it('should throw error if called client-side', () => {
    // Simulate client-side environment
    // @ts-expect-error - Intentionally setting window for testing
    global.window = {} as Window & typeof globalThis;

    expect(() => getServiceSupabase()).toThrow(
      'getServiceSupabase() cannot be called client-side'
    );
  });

  it('should create service client server-side', () => {
    // Ensure we're in server-side environment
    // @ts-expect-error - Intentionally deleting window for testing
    delete global.window;

    const supabase = getServiceSupabase();

    expect(supabase).toBeDefined();
    expect(supabase).toHaveProperty('from');
    expect(supabase).toHaveProperty('auth');
  });

  it('should return same instance on multiple calls (singleton)', () => {
    // Ensure we're in server-side environment
    // @ts-expect-error - Intentionally deleting window for testing
    delete global.window;

    const instance1 = getServiceSupabase();
    const instance2 = getServiceSupabase();

    expect(instance1).toBe(instance2);
  });

  it('should throw error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    // Ensure we're in server-side environment
    // @ts-expect-error - Intentionally deleting window for testing
    delete global.window;

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => getServiceSupabase()).toThrow(
      'Missing Supabase environment variables'
    );
  });

  it('should throw error if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    // Ensure we're in server-side environment
    // @ts-expect-error - Intentionally deleting window for testing
    delete global.window;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => getServiceSupabase()).toThrow(
      'Missing Supabase environment variables'
    );
  });

  it('should reset instance correctly', () => {
    // Ensure we're in server-side environment
    // @ts-expect-error - Intentionally deleting window for testing
    delete global.window;

    const instance1 = getServiceSupabase();
    resetServiceSupabaseInstance();
    const instance2 = getServiceSupabase();

    // After reset, we should get a different instance
    expect(instance1).not.toBe(instance2);
  });
});
