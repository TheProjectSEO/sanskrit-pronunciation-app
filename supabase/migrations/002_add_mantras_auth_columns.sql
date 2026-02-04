-- Migration: Add authentication-related columns to mantras table
-- Purpose: Enable draft/published workflow for instructor-managed mantras
-- Created: 2026-01-30

-- Add columns to existing mantras table

-- status: Controls visibility of mantras
--   - 'draft': Only visible to instructors
--   - 'published': Visible to all authenticated users
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
  CHECK (status IN ('draft', 'published'));

-- created_by: Tracks which instructor created/uploaded the mantra
-- Foreign key to users table
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- published_at: Timestamp when mantra was published
-- Used for tracking and audit purposes
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mantras_status ON mantras(status);
CREATE INDEX IF NOT EXISTS idx_mantras_created_by ON mantras(created_by);

-- Verification DO block to ensure migration succeeded
DO $$
BEGIN
  -- Check that all columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantras' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Column status was not added to mantras table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantras' AND column_name = 'created_by'
  ) THEN
    RAISE EXCEPTION 'Column created_by was not added to mantras table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantras' AND column_name = 'published_at'
  ) THEN
    RAISE EXCEPTION 'Column published_at was not added to mantras table';
  END IF;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mantras' AND indexname = 'idx_mantras_status'
  ) THEN
    RAISE EXCEPTION 'Index idx_mantras_status was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mantras' AND indexname = 'idx_mantras_created_by'
  ) THEN
    RAISE EXCEPTION 'Index idx_mantras_created_by was not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully: mantras table updated with auth columns';
END $$;

-- Update existing mantras to published status
-- This ensures backward compatibility - all existing mantras remain visible
UPDATE mantras SET status = 'published' WHERE status IS NULL OR status = 'draft';

-- Note: This migration must be applied manually via:
-- 1. Supabase Dashboard > SQL Editor
-- 2. Or using Supabase CLI: supabase db push
