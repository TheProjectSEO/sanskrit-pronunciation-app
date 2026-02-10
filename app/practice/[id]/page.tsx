'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { playTTS, stopTTS } from '@/lib/audio/tts-player';
import { FEEDBACK_LANGUAGES, type FeedbackLanguage } from '@/lib/constants/languages';

interface Verse {
  id: string;
  verse_number: number;
  title: string | null;
  text_devanagari: string;
  text_roman: string;
  audio_start_time: number | null;
  audio_end_time: number | null;
}

interface Mantra {
  id: string;
  name: string;
  reference_text_devanagari: string;
  reference_text_roman: string;
  reference_audio_url: string;
  critical_sounds: string[];
}

interface ErrorDetail {
  type: 'substitution' | 'omission' | 'addition' | 'mispronunciation';
  expected?: string;
  actual?: string;
  explanation_hindi: string;
  explanation_english: string;
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
  detailed_errors?: ErrorDetail[]; // Specific error breakdown
  practice_suggestions?: string[]; // Tips from the guru
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

  // Word practice state
  const [practiceWord, setPracticeWord] = useState<{ devanagari: string; roman: string } | null>(null);
  const [clickedWord, setClickedWord] = useState<string | null>(null);

  // Verse state
  const [verses, setVerses] = useState<Verse[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);

  // Language preference
  const [feedbackLanguage, setFeedbackLanguage] = useState<FeedbackLanguage>('hindi');

