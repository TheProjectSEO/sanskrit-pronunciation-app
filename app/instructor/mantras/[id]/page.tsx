'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Mantra {
  id: string;
  name: string;
  status: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  reference_audio_url: string;
  text_latin: string | null;
  text_devanagari: string | null;
  audio_url: string | null;
  created_at: string;
  processing_status?: string;
  processing_error?: string;
}

export default function MantraDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const mantraId = params.id as string;

  const [mantra, setMantra] = useState<Mantra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
      return;
    }

    if (status === 'authenticated' && mantraId) {
      fetchMantra();
    }
  }, [status, mantraId]);

  const fetchMantra = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/instructor/mantras/${mantraId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch mantra');
      }
      const data = await response.json();
      setMantra(data.mantra);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mantra');
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async () => {
    try {
      setReprocessing(true);
      setError(null);
      const response = await fetch(`/api/instructor/reprocess-mantra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mantra_id: mantraId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Reprocessing failed');
      }

      await fetchMantra();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprocessing failed');
    } finally {
      setReprocessing(false);
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      setError(null);
      const response = await fetch(`/api/instructor/publish-mantra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mantra_id: mantraId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Publishing failed');
      }

      await fetchMantra();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed');
    } finally {
      setPublishing(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && !mantra) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link
            href="/instructor/mantras"
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Mantras
          </Link>
        </div>
      </div>
    );
  }

  if (!mantra) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">Mantra not found</p>
          <Link
            href="/instructor/mantras"
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Mantras
          </Link>
        </div>
      </div>
    );
  }

  const isFailed = mantra.processing_status === 'failed' || mantra.processing_error;
  const isProcessing = mantra.processing_status === 'processing' || mantra.processing_status === 'pending';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/instructor/mantras"
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-2"
          >
            <span>←</span> Back to All Mantras
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{mantra.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              mantra.status === 'published'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {mantra.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Processing Error Banner */}
      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-red-800">Processing Failed</h3>
              <p className="text-red-600 text-sm mt-1">{mantra.processing_error}</p>
            </div>
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {reprocessing ? 'Reprocessing...' : 'Retry Processing'}
            </button>
          </div>
        </div>
      )}

      {/* Audio Player */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reference Audio</h2>
        {mantra.reference_audio_url ? (
          <audio
            ref={audioRef}
            controls
            className="w-full"
            src={mantra.reference_audio_url}
          >
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p className="text-gray-500">No audio available</p>
        )}
      </div>

      {/* Transcription */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcription</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Devanagari Script
            </label>
            <div className="p-4 bg-orange-50 rounded-lg text-xl font-medium text-gray-900">
              {mantra.reference_text_devanagari || mantra.text_devanagari || (
                <span className="text-gray-400 italic">Not transcribed yet</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Roman Script (IAST)
            </label>
            <div className="p-4 bg-gray-50 rounded-lg text-lg text-gray-900">
              {mantra.reference_text_roman || mantra.text_latin || (
                <span className="text-gray-400 italic">Not transcribed yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {mantra.status === 'draft' && !isProcessing && !isFailed && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {publishing ? 'Publishing...' : 'Publish Mantra'}
            </button>
          )}

          {(isFailed || (!mantra.reference_text_devanagari && !mantra.text_devanagari)) && (
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
            >
              {reprocessing ? 'Processing...' : 'Reprocess Audio'}
            </button>
          )}

          <Link
            href="/instructor/mantras"
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Back to List
          </Link>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Created:</span>{' '}
            {new Date(mantra.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">ID:</span> {mantra.id}
          </div>
        </div>
      </div>
    </div>
  );
}
