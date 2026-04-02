'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WordBoundary } from './energy-detector';

// Dynamic import types — wavesurfer.js accesses window
type WaveSurferInstance = import('wavesurfer.js').default;
type RegionsPluginInstance = InstanceType<typeof import('wavesurfer.js/dist/plugins/regions').default>;
type RegionInstance = ReturnType<RegionsPluginInstance['addRegion']>;

interface WaveformEditorProps {
  audioUrl: string;
  words: string[];
  initialBoundaries: WordBoundary[];
  onSave: (boundaries: WordBoundary[]) => Promise<void>;
  onCancel: () => void;
}

// Alternating colors for word regions
const REGION_COLORS = [
  'rgba(59, 130, 246, 0.18)',   // blue
  'rgba(34, 197, 94, 0.18)',    // green
];

export default function WaveformEditor({
  audioUrl,
  words,
  initialBoundaries,
  onSave,
  onCancel,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurferInstance | null>(null);
  const regionsRef = useRef<RegionsPluginInstance | null>(null);
  const regionMapRef = useRef<Map<string, RegionInstance>>(new Map());
  const isUpdatingRef = useRef(false);

  const [boundaries, setBoundaries] = useState<WordBoundary[]>(initialBoundaries);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize wavesurfer
  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    async function init() {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions')).default;

      if (destroyed || !containerRef.current) return;

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#d4a574',
        progressColor: '#ea580c',
        cursorColor: '#1d4ed8',
        height: 128,
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        plugins: [regions],
      });

      ws.on('ready', () => {
        if (destroyed) return;

        // Add regions for each word
        const map = new Map<string, RegionInstance>();
        initialBoundaries.forEach((b, i) => {
          const region = regions.addRegion({
            id: `word-${i}`,
            start: b.start,
            end: b.end,
            color: REGION_COLORS[i % 2],
            content: b.word,
            drag: false,
            resize: true,
            minLength: 0.05,
          });
          map.set(`word-${i}`, region);
        });
        regionMapRef.current = map;
        setReady(true);
      });

      // When a region boundary is resized, snap adjacent regions
      regions.on('region-updated', (region) => {
        if (isUpdatingRef.current) return;
        isUpdatingRef.current = true;

        const idx = parseInt(region.id.replace('word-', ''));
        const map = regionMapRef.current;

        // Snap previous region's end to this region's start
        if (idx > 0) {
          const prev = map.get(`word-${idx - 1}`);
          if (prev && Math.abs(prev.end - region.start) > 0.001) {
            prev.setOptions({ end: region.start });
          }
        }

        // Snap next region's start to this region's end
        if (idx < initialBoundaries.length - 1) {
          const next = map.get(`word-${idx + 1}`);
          if (next && Math.abs(next.start - region.end) > 0.001) {
            next.setOptions({ start: region.end });
          }
        }

        // Update boundaries state
        setBoundaries(prev => {
          const updated = [...prev];
          // Read all regions to get current state
          for (let i = 0; i < updated.length; i++) {
            const r = map.get(`word-${i}`);
            if (r) {
              updated[i] = { ...updated[i], start: r.start, end: r.end };
            }
          }
          return updated;
        });

        isUpdatingRef.current = false;
      });

      ws.on('error', (err) => {
        if (!destroyed) setLoadError(String(err));
      });

      wavesurferRef.current = ws;
      ws.load(audioUrl);
    }

    init();

    return () => {
      destroyed = true;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
      regionMapRef.current.clear();
    };
  }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const playWord = useCallback((index: number) => {
    const ws = wavesurferRef.current;
    if (!ws || !ready) return;

    const b = boundaries[index];
    setPlayingIndex(index);

    ws.setTime(b.start);
    ws.play();

    const checkEnd = () => {
      if (!ws || ws.getCurrentTime() >= b.end) {
        ws.pause();
        setPlayingIndex(null);
        ws.un('timeupdate', checkEnd);
      }
    };
    ws.on('timeupdate', checkEnd);
  }, [boundaries, ready]);

  const playAll = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !ready) return;
    ws.setTime(0);
    ws.play();
  }, [ready]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(boundaries);
    } finally {
      setSaving(false);
    }
  }, [boundaries, onSave]);

  const overallConfidence = boundaries.length > 0
    ? boundaries.every(b => b.confidence === 'high') ? 'high'
    : boundaries.some(b => b.confidence === 'low') ? 'low'
    : 'medium'
    : 'low';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-900">Verify Word Boundaries</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            overallConfidence === 'high' ? 'bg-green-100 text-green-700' :
            overallConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {overallConfidence === 'high' ? 'Auto-detected' :
             overallConfidence === 'medium' ? 'Needs review' :
             'Manual adjustment needed'}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Play each word below to verify. Drag the region edges on the waveform to adjust boundaries.
      </p>

      {/* Waveform */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {loadError ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load audio: {loadError}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="w-full" />
            {!ready && (
              <div className="p-8 flex items-center justify-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                <span className="text-sm text-gray-500">Loading waveform...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Word buttons */}
      {ready && (
        <div className="flex flex-wrap gap-2">
          {boundaries.map((b, i) => (
            <button
              key={`${i}-${b.word}`}
              onClick={() => playWord(i)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                playingIndex === i
                  ? 'bg-blue-100 border-blue-400 text-blue-800 ring-2 ring-blue-300'
                  : b.confidence === 'low'
                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {playingIndex === i ? (
                <span className="flex items-end gap-0.5 h-4">
                  <span className="w-1 bg-blue-500 animate-pulse" style={{height: '60%'}} />
                  <span className="w-1 bg-blue-500 animate-pulse" style={{height: '100%', animationDelay: '0.15s'}} />
                  <span className="w-1 bg-blue-500 animate-pulse" style={{height: '40%', animationDelay: '0.3s'}} />
                </span>
              ) : (
                <span className="text-blue-500">&#9654;</span>
              )}
              <span>{b.word}</span>
              <span className="text-xs text-gray-400">
                {b.start.toFixed(2)}s
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {ready && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              'Confirm & Save'
            )}
          </button>

          <button
            onClick={playAll}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium text-sm"
          >
            Play All
          </button>

          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
