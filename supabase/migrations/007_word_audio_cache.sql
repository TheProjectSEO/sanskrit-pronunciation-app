-- Migration: Word Audio Cache for Consistent TTS
-- Purpose: Store pre-generated TTS audio for each word to ensure consistency
-- Created: 2026-02-15

-- ============================================================================
-- TABLE: word_audio_cache
-- Stores pre-generated TTS audio URLs for individual words
-- ============================================================================

CREATE TABLE IF NOT EXISTS word_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  tts_provider VARCHAR(50) DEFAULT 'elevenlabs',
  tts_model VARCHAR(100) DEFAULT 'eleven_multilingual_v2',
  language VARCHAR(10) DEFAULT 'sa', -- Sanskrit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(word, tts_provider, tts_model, language)
);

-- Index for fast word lookup
CREATE INDEX IF NOT EXISTS idx_word_audio_cache_word ON word_audio_cache(word);

-- ============================================================================
-- TABLE: mantra_word_audio
-- Links mantras to their word audio (for cleanup if mantra is deleted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mantra_word_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mantra_id UUID NOT NULL REFERENCES mantras(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  word_audio_id UUID NOT NULL REFERENCES word_audio_cache(id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL, -- Position in mantra (0-indexed)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mantra_id, word_position)
);

-- Index for mantra lookup
CREATE INDEX IF NOT EXISTS idx_mantra_word_audio_mantra ON mantra_word_audio(mantra_id);

COMMENT ON TABLE word_audio_cache IS 'Cached TTS audio for individual words - ensures consistent pronunciation';
COMMENT ON TABLE mantra_word_audio IS 'Links mantras to their word audio files for lifecycle management';
