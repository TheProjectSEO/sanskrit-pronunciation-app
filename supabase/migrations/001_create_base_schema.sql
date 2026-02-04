-- Migration: Create Base Schema (Idempotent)
-- Purpose: Create all required tables with IF NOT EXISTS to handle existing database
-- Created: 2026-01-30
-- Description: This migration consolidates all table creation statements to ensure
--              the schema is consistent regardless of previous migration state.

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- OAUTH_ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github')),
  provider_account_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);

-- ============================================================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- ============================================================================
-- MANTRAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mantras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  difficulty_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'status') THEN
    ALTER TABLE mantras ADD COLUMN status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'created_by') THEN
    ALTER TABLE mantras ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'published_at') THEN
    ALTER TABLE mantras ADD COLUMN published_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'text_latin') THEN
    ALTER TABLE mantras ADD COLUMN text_latin TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'text_devanagari') THEN
    ALTER TABLE mantras ADD COLUMN text_devanagari TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'audio_url') THEN
    ALTER TABLE mantras ADD COLUMN audio_url TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mantras_status ON mantras(status);
CREATE INDEX IF NOT EXISTS idx_mantras_created_by ON mantras(created_by);
CREATE INDEX IF NOT EXISTS idx_mantras_difficulty ON mantras(difficulty_level);

-- ============================================================================
-- REFERENCE_AUDIO_CLIPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reference_audio_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mantra_id UUID NOT NULL REFERENCES mantras(id) ON DELETE CASCADE,
  clip_type VARCHAR(50) NOT NULL CHECK (clip_type IN ('word', 'word_pair', 'full_mantra')),
  word_text VARCHAR(255),
  word_position INTEGER,
  audio_url TEXT NOT NULL,
  start_time NUMERIC,
  end_time NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reference_audio_clips_mantra_id ON reference_audio_clips(mantra_id);
CREATE INDEX IF NOT EXISTS idx_reference_audio_clips_clip_type ON reference_audio_clips(clip_type);

-- ============================================================================
-- MANTRA_PROCESSING_JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mantra_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mantra_id UUID NOT NULL REFERENCES mantras(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantra_processing_jobs' AND column_name = 'audio_path') THEN
    ALTER TABLE mantra_processing_jobs ADD COLUMN audio_path TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantra_processing_jobs' AND column_name = 'created_by') THEN
    ALTER TABLE mantra_processing_jobs ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mantra_processing_jobs_mantra_id ON mantra_processing_jobs(mantra_id);
CREATE INDEX IF NOT EXISTS idx_mantra_processing_jobs_status ON mantra_processing_jobs(status);

-- ============================================================================
-- PRONUNCIATION_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pronunciation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mantra_id UUID REFERENCES mantras(id) ON DELETE CASCADE,
  attempt_audio_url TEXT,
  feedback_score NUMERIC,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_logs_user_id ON pronunciation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_logs_mantra_id ON pronunciation_logs(mantra_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'oauth_accounts',
    'password_reset_tokens',
    'mantras',
    'reference_audio_clips',
    'mantra_processing_jobs',
    'pronunciation_logs'
  );

  IF table_count != 7 THEN
    RAISE EXCEPTION 'Expected 7 tables, found %', table_count;
  END IF;

  RAISE NOTICE 'Base schema migration completed successfully:';
  RAISE NOTICE '  - % tables created or verified', table_count;
  RAISE NOTICE '  - All indexes created';
  RAISE NOTICE '  - All foreign keys established';
END $$;
