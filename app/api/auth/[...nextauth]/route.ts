/**
 * NextAuth v5 API Route Handler
 *
 * This route handles all authentication-related requests:
 * - GET /api/auth/signin - Sign in page
 * - POST /api/auth/signin - Process sign in
 * - GET /api/auth/signout - Sign out page
 * - POST /api/auth/signout - Process sign out
 * - GET /api/auth/callback/:provider - OAuth callbacks
 * - GET /api/auth/session - Get current session
 * - GET /api/auth/csrf - Get CSRF token
 * - GET /api/auth/providers - List available providers
 *
 * The handlers are exported from the auth.ts configuration file.
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
