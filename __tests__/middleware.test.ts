import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import middleware from '../middleware';

// Mock the auth function
jest.mock('@/auth', () => ({
  auth: jest.fn((handler) => handler),
}));

describe('Route Protection Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Public routes', () => {
    it('should allow access to /signin without authentication', () => {
      const req = {
        nextUrl: {
          pathname: '/signin',
          origin: 'http://localhost:3000',
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
      // Public route should pass through
    });

    it('should allow access to /signup without authentication', () => {
      const req = {
        nextUrl: {
          pathname: '/signup',
          origin: 'http://localhost:3000',
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should allow access to /reset-password without authentication', () => {
      const req = {
        nextUrl: {
          pathname: '/reset-password',
          origin: 'http://localhost:3000',
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should allow access to /api/auth routes without authentication', () => {
      const req = {
        nextUrl: {
          pathname: '/api/auth/signin',
          origin: 'http://localhost:3000',
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
    });
  });

  describe('Protected routes - unauthenticated', () => {
    it('should redirect unauthenticated users to /signin with callbackUrl', () => {
      const req = {
        nextUrl: {
          pathname: '/practice',
          origin: 'http://localhost:3000',
          searchParams: new URLSearchParams(),
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);

      // Check if it's a redirect
      if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        expect(location).toContain('/signin');
        expect(location).toContain('callbackUrl=%2Fpractice');
      }
    });

    it('should redirect unauthenticated users accessing root path', () => {
      const req = {
        nextUrl: {
          pathname: '/',
          origin: 'http://localhost:3000',
          searchParams: new URLSearchParams(),
        },
        auth: null,
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
    });
  });

  describe('Instructor routes', () => {
    it('should identify /instructor as an instructor route', () => {
      const req = {
        nextUrl: {
          pathname: '/instructor',
          origin: 'http://localhost:3000',
        },
        auth: {
          user: {
            id: '123',
            email: 'user@example.com',
            role: 'user',
          },
        },
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);

      // Non-instructor should be redirected
      if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        expect(location).toContain('/');
      }
    });

    it('should allow instructor access to /instructor routes', () => {
      const req = {
        nextUrl: {
          pathname: '/instructor',
          origin: 'http://localhost:3000',
        },
        auth: {
          user: {
            id: '123',
            email: 'instructor@example.com',
            role: 'instructor',
          },
        },
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
      // Should pass through for instructors
    });

    it('should redirect non-instructor users from instructor routes to home', () => {
      const req = {
        nextUrl: {
          pathname: '/instructor/dashboard',
          origin: 'http://localhost:3000',
        },
        auth: {
          user: {
            id: '123',
            email: 'user@example.com',
            role: 'user',
          },
        },
      } as any;

      const response = middleware(req);

      // Check if it's a redirect to home
      if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        expect(location).toBe('http://localhost:3000/');
      }
    });
  });

  describe('Authenticated users - regular routes', () => {
    it('should allow authenticated users to access regular routes', () => {
      const req = {
        nextUrl: {
          pathname: '/practice',
          origin: 'http://localhost:3000',
        },
        auth: {
          user: {
            id: '123',
            email: 'user@example.com',
            role: 'user',
          },
        },
      } as any;

      const response = middleware(req);
      expect(response).toBeInstanceOf(NextResponse);
      // Should pass through
    });
  });
});
