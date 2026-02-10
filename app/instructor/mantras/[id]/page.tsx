'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Deity {
  id: string;
  name: string;
  name_devanagari: string | null;
}

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
  deity_id: string | null;
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDevanagari, setEditDevanagari] = useState('');
  const [editRoman, setEditRoman] = useState('');
  const [editDeityId, setEditDeityId] = useState<string | null>(null);
  const [deities, setDeities] = useState<Deity[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
      return;
    }

    if (status === 'authenticated' && mantraId) {
      fetchMantra();
      fetchDeities();
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

  const fetchDeities = async () => {
    try {
      const response = await fetch('/api/instructor/deities');
      if (response.ok) {
        const data = await response.json();
        setDeities(data.deities || []);
      }
    } catch (err) {
      console.error('Failed to fetch deities:', err);
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

  const startEditing = () => {
    if (!mantra) return;
    setEditName(mantra.name || '');
    setEditDevanagari(mantra.reference_text_devanagari || mantra.text_devanagari || '');
    setEditRoman(mantra.reference_text_roman || mantra.text_latin || '');
    setEditDeityId(mantra.deity_id);
    setEditing(true);
    setError(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!mantra) return;

    const updates: Record<string, string | null> = {};
    if (editName !== mantra.name) updates.name = editName;
    if (editDevanagari !== (mantra.reference_text_devanagari || mantra.text_devanagari || ''))
      updates.reference_text_devanagari = editDevanagari;
    if (editRoman !== (mantra.reference_text_roman || mantra.text_latin || ''))
      updates.reference_text_roman = editRoman;
    if (editDeityId !== mantra.deity_id)
      updates.deity_id = editDeityId;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/instructor/mantras/${mantraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      await fetchMantra();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
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
          {editing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{mantra.name}</h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!editing && (
            <button
              onClick={startEditing}
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium text-sm"
            >
              Edit
            </button>
          )}
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

      {/* Published Warning */}
      {editing && mantra.status === 'published' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-yellow-700 text-sm">
            This mantra is published. Changes will be visible to students immediately.
          </p>
        </div>
      )}

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
            {editing ? (
              <textarea
                value={editDevanagari}
                onChange={(e) => setEditDevanagari(e.target.value)}
                rows={3}
                className="w-full p-4 bg-orange-50 border border-orange-200 rounded-lg text-xl font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
              />
            ) : (
              <div className="p-4 bg-orange-50 rounded-lg text-xl font-medium text-gray-900">
                {mantra.reference_text_devanagari || mantra.text_devanagari || (
                  <span className="text-gray-400 italic">Not transcribed yet</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Roman Script (IAST)
            </label>
            {editing ? (
              <textarea
                value={editRoman}
                onChange={(e) => setEditRoman(e.target.value)}
                rows={3}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
              />
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-lg text-gray-900">
                {mantra.reference_text_roman || mantra.text_latin || (
                  <span className="text-gray-400 italic">Not transcribed yet</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Deity Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deity
          </label>
          {editing ? (
            <select
              value={editDeityId || ''}
              onChange={(e) => setEditDeityId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="">No deity assigned</option>
              {deities.map((deity) => (
                <option key={deity.id} value={deity.id}>
                  {deity.name}{deity.name_devanagari ? ` (${deity.name_devanagari})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
              {mantra.deity_id && deities.length > 0
                ? (() => {
                    const d = deities.find((d) => d.id === mantra.deity_id);
                    return d ? `${d.name}${d.name_devanagari ? ` (${d.name_devanagari})` : ''}` : 'Unknown deity';
                  })()
                : <span className="text-gray-400 italic">No deity assigned</span>
              }
            </div>
          )}
        </div>

        {/* Save/Cancel buttons */}
        {editing && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
          </div>
        )}
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
