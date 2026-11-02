'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const validatePasswordStrength = (password: string): string[] => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain an uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain a lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain a number');
    }

    return errors;
  };

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password });
    setPasswordErrors(validatePasswordStrength(password));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (passwordErrors.length > 0) {
      setError('Password does not meet requirements');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      // Show success message
      setSuccess(true);

      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-8">
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
              Password Reset Successful
            </h1>
            <p className="text-ink-soft">
              Your password has been successfully reset. Redirecting to sign
              in...
            </p>
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
            Set New Password
          </h1>
          <p className="text-ink-soft">
            Enter your new password below
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

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[0.95rem] font-medium text-ink-soft mb-2"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="Enter new password"
                disabled={loading || !token}
              />
              {/* Password Requirements */}
              {formData.password && (
                <div className="mt-2 space-y-1">
                  {passwordErrors.map((err, idx) => (
                    <p key={idx} className="text-sm text-sindoor flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {err}
                    </p>
                  ))}
                  {passwordErrors.length === 0 && (
                    <p className="text-sm text-leaf flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Password meets requirements
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[0.95rem] font-medium text-ink-soft mb-2"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="Confirm new password"
                disabled={loading || !token}
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-2 text-sm text-sindoor flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !token || passwordErrors.length > 0}
              className="w-full min-h-14 bg-cloth text-cloth-ink text-lg font-semibold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
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
          Password must contain at least 8 characters with uppercase, lowercase, and numbers
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-paper flex items-center justify-center">
          <div className="text-ink-soft">Loading...</div>
        </div>
      }
    >
      <ResetPasswordConfirmContent />
    </Suspense>
  );
}
