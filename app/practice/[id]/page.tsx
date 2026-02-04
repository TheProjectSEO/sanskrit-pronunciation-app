'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Mantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  reference_audio_url: string;
  critical_sounds: string[];
}

interface AnalysisResult {
  overall_score: number;
  feedback: string;
  word_analysis: {
    word: string;
    status: 'correct' | 'needs_work' | 'incorrect';
    feedback?: string;
  }[];
  hindi_feedback?: string;
  user_transcription?: string; // What the user actually said
}

export default function PracticePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const mantraId = params.id as string;

  // Mantra state
  const [mantra, setMantra] = useState<Mantra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const isPressing = useRef(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  // Fetch mantra
  useEffect(() => {
    if (mantraId) {
      fetchMantra();
    }
  }, [mantraId]);

  const fetchMantra = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mantras/${mantraId}`);
      if (!response.ok) throw new Error('Failed to fetch mantra');
      const data = await response.json();
      setMantra(data.mantra);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mantra');
    } finally {
      setLoading(false);
    }
  };

  // Audio player controls
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seekTo(newTime);
    }
  };

  const changeSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newRate = speeds[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Recording controls
  const startRecording = async () => {
    try {
      // Stop reference audio if playing to prevent microphone picking it up
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use webm which is widely supported in browsers
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      console.log('Recording with mimeType:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        console.log('Data available:', e.data.size, 'bytes');
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('Created blob:', blob.size, 'bytes');
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording with timeslice to get data periodically (every 250ms)
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      setAnalysisResult(null);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Handle press and hold - robust implementation
  const handleRecordStart = useCallback(() => {
    console.log('🎤 Record START - isPressing:', isPressing.current, 'isRecording:', isRecording);
    if (isPressing.current) return; // Already pressing
    isPressing.current = true;
    startRecording();
  }, [isRecording]);

  const handleRecordEnd = useCallback(() => {
    console.log('🛑 Record END - isPressing:', isPressing.current, 'isRecording:', isRecording);
    if (!isPressing.current) return; // Not pressing
    isPressing.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording();
    }
  }, [isRecording]);

  // Attach global mouseup/touchend to handle release outside button
  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isPressing.current) {
        console.log('🌍 Global release detected');
        handleRecordEnd();
      }
    };

    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchend', handleGlobalEnd);

    return () => {
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [handleRecordEnd]);

  // Analyze recording (only if blob has data)
  useEffect(() => {
    if (audioBlob && !isRecording && audioBlob.size > 1000) {
      // Only analyze if recording has meaningful data (>1KB)
      analyzeRecording();
    } else if (audioBlob && audioBlob.size <= 1000) {
      console.log('Recording too short, ignoring:', audioBlob.size, 'bytes');
      setAudioBlob(null);
    }
  }, [audioBlob]);

  const analyzeRecording = async () => {
    if (!audioBlob || !mantra) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('mantra_id', mantra.id);
      formData.append('reference_text', mantra.reference_text_roman);

      const response = await fetch('/api/analyze-pronunciation', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      setAnalysisResult(result);

      // Play Hindi feedback using ElevenLabs TTS
      if (result.hindi_feedback) {
        playHindiFeedback(result.hindi_feedback);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze pronunciation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play Hindi feedback using ElevenLabs TTS
  const playHindiFeedback = async (hindiText: string) => {
    setIsTTSLoading(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: hindiText }),
      });

      if (!response.ok) {
        console.error('TTS failed');
        setIsTTSLoading(false);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      setIsTTSLoading(false);
      setIsTTSPlaying(true);

      audio.onended = () => {
        setIsTTSPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    } catch (err) {
      console.error('Failed to play feedback:', err);
      setIsTTSLoading(false);
      setIsTTSPlaying(false);
    }
  };

  // Play key sound using ElevenLabs TTS
  const playKeySound = async (sound: string) => {
    setPlayingSound(sound);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sound }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setPlayingSound(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setPlayingSound(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !mantra) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Mantra not found'}</p>
          <Link href="/" className="text-orange-600 hover:text-orange-700">
            Back to Mantras
          </Link>
        </div>
      </div>
    );
  }

  const keySounds = mantra.critical_sounds?.length > 0
    ? mantra.critical_sounds
    : extractKeySounds(mantra.reference_text_roman);

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🪷</span>
            <span className="text-lg font-semibold text-gray-800">Tapaswe</span>
          </Link>
          {session && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-orange-500">
                <span>🔥</span> 3
              </span>
              <span className="flex items-center gap-1 text-purple-500">
                <span>✨</span> 0 XP
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors font-medium"
        >
          <span>←</span> Back to Mantras
        </Link>

        {/* Mantra Text */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-sm font-medium text-gray-500 tracking-wider uppercase">
            {mantra.name}
          </h1>
          <p className="text-2xl text-orange-600 font-medium">
            {mantra.reference_text_devanagari}
          </p>
          <p className="text-lg text-gray-600 italic">
            {mantra.reference_text_roman}
          </p>
        </div>

        {/* Audio Player */}
        <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-purple-600">🔊</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">
                पहले सुनें (Listen First)
              </p>
              <p className="text-sm text-gray-500">{mantra.name}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => skip(-5)}
              className="w-10 h-10 flex items-center justify-center text-purple-600 hover:bg-purple-200 rounded-full transition-colors"
            >
              ⏪
            </button>
            <button
              onClick={togglePlayPause}
              className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors shadow-lg"
            >
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button
              onClick={() => skip(5)}
              className="w-10 h-10 flex items-center justify-center text-purple-600 hover:bg-purple-200 rounded-full transition-colors"
            >
              ⏩
            </button>
            <button
              onClick={changeSpeed}
              className="px-3 py-1 border border-purple-300 rounded-full text-sm text-purple-600 hover:bg-purple-100 transition-colors"
            >
              {playbackRate}x
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            💡 Tip: Use 0.5x speed to hear individual sounds clearly
          </p>

          <audio
            ref={audioRef}
            src={mantra.reference_audio_url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        </div>

        {/* Key Sounds */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span>🔔</span> Key Sounds - Tap to hear
          </h3>
          <div className="flex flex-wrap gap-2">
            {keySounds.map((sound, index) => (
              <button
                key={index}
                onClick={() => playKeySound(sound)}
                disabled={playingSound === sound}
                className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                  playingSound === sound
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
                }`}
              >
                [{sound}]
              </button>
            ))}
          </div>
        </div>

        {/* Recording Section */}
        <div className="bg-gradient-to-br from-purple-50 to-orange-50 rounded-2xl p-8 text-center">
          {isAnalyzing ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
              <p className="text-gray-600">Analyzing your pronunciation...</p>
              <p className="text-sm text-gray-400">
                Comparing with reference audio
              </p>
            </div>
          ) : analysisResult ? (
            <AnalysisDisplay
              result={analysisResult}
              referenceRoman={mantra.reference_text_roman}
              referenceDevanagari={mantra.reference_text_devanagari}
              isTTSLoading={isTTSLoading}
              isTTSPlaying={isTTSPlaying}
              onRetry={() => setAnalysisResult(null)}
              onPlayFeedback={() => analysisResult.hindi_feedback && playHindiFeedback(analysisResult.hindi_feedback)}
            />
          ) : (
            <>
              <button
                ref={recordButtonRef}
                onMouseDown={(e) => {
                  e.preventDefault();
                  console.log('👆 mousedown event');
                  handleRecordStart();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  console.log('👆 touchstart event');
                  handleRecordStart();
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all select-none ${
                  isRecording
                    ? 'bg-red-500 scale-110 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                } shadow-lg cursor-pointer`}
                style={{
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none'
                }}
              >
                <span className="text-5xl text-white pointer-events-none select-none">🎤</span>
              </button>

              <div className="mt-6">
                <p className="font-semibold text-gray-800 text-lg">
                  {isRecording
                    ? recordingTime < 2
                      ? `Keep holding... ${recordingTime}s`
                      : `Recording... ${recordingTime}s`
                    : 'Press & Hold to Record'}
                </p>
                <p className="text-gray-500">
                  {isRecording
                    ? recordingTime < 2
                      ? 'Hold for at least 2 seconds'
                      : 'Release when done'
                    : 'लंबा दबाएं और बोलें'}
                </p>
              </div>

              {!isRecording && (
                <div className="mt-6 text-sm text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">Pro Tips:</p>
                  <ul className="space-y-1">
                    <li>• Listen to the reference multiple times first</li>
                    <li>• Speak clearly and at a steady pace</li>
                    <li>• Focus on pronouncing each syllable distinctly</li>
                    <li>• Record in a quiet environment</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// Helper to extract key sounds from text
function extractKeySounds(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  // Filter to meaningful Sanskrit words (more than 3 chars, not common words)
  const filtered = words.filter(
    (w) => w.length > 4 && !['namo', 'namah', 'shri'].includes(w)
  );
  return filtered.slice(0, 4);
}

// Analysis Result Display Component
function AnalysisDisplay({
  result,
  referenceRoman,
  referenceDevanagari,
  isTTSLoading,
  isTTSPlaying,
  onRetry,
  onPlayFeedback,
}: {
  result: AnalysisResult;
  referenceRoman: string;
  referenceDevanagari: string;
  isTTSLoading: boolean;
  isTTSPlaying: boolean;
  onRetry: () => void;
  onPlayFeedback: () => void;
}) {
  const scoreColor =
    result.overall_score >= 80
      ? 'text-green-500'
      : result.overall_score >= 60
      ? 'text-yellow-500'
      : 'text-red-500';

  return (
    <div className="space-y-5">
      {/* Score */}
      <div>
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {result.overall_score}%
        </div>
        <p className="text-gray-600 mt-2">{result.feedback}</p>
      </div>

      {/* Transcription Comparison - What you said vs What you should say */}
      <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
        {/* What user said */}
        {result.user_transcription && (
          <div>
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
              आपने कहा (You said):
            </p>
            <p className="text-gray-800 font-medium">{result.user_transcription}</p>
          </div>
        )}

        {/* What they should say */}
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
            सही उच्चारण (Correct):
          </p>
          <p className="text-green-800 font-medium">{referenceDevanagari}</p>
          <p className="text-green-700 text-sm italic">{referenceRoman}</p>
        </div>
      </div>

      {/* Word Analysis */}
      <div className="text-left space-y-2">
        <p className="text-sm font-medium text-gray-700">Word by Word:</p>
        <div className="flex flex-wrap gap-2">
          {result.word_analysis.map((word, index) => (
            <span
              key={index}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                word.status === 'correct'
                  ? 'bg-green-100 text-green-700'
                  : word.status === 'needs_work'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
              title={word.feedback}
            >
              {word.word}
              {word.status === 'correct' ? ' ✓' : word.status === 'needs_work' ? ' ~' : ' ✗'}
            </span>
          ))}
        </div>
      </div>

      {/* Hindi Feedback with TTS */}
      {result.hindi_feedback && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-orange-800 text-lg">{result.hindi_feedback}</p>
              {isTTSLoading && (
                <p className="text-orange-500 text-sm mt-1 animate-pulse">
                  Loading audio...
                </p>
              )}
              {isTTSPlaying && (
                <p className="text-orange-600 text-sm mt-1 flex items-center gap-1">
                  <span className="animate-pulse">🔊</span> Playing...
                </p>
              )}
            </div>
            <button
              onClick={onPlayFeedback}
              disabled={isTTSLoading || isTTSPlaying}
              className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                isTTSLoading
                  ? 'bg-orange-300 cursor-wait'
                  : isTTSPlaying
                  ? 'bg-orange-600 animate-pulse'
                  : 'bg-orange-500 hover:bg-orange-600'
              } text-white`}
              title="सुनें"
            >
              {isTTSLoading ? '⏳' : isTTSPlaying ? '🔊' : '🔊'}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
