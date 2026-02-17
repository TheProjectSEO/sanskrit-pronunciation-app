'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MicrophoneIcon,
  StopIcon,
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

type UploadMode = 'idle' | 'recording' | 'uploading' | 'processing' | 'success' | 'error';

interface TranscriptionResult {
  text_latin: string;
  text_devanagari: string;
  confidence: number;
  mantra_id: string;
  mantra_name?: string;
  audio_url?: string;
}

interface Deity {
  id: string;
  name: string;
  name_devanagari: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Text input mode
  const [showTextInput, setShowTextInput] = useState(false);
  const [textRoman, setTextRoman] = useState('');
  const [textDevanagari, setTextDevanagari] = useState('');
  const [mantraName, setMantraName] = useState('');
  const [transliterating, setTransliterating] = useState(false);
  const [creatingMantra, setCreatingMantra] = useState(false);
  const transliterateTimer = useRef<NodeJS.Timeout | null>(null);

  // Success screen editing state
  const [editRoman, setEditRoman] = useState('');
  const [editDevanagari, setEditDevanagari] = useState('');
  const [editName, setEditName] = useState('');
  const [editingField, setEditingField] = useState<'roman' | 'devanagari' | 'name' | null>(null);
  const [deities, setDeities] = useState<Deity[]>([]);
  const [selectedDeityId, setSelectedDeityId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [splittingWords, setSplittingWords] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch deities when success screen shows
  useEffect(() => {
    if (mode === 'success') {
      fetch('/api/deities')
        .then(res => res.json())
        .then(data => setDeities(data.deities || []))
        .catch(() => {});
    }
  }, [mode]);

  // Initialize edit fields when result arrives
  useEffect(() => {
    if (result) {
      setEditRoman(result.text_latin);
      setEditDevanagari(result.text_devanagari);
      setEditName(result.mantra_name || '');
    }
  }, [result]);

  const saveAndProcess = async () => {
    if (!result?.mantra_id) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      // Step 1: Save any edits (name, text, deity)
      const patchBody: Record<string, string | null> = {};
      if (editName !== result.mantra_name) patchBody.name = editName;
      if (editRoman !== result.text_latin) patchBody.reference_text_roman = editRoman;
      if (editDevanagari !== result.text_devanagari) patchBody.reference_text_devanagari = editDevanagari;
      if (selectedDeityId) patchBody.deity_id = selectedDeityId;

      if (Object.keys(patchBody).length > 0) {
        const patchRes = await fetch(`/api/instructor/mantras/${result.mantra_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        });
        if (!patchRes.ok) {
          const err = await patchRes.json();
          throw new Error(err.error || 'Failed to save changes');
        }
      }

      // Step 2: Split audio into words if there's reference audio
      if (result.audio_url) {
        setSplittingWords(true);
        setSaveMessage('Splitting audio into words...');
        const splitRes = await fetch('/api/generate-word-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mantra_id: result.mantra_id }),
        });
        if (splitRes.ok) {
          const splitData = await splitRes.json();
          setSaveMessage(`Saved! Split into ${splitData.words?.length || 0} words.`);
        } else {
          setSaveMessage('Saved! (Word splitting had an issue - you can retry from the mantra page)');
        }
        setSplittingWords(false);
      } else {
        setSaveMessage('Saved successfully!');
      }

      // Brief delay then redirect
      setTimeout(() => {
        router.push(`/instructor/mantras/${result.mantra_id}`);
      }, 1500);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  // Auto-transliterate when Roman text changes
  const handleRomanChange = (value: string) => {
    setTextRoman(value);
    if (!mantraName) setMantraName(value.split('.')[0]?.trim() || value.trim());
    if (transliterateTimer.current) clearTimeout(transliterateTimer.current);
    transliterateTimer.current = setTimeout(() => autoTransliterate(value), 800);
  };

  const autoTransliterate = async (text: string) => {
    if (!text.trim() || text.trim().length < 3) return;
    setTransliterating(true);
    try {
      const res = await fetch('/api/translate-to-devanagari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roman_text: text.trim(), mode: 'mantra' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.devanagari_text) setTextDevanagari(data.devanagari_text);
        // If AI corrected the Roman text, update it
        if (data.roman_text && data.roman_text !== text.trim()) {
          setTextRoman(data.roman_text);
          if (!mantraName || mantraName === text.split('.')[0]?.trim()) {
            setMantraName(data.roman_text.split('.')[0]?.trim() || data.roman_text.trim());
          }
        }
      }
    } catch {} finally {
      setTransliterating(false);
    }
  };

  const createMantraFromText = async () => {
    if (!textRoman.trim()) {
      setError('Please enter the mantra text');
      return;
    }

    setCreatingMantra(true);
    setError(null);

    try {
      const response = await fetch('/api/instructor/mantras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mantraName.trim() || textRoman.split('.')[0]?.trim() || textRoman.trim(),
          reference_text_roman: textRoman.trim(),
          reference_text_devanagari: textDevanagari.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create mantra');
      }

      setResult({
        text_latin: textRoman,
        text_devanagari: textDevanagari,
        confidence: 1.0,
        mantra_id: data.mantra?.id || '',
      });
      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mantra');
    } finally {
      setCreatingMantra(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setMode('recording');
      setError(null);
    } catch (err) {
      setError('Could not access microphone. Please ensure microphone permissions are granted.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setMode('idle');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError('Please select an audio file (MP3, WAV, M4A, etc.)');
        return;
      }
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const processAudio = async () => {
    if (!audioBlob) {
      setError('No audio to process');
      return;
    }

    setMode('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/instructor/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      setResult(data);
      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setMode('error');
    }
  };

  const resetForm = () => {
    setMode('idle');
    setError(null);
    setResult(null);
    setAudioBlob(null);
    setShowTextInput(false);
    setTextRoman('');
    setTextDevanagari('');
    setMantraName('');
    setEditRoman('');
    setEditDevanagari('');
    setEditName('');
    setEditingField(null);
    setSelectedDeityId('');
    setSaving(false);
    setSplittingWords(false);
    setSaveMessage(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back Link */}
      <Link
        href="/instructor/mantras"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to All Mantras
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload New Mantra</h1>
        <p className="mt-1 text-gray-600">
          Type the mantra text, record audio, or upload an audio file.
        </p>
      </div>

      {/* Processing State */}
      {mode === 'processing' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Audio</h2>
          <p className="text-gray-600 mb-4">
            Please wait while we transcribe your mantra...
          </p>
          <p className="text-sm text-yellow-700 font-medium">
            Do not refresh or close this page
          </p>
        </div>
      )}

      {/* Success State */}
      {mode === 'success' && result && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              <div>
                <h2 className="text-xl font-semibold text-green-800">Mantra Created!</h2>
                {result.confidence > 0 && (
                  <p className="text-green-600 text-xs">Confidence: {Math.round(result.confidence * 100)}%</p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              {/* Mantra Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Mantra Name</label>
                  {editingField !== 'name' && (
                    <button
                      onClick={() => setEditingField('name')}
                      className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                    >
                      <PencilIcon className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {editingField === 'name' ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingField(null)}
                      className="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-lg font-medium">
                    {editName || result.mantra_name || 'Unnamed Mantra'}
                  </div>
                )}
              </div>

              {/* Roman Script (IAST) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Roman Script (IAST)</label>
                  {editingField !== 'roman' && (
                    <button
                      onClick={() => setEditingField('roman')}
                      className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                    >
                      <PencilIcon className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {editingField === 'roman' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editRoman}
                      onChange={(e) => setEditRoman(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg resize-vertical"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingField(null)}
                      className="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-lg">
                    {editRoman}
                  </div>
                )}
              </div>

              {/* Devanagari Script */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Devanagari Script</label>
                  {editingField !== 'devanagari' && (
                    <button
                      onClick={() => setEditingField('devanagari')}
                      className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                    >
                      <PencilIcon className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {editingField === 'devanagari' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDevanagari}
                      onChange={(e) => setEditDevanagari(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg resize-vertical"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingField(null)}
                      className="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-lg">
                    {editDevanagari}
                  </div>
                )}
              </div>

              {/* Deity Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Deity
                </label>
                <select
                  value={selectedDeityId}
                  onChange={(e) => setSelectedDeityId(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-lg"
                >
                  <option value="">— No deity (assign later) —</option>
                  {deities.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.name_devanagari ? `(${d.name_devanagari})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div className={`text-center py-2 text-sm font-medium ${saveMessage.includes('fail') || saveMessage.includes('issue') ? 'text-yellow-700' : 'text-green-700'}`}>
              {saveMessage}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={saveAndProcess}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors"
            >
              {saving
                ? splittingWords
                  ? 'Splitting Words...'
                  : 'Saving...'
                : result.audio_url
                  ? 'Save & Split Words'
                  : 'Save & Continue'}
            </button>
            <button
              onClick={resetForm}
              disabled={saving}
              className="px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Add Another
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {mode === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ExclamationCircleIcon className="w-8 h-8 text-red-600" />
            <h2 className="text-xl font-semibold text-red-800">Processing Failed</h2>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={resetForm}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Recording/Upload/Text Interface */}
      {(mode === 'idle' || mode === 'recording') && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Audio Preview */}
          {audioUrl && mode === 'idle' && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio Preview
              </label>
              <audio src={audioUrl} controls className="w-full" />
              <div className="mt-4 flex gap-4">
                <button
                  onClick={processAudio}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Process & Transcribe
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Text Input Mode */}
          {showTextInput && !audioUrl && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mantra Name
                </label>
                <input
                  type="text"
                  value={mantraName}
                  onChange={(e) => setMantraName(e.target.value)}
                  placeholder="e.g. Gayatri Mantra, Om Namah Shivaya"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mantra Text (English/Roman) — type here, Devanagari auto-generates
                </label>
                <textarea
                  value={textRoman}
                  onChange={(e) => handleRomanChange(e.target.value)}
                  rows={3}
                  placeholder="e.g. Om Namah Shivaya"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
                />
                <p className="text-xs text-gray-400 mt-1">AI will recognize the mantra and provide the correct text</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devanagari {transliterating && <span className="text-orange-500 text-xs ml-1">AI generating...</span>}
                </label>
                <div className="relative">
                  <textarea
                    value={textDevanagari}
                    onChange={(e) => setTextDevanagari(e.target.value)}
                    rows={3}
                    placeholder="Auto-generated from English text..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-vertical"
                  />
                  {transliterating && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={createMantraFromText}
                  disabled={creatingMantra || !textRoman.trim()}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {creatingMantra ? 'Creating...' : 'Create Mantra'}
                </button>
                <button
                  onClick={() => { setShowTextInput(false); setTextRoman(''); setTextDevanagari(''); setMantraName(''); }}
                  className="px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Three Options: Type / Record / Upload */}
          {!audioUrl && !showTextInput && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Type Option */}
              <div className="text-center p-8 border-2 border-dashed border-orange-300 rounded-xl hover:border-orange-400 bg-orange-50/50 transition-colors">
                <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <PencilSquareIcon className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Type Mantra</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Type in English, AI generates Devanagari
                </p>
                <button
                  onClick={() => setShowTextInput(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                  Type It
                </button>
              </div>

              {/* Record Option */}
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-300 transition-colors">
                <div className="mb-4">
                  {mode === 'recording' ? (
                    <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                      <MicrophoneIcon className="w-8 h-8 text-red-600" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <MicrophoneIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {mode === 'recording' ? 'Recording...' : 'Record Audio'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {mode === 'recording'
                    ? 'Click stop when done'
                    : 'Record the mantra pronunciation'}
                </p>
                {mode === 'recording' ? (
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <StopIcon className="w-5 h-5" />
                    Stop Recording
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <MicrophoneIcon className="w-5 h-5" />
                    Start Recording
                  </button>
                )}
              </div>

              {/* Upload Option */}
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-300 transition-colors">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ArrowUpTrayIcon className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload an MP3, WAV, or M4A file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Choose File
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
