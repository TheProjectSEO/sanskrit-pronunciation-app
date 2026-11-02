'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }

      // Show success message regardless of whether email exists (security best practice)
      setSubmitted(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-paper-deep rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-leaf"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-ink mb-2">
              Check Your Email
            </h1>
            <p className="text-ink-soft">
              If an account exists with{' '}
              <span className="font-medium text-ink">{email}</span>, you
              will receive a password reset link shortly.
            </p>
          </div>

          {/* Instructions Card */}
          <div className="border-y-[3px] border-double border-paper-edge py-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-paper-deep rounded-full flex items-center justify-center text-sindoor font-semibold text-sm mt-0.5">
                  1
                </div>
                <p className="text-ink-soft">
                  Check your email inbox for a message from Tapaswe
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-paper-deep rounded-full flex items-center justify-center text-sindoor font-semibold text-sm mt-0.5">
                  2
                </div>
                <p className="text-ink-soft">
                  Click the reset link in the email (valid for 1 hour)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-paper-deep rounded-full flex items-center justify-center text-sindoor font-semibold text-sm mt-0.5">
                  3
                </div>
                <p className="text-ink-soft">
                  Create a new password for your account
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-paper-edge">
              <p className="text-sm text-ink-soft mb-4">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="w-full min-h-14 border border-paper-edge bg-paper-deep text-ink font-semibold px-4 rounded-xl hover:bg-paper-edge/40 transition-all"
              >
                Send Another Email
              </button>
            </div>
          </div>

          {/* Back to Sign In */}
          <div className="text-center">
            <Link
              href="/signin"
              className="text-sm font-medium text-sindoor underline underline-offset-4 hover:text-cloth transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-ink mb-2">
            Reset Password
          </h1>
          <p className="text-ink-soft">
            Enter your email address and we'll send you a link to reset your
            password
          </p>
        </div>

        {/* Reset Form */}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-14 bg-cloth text-cloth-ink text-lg font-semibold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Sign In */}
          <div className="mt-6 text-center">
            <Link
              href="/signin"
              className="text-sm font-medium text-sindoor underline underline-offset-4 hover:text-cloth transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-ink-soft">
          Password reset links are valid for 1 hour
        </p>
      </div>
    </div>
  );
}
