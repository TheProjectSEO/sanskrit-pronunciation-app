'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MicrophoneIcon,
  StopIcon,
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

type UploadMode = 'idle' | 'recording' | 'uploading' | 'processing' | 'success' | 'error';

interface TranscriptionResult {
  text_latin: string;
  text_devanagari: string;
  confidence: number;
  mantra_id: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          Record or upload an audio file of the mantra. We&apos;ll transcribe it automatically.
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
            ⚠️ Do not refresh or close this page
          </p>
        </div>
      )}

      {/* Success State */}
      {mode === 'success' && result && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              <h2 className="text-xl font-semibold text-green-800">Transcription Complete!</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latin Script (IAST)
                </label>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-lg">
                  {result.text_latin}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devanagari Script
                </label>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-lg font-sanskrit">
                  {result.text_devanagari}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Confidence:</span>
                <span className={`font-medium ${result.confidence >= 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push('/instructor/mantras')}
              className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              View All Mantras
            </button>
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Upload Another
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

      {/* Recording/Upload Interface */}
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

          {/* Recording/Upload Options */}
          {!audioUrl && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Record Option */}
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-300 transition-colors">
                <div className="mb-4">
                  {mode === 'recording' ? (
                    <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                      <MicrophoneIcon className="w-8 h-8 text-red-600" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                      <MicrophoneIcon className="w-8 h-8 text-orange-600" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {mode === 'recording' ? 'Recording...' : 'Record Audio'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {mode === 'recording'
                    ? 'Click stop when done'
                    : 'Use your microphone to record the mantra'}
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
                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <MicrophoneIcon className="w-5 h-5" />
                    Start Recording
                  </button>
                )}
              </div>

              {/* Upload Option */}
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-300 transition-colors">
                <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <ArrowUpTrayIcon className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload an MP3, WAV, M4A, or other audio file
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