  // Fetch language preference
  useEffect(() => {
    if (session?.user) {
      fetch('/api/user/preferences')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.feedback_language) setFeedbackLanguage(data.feedback_language);
        })
        .catch(() => {});
    }
  }, [session]);

  const handleLanguageChange = async (lang: FeedbackLanguage) => {
    setFeedbackLanguage(lang);
    if (session?.user) {
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_language: lang }),
      }).catch(() => {});
    }
  };

  // Handle clicking a word in the mantra text
  const handleWordClick = async (word: string) => {
    setClickedWord(word);
    try {
      await playTTS(word);
    } catch (err) {
      console.error('TTS error for word:', word, err);
    } finally {
      setClickedWord(null);
    }
  };

  // Open word practice modal
  const openWordPractice = (roman: string) => {
    // Find matching devanagari word by position
    const romanWords = activeRoman.split(/\s+/) || [];
    const devWords = activeDevanagari.split(/\s+/) || [];
    const idx = romanWords.indexOf(roman);
    const devanagari = idx >= 0 && idx < devWords.length ? devWords[idx] : '';
    setPracticeWord({ devanagari, roman });
  };

  // Fetch mantra
  useEffect(() => {
    if (mantraId) {
      fetchMantra();
      fetchVerses();
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

  const fetchVerses = async () => {
    try {
      const response = await fetch(`/api/mantras/${mantraId}/verses`);
      if (response.ok) {
        const data = await response.json();
        setVerses(data.verses || []);
      }
    } catch (err) {
      console.error('Failed to fetch verses:', err);
    }
  };

  // Get the active text for practice (verse or full mantra)
  const activeDevanagari = selectedVerse?.text_devanagari || mantra?.reference_text_devanagari || '';
  const activeRoman = selectedVerse?.text_roman || mantra?.reference_text_roman || '';

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
      formData.append('reference_text', activeRoman);
      formData.append('feedback_language', feedbackLanguage);

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

        {/* Mantra Text - Clickable Words */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-sm font-medium text-gray-500 tracking-wider uppercase">
            {mantra.name}
            {selectedVerse && (
              <span className="text-purple-500"> - Verse {selectedVerse.verse_number}{selectedVerse.title ? `: ${selectedVerse.title}` : ''}</span>
            )}
          </h1>
          <p className="text-2xl text-orange-600 font-medium">
            {activeDevanagari.split(/\s+/).map((word, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span
                  onClick={() => handleWordClick(word)}
                  className={`cursor-pointer hover:bg-orange-100 rounded px-0.5 transition-colors ${
                    clickedWord === word ? 'bg-orange-200 animate-pulse' : ''
                  }`}
                  title="Tap to hear"
                >
                  {word}
                </span>
              </span>
            ))}
          </p>
          <p className="text-lg text-gray-600 italic">
            {activeRoman.split(/\s+/).map((word, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span
                  onClick={() => handleWordClick(word)}
                  className={`cursor-pointer hover:bg-gray-100 rounded px-0.5 transition-colors ${
                    clickedWord === word ? 'bg-gray-200 animate-pulse' : ''
                  }`}
                  title="Tap to hear"
                >
                  {word}
                </span>
              </span>
            ))}
          </p>
          <p className="text-xs text-gray-400 mt-1">Tap any word to hear it</p>
        </div>

        {/* Verse Selector */}
        {verses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => { setSelectedVerse(null); setAnalysisResult(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedVerse === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
              }`}
            >
              Full Mantra
            </button>
            {verses.map((verse) => (
              <button
                key={verse.id}
                onClick={() => { setSelectedVerse(verse); setAnalysisResult(null); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedVerse?.id === verse.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
                }`}
              >
                Verse {verse.verse_number}{verse.title ? `: ${verse.title}` : ''}
              </button>
            ))}
          </div>
        )}

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

        {/* Language Selector */}
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-gray-500">Feedback in:</span>
          <select
            value={feedbackLanguage}
            onChange={(e) => handleLanguageChange(e.target.value as FeedbackLanguage)}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-full bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {FEEDBACK_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
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
              referenceRoman={activeRoman}
              referenceDevanagari={activeDevanagari}
              isTTSLoading={isTTSLoading}
              isTTSPlaying={isTTSPlaying}
              onRetry={() => setAnalysisResult(null)}
              onPlayFeedback={() => analysisResult.hindi_feedback && playHindiFeedback(analysisResult.hindi_feedback)}
              onPracticeWord={openWordPractice}
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

      {/* Word Practice Modal */}
      {practiceWord && (
        <WordPracticeModal
          word={practiceWord}
          feedbackLanguage={feedbackLanguage}
          onClose={() => setPracticeWord(null)}
        />
      )}
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
  onPracticeWord,
}: {
  result: AnalysisResult;
  referenceRoman: string;
  referenceDevanagari: string;
  isTTSLoading: boolean;
  isTTSPlaying: boolean;
  onRetry: () => void;
  onPlayFeedback: () => void;
  onPracticeWord: (roman: string) => void;
}) {
  const [wordTTSState, setWordTTSState] = useState<Record<string, 'loading' | 'playing'>>({});

  const handlePlayWord = async (word: string) => {
    const key = word;
    setWordTTSState((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      setWordTTSState((prev) => ({ ...prev, [key]: 'playing' }));
      await playTTS(word);
    } catch (err) {
      console.error('TTS error for word:', word, err);
    } finally {
      setWordTTSState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const scoreColor =
    result.overall_score >= 80
      ? 'text-green-500'
      : result.overall_score >= 60
      ? 'text-yellow-500'
      : 'text-red-500';

  const scoreBgColor =
    result.overall_score >= 80
      ? 'bg-green-50 border-green-200'
      : result.overall_score >= 60
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-red-50 border-red-200';

  // Helper to get error type icon and color
  const getErrorStyle = (type: string) => {
    switch (type) {
      case 'substitution':
        return { icon: '↔', color: 'text-red-600', bg: 'bg-red-50', label: 'प्रतिस्थापन' };
      case 'omission':
        return { icon: '−', color: 'text-orange-600', bg: 'bg-orange-50', label: 'लोप' };
      case 'addition':
        return { icon: '+', color: 'text-blue-600', bg: 'bg-blue-50', label: 'अतिरिक्त' };
      case 'mispronunciation':
        return { icon: '~', color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'उच्चारण दोष' };
      default:
        return { icon: '?', color: 'text-gray-600', bg: 'bg-gray-50', label: 'त्रुटि' };
    }
  };

  return (
    <div className="space-y-5">
      {/* Score with visual indicator */}
      <div className={`rounded-xl p-4 border ${scoreBgColor}`}>
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

      {/* Detailed Errors Section - The key improvement */}
      {result.detailed_errors && result.detailed_errors.length > 0 && (
        <div className="text-left space-y-3">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">📋</span> विस्तृत विश्लेषण (Detailed Analysis):
          </p>
          <div className="space-y-2">
            {result.detailed_errors.map((error, index) => {
              const style = getErrorStyle(error.type);
              return (
                <div
                  key={index}
                  className={`${style.bg} border border-gray-200 rounded-lg p-3`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`${style.color} font-bold text-lg w-6 h-6 flex items-center justify-center rounded-full bg-white border`}>
                      {style.icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${style.color} uppercase`}>
                          {style.label}
                        </span>
                        {error.expected && error.actual && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            "{error.actual}" → "{error.expected}"
                            <button
                              onClick={() => handlePlayWord(error.expected!)}
                              disabled={!!wordTTSState[error.expected!]}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-colors flex-shrink-0"
                              title={`Listen: ${error.expected}`}
                            >
                              <span className={`text-xs ${wordTTSState[error.expected!] === 'playing' ? 'animate-pulse' : ''}`}>
                                {wordTTSState[error.expected!] === 'loading' ? '...' : '🔊'}
                              </span>
                            </button>
                          </span>
                        )}
                        {error.expected && !error.actual && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            Missing: "{error.expected}"
                            <button
                              onClick={() => handlePlayWord(error.expected!)}
                              disabled={!!wordTTSState[error.expected!]}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-colors flex-shrink-0"
                              title={`Listen: ${error.expected}`}
                            >
                              <span className={`text-xs ${wordTTSState[error.expected!] === 'playing' ? 'animate-pulse' : ''}`}>
                                {wordTTSState[error.expected!] === 'loading' ? '...' : '🔊'}
                              </span>
                            </button>
                          </span>
                        )}
                        {!error.expected && error.actual && (
                          <span className="text-xs text-gray-500">
                            Extra: "{error.actual}"
                          </span>
                        )}
                      </div>
                      <p className={`${style.color} text-sm font-medium`}>
                        {error.explanation_hindi}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {error.explanation_english}
                      </p>
                      {error.expected && (
                        <button
                          onClick={() => onPracticeWord(error.expected!)}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                        >
                          <span>🎯</span> Practice this word
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Word Analysis - Visual chips */}
      {result.word_analysis && result.word_analysis.length > 0 && (
        <div className="text-left space-y-2">
          <p className="text-sm font-medium text-gray-700">शब्द विश्लेषण (Word by Word):</p>
          <div className="flex flex-wrap gap-2">
            {result.word_analysis.map((word, index) => (
              <div
                key={index}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  word.status === 'correct'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : word.status === 'needs_work'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{word.word}</span>
                  <span>
                    {word.status === 'correct' ? '✓' : word.status === 'needs_work' ? '~' : '✗'}
                  </span>
                  {word.status !== 'correct' && (
                    <button
                      onClick={() => handlePlayWord(word.word)}
                      disabled={!!wordTTSState[word.word]}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-colors ml-1 flex-shrink-0"
                      title={`Listen: ${word.word}`}
                    >
                      <span className={`text-xs ${wordTTSState[word.word] === 'playing' ? 'animate-pulse' : ''}`}>
                        {wordTTSState[word.word] === 'loading' ? '...' : '🔊'}
                      </span>
                    </button>
                  )}
                </div>
                {word.feedback && (
                  <p className="text-xs opacity-80 mt-1">{word.feedback}</p>
                )}
                {word.status !== 'correct' && (
                  <button
                    onClick={() => onPracticeWord(word.word)}
                    className="text-xs underline opacity-70 hover:opacity-100 mt-1"
                  >
                    Practice
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hindi Feedback with TTS - Main guru feedback */}
      {result.hindi_feedback && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🙏</div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                गुरु का मार्गदर्शन (Teacher's Guidance)
              </p>
              <p className="text-orange-900 text-lg leading-relaxed">{result.hindi_feedback}</p>
              {isTTSLoading && (
                <p className="text-orange-500 text-sm mt-2 animate-pulse">
                  ऑडियो लोड हो रहा है...
                </p>
              )}
              {isTTSPlaying && (
                <p className="text-orange-600 text-sm mt-2 flex items-center gap-1">
                  <span className="animate-pulse">🔊</span> सुन रहे हैं...
                </p>
              )}
            </div>
            <button
              onClick={onPlayFeedback}
              disabled={isTTSLoading || isTTSPlaying}
              className={`p-3 rounded-full transition-all flex-shrink-0 shadow-md ${
                isTTSLoading
                  ? 'bg-orange-300 cursor-wait'
                  : isTTSPlaying
                  ? 'bg-orange-600 animate-pulse scale-110'
                  : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'
              } text-white`}
              title="सुनें"
            >
              🔊
            </button>
          </div>
        </div>
      )}

      {/* Practice Suggestions */}
      {result.practice_suggestions && result.practice_suggestions.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-left">
          <p className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
            <span>💡</span> अभ्यास सुझाव (Practice Tips):
          </p>
          <ul className="space-y-1">
            {result.practice_suggestions.map((tip, index) => (
              <li key={index} className="text-purple-700 text-sm flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pt-2">
        <button
          onClick={onRetry}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          फिर से कोशिश करें (Try Again)
        </button>
      </div>
    </div>
  );
}

// Word Practice Modal Component
function WordPracticeModal({
  word,
  feedbackLanguage,
  onClose,
}: {
  word: { devanagari: string; roman: string };
  feedbackLanguage: FeedbackLanguage;
  onClose: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ score: number; is_correct: boolean; feedback: string; tip: string; user_transcription: string } | null>(null);
  const [attempts, setAttempts] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPressing = useRef(false);

  // Play word TTS on mount
  useEffect(() => {
    playTTS(word.roman).catch(() => {});
    return () => { stopTTS(); };
  }, [word.roman]);

  // Global release handler
  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isPressing.current) {
        handleRecordEnd();
      }
    };
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchend', handleGlobalEnd);
    return () => {
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, []);

  const startRecording = async () => {
    try {
      stopTTS();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        if (blob.size > 500) {
          analyzeWord(blob);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      setResult(null);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
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

  const handleRecordStart = useCallback(() => {
    if (isPressing.current) return;
    isPressing.current = true;
    startRecording();
  }, []);

  const handleRecordEnd = useCallback(() => {
    if (!isPressing.current) return;
    isPressing.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording();
    }
  }, [isRecording]);

  const analyzeWord = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('reference_word', word.roman);
      formData.append('feedback_language', feedbackLanguage);

      const response = await fetch('/api/analyze-word', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setResult(data);
      setAttempts((prev) => prev + 1);
    } catch (err) {
      console.error('Word analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Word Practice</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Word Display */}
        <div className="text-center space-y-1">
          {word.devanagari && (
            <p className="text-3xl text-orange-600 font-medium">{word.devanagari}</p>
          )}
          <p className="text-xl text-gray-600 italic">{word.roman}</p>
          <button
            onClick={() => playTTS(word.roman)}
            className="mt-2 inline-flex items-center gap-1 px-4 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors"
          >
            🔊 Listen
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-xl p-4 border ${
            result.is_correct
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{result.is_correct ? '🎉' : '🔄'}</span>
              <div className="flex-1">
                <p className={`font-bold text-lg ${result.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                  {result.score}%
                </p>
                <p className="text-sm text-gray-700">{result.feedback}</p>
                {result.tip && (
                  <p className="text-xs text-gray-500 mt-1">{result.tip}</p>
                )}
                {result.user_transcription && (
                  <p className="text-xs text-gray-400 mt-1">
                    You said: "{result.user_transcription}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Record Button */}
        {isAnalyzing ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Analyzing...</p>
          </div>
        ) : (
          <div className="text-center">
            <button
              onMouseDown={(e) => { e.preventDefault(); handleRecordStart(); }}
              onTouchStart={(e) => { e.preventDefault(); handleRecordStart(); }}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all select-none ${
                isRecording
                  ? 'bg-red-500 scale-110 animate-pulse'
                  : 'bg-purple-600 hover:bg-purple-700'
              } shadow-lg cursor-pointer`}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
            >
              <span className="text-3xl text-white pointer-events-none">🎤</span>
            </button>
            <p className="text-sm text-gray-500 mt-2">
              {isRecording ? `Recording... ${recordingTime}s` : 'Press & hold to record'}
            </p>
            {attempts > 0 && (
              <p className="text-xs text-gray-400 mt-1">Attempt {attempts}</p>
            )}
          </div>
        )}

        {/* Done button */}
        {result?.is_correct && (
          <button
            onClick={onClose}
            className="w-full py-3 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 transition-colors"
          >
            Done!
          </button>
        )}
      </div>
    </div>
  );
}
