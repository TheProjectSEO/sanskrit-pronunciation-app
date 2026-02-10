'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Deity {
  id: string;
  name: string;
  name_devanagari: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

export default function DeitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [deities, setDeities] = useState<Deity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDevanagari, setFormDevanagari] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
      return;
    }
    if (status === 'authenticated') {
      fetchDeities();
    }
  }, [status]);

  const fetchDeities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/instructor/deities');
      if (!response.ok) throw new Error('Failed to fetch deities');
      const data = await response.json();
      setDeities(data.deities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const response = await fetch('/api/instructor/deities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          name_devanagari: formDevanagari.trim() || undefined,
          description: formDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create deity');
      }

      setFormName('');
      setFormDevanagari('');
      setFormDescription('');
      setShowForm(false);
      await fetchDeities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deity');
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Deities</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Deity'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name (English) *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ganesh"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name (Devanagari)
            </label>
            <input
              type="text"
              value={formDevanagari}
              onChange={(e) => setFormDevanagari(e.target.value)}
              placeholder="e.g. गणेश"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !formName.trim()}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
          >
            {creating ? 'Creating...' : 'Create Deity'}
          </button>
        </form>
      )}

      {/* Deities List */}
      {deities.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No deities created yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Create deities to categorize your mantras.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {deities.map((deity) => (
            <div
              key={deity.id}
              className="bg-white border border-gray-200 rounded-lg p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🙏</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{deity.name}</h3>
                  {deity.name_devanagari && (
                    <p className="text-orange-600 text-sm">{deity.name_devanagari}</p>
                  )}
                  {deity.description && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{deity.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
