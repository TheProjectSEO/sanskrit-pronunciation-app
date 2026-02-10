-- Migration: Create Deities Table + Link to Mantras
-- Purpose: Add deity/category system so instructors can assign mantras to deities
-- Created: 2026-02-10

-- ============================================================================
-- DEITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS deities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name_devanagari VARCHAR(255),
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deities_name ON deities(name);
CREATE INDEX IF NOT EXISTS idx_deities_created_by ON deities(created_by);

-- ============================================================================
-- ADD deity_id TO MANTRAS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'deity_id') THEN
    ALTER TABLE mantras ADD COLUMN deity_id UUID REFERENCES deities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mantras_deity_id ON mantras(deity_id);

-- ============================================================================
-- RLS POLICIES FOR DEITIES
-- ============================================================================

ALTER TABLE deities ENABLE ROW LEVEL SECURITY;

-- Everyone can read deities
CREATE POLICY IF NOT EXISTS "deities_select_all" ON deities
  FOR SELECT USING (true);

-- Instructors can insert deities
CREATE POLICY IF NOT EXISTS "deities_insert_instructor" ON deities
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'instructor')
  );

-- Instructors can update their own deities
CREATE POLICY IF NOT EXISTS "deities_update_own" ON deities
  FOR UPDATE USING (created_by = auth.uid());

-- Instructors can delete their own deities
CREATE POLICY IF NOT EXISTS "deities_delete_own" ON deities
  FOR DELETE USING (created_by = auth.uid());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deities') THEN
    RAISE EXCEPTION 'deities table was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mantras' AND column_name = 'deity_id') THEN
    RAISE EXCEPTION 'deity_id column was not added to mantras';
  END IF;

  RAISE NOTICE 'Migration 004 completed: deities table created, deity_id added to mantras';
END $$;
