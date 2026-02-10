'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navLinks = [
    { href: '/instructor/mantras', label: 'Mantras', icon: '📿' },
    { href: '/instructor/deities', label: 'Deities', icon: '🙏' },
    { href: '/instructor/upload', label: 'Upload New', icon: '+' },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Badge */}
            <div className="flex items-center gap-3">
              <Link href="/instructor/mantras" className="flex items-center gap-2">
                <span className="text-2xl">🪷</span>
                <span className="text-xl font-bold text-gray-900">Tapaswe</span>
              </Link>
              <span className="bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                Instructor
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'text-orange-600'
                      : 'text-gray-600 hover:text-orange-600'
                  }`}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* User Info and Actions */}
            <div className="flex items-center gap-4">
              {/* Visit User View */}
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
              >
                Visit User View
              </Link>

              {/* User Info */}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {session?.user?.name || 'Instructor'}
                </p>
                <p className="text-xs text-gray-500">Instructor</p>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => signOut({ callbackUrl: '/signin' })}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="flex justify-center gap-8 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 text-sm font-medium ${
                  isActive(link.href)
                    ? 'text-orange-600'
                    : 'text-gray-600'
                }`}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
