/**
 * Client-side energy-based silence detection for word boundary detection.
 * Analyzes an AudioBuffer's waveform to find silence regions between words,
 * then maps a known word list to audio segments.
 *
 * Designed for Sanskrit mantra chanting where words are spoken with
 * deliberate pauses between them (teaching-style recordings).
 */

// --- Types ---

export interface SilenceRegion {
  start: number;  // seconds
  end: number;    // seconds
  energy: number; // average RMS energy in this region
}

export interface WordBoundary {
  word: string;
  position: number;
  start: number;  // seconds
  end: number;    // seconds
  confidence: 'high' | 'medium' | 'low';
}

export interface DetectionResult {
  success: boolean;
  boundaries: WordBoundary[];
  silences: SilenceRegion[];
  failureReason?: string;
}

// --- Pre-processing ---

/**
 * Filter a raw word list to remove punctuation tokens like |, ||, commas.
 * Keeps only tokens that contain at least one alphabetic character.
 */
export function filterWords(rawWords: string[]): string[] {
  return rawWords.filter(w => {
    const stripped = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '');
    return stripped.length > 0;
  });
}

// --- Core Algorithm ---

/**
 * Compute RMS energy in fixed-size windows.
 * Returns an array of RMS values, one per window.
 */
function computeRMSEnergy(channelData: Float32Array, sampleRate: number, windowMs: number): Float32Array {
  const windowSamples = Math.floor((windowMs / 1000) * sampleRate);
  if (windowSamples === 0) return new Float32Array(0);

  const numWindows = Math.floor(channelData.length / windowSamples);
  const rms = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    let sumSquares = 0;
    const offset = i * windowSamples;
    for (let j = 0; j < windowSamples; j++) {
      const sample = channelData[offset + j];
      sumSquares += sample * sample;
    }
    rms[i] = Math.sqrt(sumSquares / windowSamples);
  }

  return rms;
}

/**
 * Compute an adaptive silence threshold based on the energy distribution.
 * Uses the 10th percentile as noise floor and 90th as speech level,
 * then sets threshold at noise floor + 15% of dynamic range.
 */
