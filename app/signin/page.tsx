'use client';

import { useState, FormEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        // Map error codes to user-friendly messages
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password. Please try again.');
        } else {
          setError('An error occurred during sign in. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Successful sign in - redirect to callback URL
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (err) {
      console.error('Google sign in error:', err);
      setError('Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8">
      {/* Header */}
      <div className="text-center">
        <p lang="sa" className="font-mantra text-5xl text-sindoor mb-3" aria-hidden>तपस्वे</p>
        <h1 className="text-3xl font-semibold text-ink mb-2">
          Welcome Back
        </h1>
        <p className="text-ink-soft">
          Sign in to continue your Sanskrit practice
        </p>
      </div>

      {/* Sign In Form */}
      <div className="border-y-[3px] border-double border-paper-edge py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-sindoor-wash border border-sindoor/40 text-sindoor px-4 py-3 rounded-lg">
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-[0.95rem] font-medium text-ink-soft mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-[0.95rem] font-medium text-ink-soft"
              >
                Password
              </label>
              <Link
                href="/reset-password"
                className="text-sm font-medium text-sindoor underline underline-offset-4 hover:text-cloth transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-14 bg-cloth text-cloth-ink text-lg font-semibold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Link to Sign Up */}
        <div className="mt-6 text-center">
          <p className="text-sm text-ink-soft">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-sindoor underline underline-offset-4 hover:text-cloth transition-colors"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInLoading() {
  return (
    <div className="max-w-md w-full flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sindoor"></div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-12">
      <Suspense fallback={<SignInLoading />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
