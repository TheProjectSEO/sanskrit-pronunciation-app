'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Mantra {
  id: string;
  title: string | null;
  status: 'draft' | 'published';
  text_latin: string | null;
  text_devanagari: string | null;
  created_at: string;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string | null;
}

interface Stats {
  total: number;
  published: number;
  drafts: number;
  processing: number;
}

export default function MantrasPage() {
  const [mantras, setMantras] = useState<Mantra[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, processing: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchMantras();
  }, []);

  const fetchMantras = async () => {
    try {
      const response = await fetch('/api/instructor/mantras');
      if (!response.ok) {
        throw new Error('Failed to fetch mantras');
      }
      const data = await response.json();
      setMantras(data.mantras || []);
      setStats(data.stats || { total: 0, published: 0, drafts: 0, processing: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mantras');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mantraId: string, mantraName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${mantraName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(mantraId);
    try {
      const response = await fetch(`/api/instructor/delete-mantra?id=${mantraId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete mantra');
      }

      // Refresh the list
      await fetchMantras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mantra');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string, processingStatus?: string) => {
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Processing
        </span>
      );
    }
    if (processingStatus === 'failed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Failed
        </span>
      );
    }
    if (status === 'published') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Published
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Draft
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Mantras</h1>
          <p className="mt-1 text-gray-600">
            Manage your uploaded mantras and review processing status
          </p>
        </div>
        <Link
          href="/instructor/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Upload New Mantra
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Mantras</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-6">
          <p className="text-sm text-gray-600">Published</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.published}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Drafts</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.drafts}</p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-6">
          <p className="text-sm text-gray-600">Processing</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.processing}</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Mantras Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mantra
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Processing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mantras.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No mantras yet. Click "Upload New Mantra" to get started.
                </td>
              </tr>
            ) : (
              mantras.map((mantra) => (
                <tr key={mantra.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {mantra.title || mantra.text_latin?.substring(0, 50) || 'Untitled'}
                    </div>
                    {mantra.text_devanagari && (
                      <div className="text-sm text-gray-500 mt-1">
                        {mantra.text_devanagari.substring(0, 50)}
                        {mantra.text_devanagari.length > 50 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(mantra.status, mantra.processing_status)}
                  </td>
                  <td className="px-6 py-4">
                    {mantra.processing_status === 'failed' ? (
                      <div className="text-sm">
                        <span className="text-gray-600">Processing...</span>
                        <p className="text-red-500 text-xs mt-1">
                          {mantra.processing_error || 'Processing failed'}
                        </p>
                      </div>
                    ) : mantra.processing_status === 'processing' || mantra.processing_status === 'pending' ? (
                      <span className="text-sm text-yellow-600">Processing...</span>
                    ) : (
                      <span className="text-sm text-green-600">Complete</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(mantra.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/instructor/mantras/${mantra.id}`}
                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(mantra.id, mantra.title || mantra.text_latin?.substring(0, 30) || 'Untitled')}
                        disabled={deleting === mantra.id}
                        className={`text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 ${
                          deleting === mantra.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Delete mantra"
                      >
                        {deleting === mantra.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <TrashIcon className="w-4 h-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