function computeSilenceThreshold(rms: Float32Array): number {
  const sorted = Float32Array.from(rms).sort();
  if (sorted.length === 0) return 0;

  const p10 = sorted[Math.floor(sorted.length * 0.10)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  const dynamicRange = p90 - p10;

  // If dynamic range is tiny, audio is nearly uniform (no speech/silence contrast)
  if (dynamicRange < 1e-6) return p90 * 0.5;

  return p10 + dynamicRange * 0.15;
}

/**
 * Find contiguous regions where energy stays below the threshold.
 * Only returns regions longer than minSilenceMs.
 */
function findSilenceRegions(
  rms: Float32Array,
  threshold: number,
  windowMs: number,
  minSilenceMs: number
): SilenceRegion[] {
  const minWindows = Math.ceil(minSilenceMs / windowMs);
  const regions: SilenceRegion[] = [];
  let silenceStart = -1;
  let energySum = 0;

  for (let i = 0; i < rms.length; i++) {
    if (rms[i] < threshold) {
      if (silenceStart === -1) {
        silenceStart = i;
        energySum = 0;
      }
      energySum += rms[i];
    } else {
      if (silenceStart !== -1) {
        const length = i - silenceStart;
        if (length >= minWindows) {
          regions.push({
            start: (silenceStart * windowMs) / 1000,
            end: (i * windowMs) / 1000,
            energy: energySum / length,
          });
        }
        silenceStart = -1;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== -1) {
    const length = rms.length - silenceStart;
    if (length >= minWindows) {
      regions.push({
        start: (silenceStart * windowMs) / 1000,
        end: (rms.length * windowMs) / 1000,
        energy: energySum / length,
      });
    }
  }

  return regions;
}

// --- Word-to-Segment Mapping ---

/**
 * Build word boundaries from silence regions.
 * Word boundaries are placed at the midpoint of each silence region.
 */
function buildBoundaries(
  words: string[],
  silences: SilenceRegion[],
  audioDuration: number,
  confidence: 'high' | 'medium',
): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
  for (let i = 0; i < words.length; i++) {
    const start = i === 0 ? 0 : (silences[i - 1].start + silences[i - 1].end) / 2;
    const end = i === words.length - 1 ? audioDuration : (silences[i].start + silences[i].end) / 2;
    boundaries.push({ word: words[i], position: i, start, end, confidence });
  }
  return boundaries;
}

/**
 * When we have some but not enough silences, use what we have
 * and subdivide remaining multi-word segments proportionally.
 */
function buildBoundariesWithSubdivision(
  words: string[],
  silences: SilenceRegion[],
  audioDuration: number,
): WordBoundary[] {
  const N = words.length;
  const expectedGaps = N - 1;

  // Sort silences by time
  const sorted = [...silences].sort((a, b) => a.start - b.start);

  // Compute where each silence falls proportionally in the audio
  // and assign it to the nearest expected gap index
  const assignedGaps = new Map<number, SilenceRegion>();
  for (const s of sorted) {
    const midpoint = (s.start + s.end) / 2;
    const proportionalPos = midpoint / audioDuration;
    const gapIndex = Math.round(proportionalPos * expectedGaps);
    const clampedIndex = Math.max(0, Math.min(expectedGaps - 1, gapIndex));

    // Assign to nearest unoccupied gap, or override if this silence is deeper
    const existing = assignedGaps.get(clampedIndex);
    if (!existing || s.energy < existing.energy) {
      assignedGaps.set(clampedIndex, s);
    }
  }

  // Build boundaries: use assigned silences where available,
  // subdivide evenly where not
  const boundaries: WordBoundary[] = [];
  let segStart = 0;
  let wordIdx = 0;

  // Collect cut points from assigned gaps
  const cutPoints: Array<{ gapIdx: number; time: number }> = [];
  for (const [gapIdx, silence] of assignedGaps.entries()) {
    cutPoints.push({ gapIdx, time: (silence.start + silence.end) / 2 });
  }
  cutPoints.sort((a, b) => a.gapIdx - b.gapIdx);

  let prevGapIdx = -1;
  let prevCutTime = 0;

  for (const { gapIdx, time } of cutPoints) {
    // Words from prevGapIdx+1 to gapIdx need to be distributed between prevCutTime and time
    const wordsInSegment = gapIdx - prevGapIdx;
    const segDuration = time - prevCutTime;
    const wordDuration = segDuration / wordsInSegment;

    for (let j = 0; j < wordsInSegment; j++) {
      boundaries.push({
        word: words[wordIdx],
        position: wordIdx,
        start: prevCutTime + j * wordDuration,
        end: prevCutTime + (j + 1) * wordDuration,
        confidence: j === wordsInSegment - 1 ? 'medium' : 'low',
      });
      wordIdx++;
    }

    prevGapIdx = gapIdx;
    prevCutTime = time;
  }

  // Remaining words after last cut point
  const remainingWords = N - wordIdx;
  if (remainingWords > 0) {
    const segDuration = audioDuration - prevCutTime;
    const wordDuration = segDuration / remainingWords;
    for (let j = 0; j < remainingWords; j++) {
      boundaries.push({
        word: words[wordIdx],
        position: wordIdx,
        start: prevCutTime + j * wordDuration,
        end: prevCutTime + (j + 1) * wordDuration,
        confidence: 'low',
      });
      wordIdx++;
    }
  }

  return boundaries;
}

/**
 * Evenly distribute words across the audio duration.
 * Used as a last resort when silence detection fails.
 */
function evenlyDistribute(words: string[], audioDuration: number): WordBoundary[] {
  const wordDuration = audioDuration / words.length;
  return words.map((word, i) => ({
    word,
    position: i,
    start: i * wordDuration,
    end: (i + 1) * wordDuration,
    confidence: 'low' as const,
  }));
}

/**
 * Map N words to N audio segments using detected silence regions.
 */
function mapWordsToSegments(
  words: string[],
  silences: SilenceRegion[],
  audioDuration: number,
): DetectionResult {
  const N = words.length;

  // Edge case: single word = entire audio
  if (N === 1) {
    return {
      success: true,
      boundaries: [{ word: words[0], position: 0, start: 0, end: audioDuration, confidence: 'high' }],
      silences,
    };
  }

  const expectedSilences = N - 1;

  // Filter: ignore leading silence (before first word) and trailing silence (after last word)
  // Use 2% of duration as margin
  const margin = audioDuration * 0.02;
  const interiorSilences = silences.filter(
    s => s.start > margin && s.end < audioDuration - margin
  );

  // CASE A: Perfect match — exactly N-1 silences
  if (interiorSilences.length === expectedSilences) {
    return {
      success: true,
      boundaries: buildBoundaries(words, interiorSilences, audioDuration, 'high'),
      silences,
    };
  }

  // CASE B: Too many silences — pick the N-1 with lowest energy (deepest silence)
  if (interiorSilences.length > expectedSilences) {
    const ranked = [...interiorSilences].sort((a, b) => a.energy - b.energy);
    const best = ranked.slice(0, expectedSilences).sort((a, b) => a.start - b.start);
    return {
      success: true,
      boundaries: buildBoundaries(words, best, audioDuration, 'medium'),
      silences,
    };
  }

  // CASE C: Partial — at least 50% of expected silences found
  if (interiorSilences.length > 0 && interiorSilences.length >= expectedSilences * 0.5) {
    return {
      success: true,
      boundaries: buildBoundariesWithSubdivision(words, interiorSilences, audioDuration),
      silences,
    };
  }

  // CASE D: Very few or no silences — detection failed
  return {
    success: false,
    boundaries: evenlyDistribute(words, audioDuration),
    silences,
    failureReason: `Found ${interiorSilences.length} silence regions but need ${expectedSilences}. The recording may have continuous chanting without clear pauses between words.`,
  };
}

// --- Main Export ---

/**
 * Detect word boundaries in an audio buffer using energy-based silence detection.
 *
 * @param audioBuffer - Decoded AudioBuffer from Web Audio API
 * @param words - Ordered word list (already filtered for punctuation)
 * @returns Detection result with boundaries and confidence
 */
export function detectWordBoundaries(
  audioBuffer: AudioBuffer,
  words: string[],
): DetectionResult {
  if (words.length === 0) {
    return { success: false, boundaries: [], silences: [], failureReason: 'No words provided' };
  }

  const windowMs = 10; // 10ms windows → 100 per second
  const minSilenceMs = 80; // minimum 80ms to count as silence between words

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const rms = computeRMSEnergy(channelData, sampleRate, windowMs);
  if (rms.length === 0) {
    return { success: false, boundaries: evenlyDistribute(words, duration), silences: [], failureReason: 'Audio too short to analyze' };
  }

  const threshold = computeSilenceThreshold(rms);
  const silences = findSilenceRegions(rms, threshold, windowMs, minSilenceMs);

  return mapWordsToSegments(words, silences, duration);
}
