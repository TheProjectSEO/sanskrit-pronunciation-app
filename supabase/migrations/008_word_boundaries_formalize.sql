-- Migration: Formalize word boundary columns on mantra_word_audio
-- Purpose: Add start_time, end_time, verified, detection_method columns;
--          make word_audio_id nullable (timestamps don't need TTS cache entry)
-- Created: 2026-03-31

-- Make word_audio_id nullable (we no longer always need a TTS cache entry)
ALTER TABLE mantra_word_audio ALTER COLUMN word_audio_id DROP NOT NULL;

-- Add columns if they don't exist (some may have been added manually)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantra_word_audio' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE mantra_word_audio ADD COLUMN start_time DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantra_word_audio' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE mantra_word_audio ADD COLUMN end_time DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantra_word_audio' AND column_name = 'verified'
  ) THEN
    ALTER TABLE mantra_word_audio ADD COLUMN verified BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantra_word_audio' AND column_name = 'detection_method'
  ) THEN
    ALTER TABLE mantra_word_audio ADD COLUMN detection_method VARCHAR(20) DEFAULT 'whisper';
  END IF;
END $$;

COMMENT ON COLUMN mantra_word_audio.start_time IS 'Word start time in seconds within reference audio';
COMMENT ON COLUMN mantra_word_audio.end_time IS 'Word end time in seconds within reference audio';
COMMENT ON COLUMN mantra_word_audio.verified IS 'True if instructor confirmed boundaries via waveform UI';
COMMENT ON COLUMN mantra_word_audio.detection_method IS 'How boundaries were detected: whisper, energy, whisperx, manual';
