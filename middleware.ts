import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Public routes that don't require authentication
 */
const publicRoutes = ['/signin', '/signup', '/reset-password', '/api/auth'];

/**
 * Routes that require instructor role
 */
const instructorRoutes = ['/instructor'];

/**
 * Route protection middleware
 * - Allows public routes without authentication
 * - Redirects unauthenticated users to /signin with callback URL
 * - Checks instructor role for instructor routes
 */
export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // Allow public routes
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to signin
  if (!isLoggedIn) {
    const signInUrl = new URL('/signin', nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check instructor role for instructor routes
  const isInstructorRoute = instructorRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isInstructorRoute) {
    const userRole = req.auth?.user?.role;
    if (userRole !== 'instructor') {
      return NextResponse.redirect(new URL('/', nextUrl.origin));
    }
  }

  return NextResponse.next();
});

/**
 * Middleware configuration
 * - Excludes Next.js internal routes
 * - Excludes static assets
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .*\\.(?:jpg|jpeg|gif|png|svg|ico|webp) (image files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)).*)',
  ],
};
