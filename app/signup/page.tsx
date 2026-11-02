'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPasswordErrors([]);
    setLoading(true);

    try {
      // Call signup API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          setPasswordErrors(data.details);
        }
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Auto sign in after successful registration
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError('Account created but sign in failed. Please try signing in manually.');
        setLoading(false);
        return;
      }

      // Redirect to dashboard or home page
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (err) {
      console.error('Google sign in error:', err);
      setError('Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-ink mb-2">
            Create Account
          </h1>
          <p className="text-ink-soft">
            Join Tapaswe to perfect your Sanskrit pronunciation
          </p>
        </div>

        {/* Signup Form */}
        <div className="border-y-[3px] border-double border-paper-edge py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-sindoor-wash border border-sindoor/40 text-sindoor px-4 py-3 rounded-lg">
                <p className="font-medium">{error}</p>
                {passwordErrors.length > 0 && (
                  <ul className="mt-2 ml-4 list-disc text-sm">
                    {passwordErrors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* First Name */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-[0.95rem] font-medium text-ink-soft mb-2"
              >
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="Enter your first name"
                disabled={loading}
              />
            </div>

            {/* Last Name */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-[0.95rem] font-medium text-ink-soft mb-2"
              >
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="Enter your last name"
                disabled={loading}
              />
            </div>

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
              <label
                htmlFor="password"
                className="block text-[0.95rem] font-medium text-ink-soft mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full min-h-12 px-4 border border-paper-edge bg-paper-deep text-ink text-lg rounded-lg placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-focus transition-all"
                placeholder="Min. 8 characters with uppercase, lowercase, number"
                disabled={loading}
              />
              <p className="mt-2 text-sm text-ink-soft">
                Must contain uppercase, lowercase, number, and be at least 8 characters
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-14 bg-cloth text-cloth-ink text-lg font-semibold px-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Link to Sign In */}
          <div className="mt-6 text-center">
            <p className="text-sm text-ink-soft">
              Already have an account?{' '}
              <Link
                href="/signin"
                className="font-medium text-sindoor underline underline-offset-4 hover:text-cloth transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
