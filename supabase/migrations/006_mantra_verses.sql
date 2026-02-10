-- Migration: Create Mantra Verses Table
-- Purpose: Break long mantras into verses for per-verse practice
-- Created: 2026-02-10

-- ============================================================================
-- MANTRA_VERSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mantra_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mantra_id UUID NOT NULL REFERENCES mantras(id) ON DELETE CASCADE,
  verse_number INT NOT NULL,
  title VARCHAR(255),
  text_devanagari TEXT NOT NULL,
  text_roman TEXT NOT NULL,
  audio_start_time DECIMAL(8,3),
  audio_end_time DECIMAL(8,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mantra_id, verse_number)
);

CREATE INDEX IF NOT EXISTS idx_mantra_verses_mantra_id ON mantra_verses(mantra_id);
CREATE INDEX IF NOT EXISTS idx_mantra_verses_order ON mantra_verses(mantra_id, verse_number);

-- ============================================================================
-- RLS POLICIES FOR MANTRA_VERSES
-- ============================================================================

ALTER TABLE mantra_verses ENABLE ROW LEVEL SECURITY;

-- Everyone can read verses (for published mantras, enforced at API level)
CREATE POLICY "mantra_verses_select_all" ON mantra_verses
  FOR SELECT USING (true);

-- Instructors can insert verses for their own mantras
CREATE POLICY "mantra_verses_insert_instructor" ON mantra_verses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM mantras m
      JOIN users u ON u.id = m.created_by
      WHERE m.id = mantra_id AND u.role = 'instructor'
    )
  );

-- Instructors can update verses for their own mantras
CREATE POLICY "mantra_verses_update_instructor" ON mantra_verses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM mantras m
      JOIN users u ON u.id = m.created_by
      WHERE m.id = mantra_id AND u.role = 'instructor'
    )
  );

-- Instructors can delete verses for their own mantras
CREATE POLICY "mantra_verses_delete_instructor" ON mantra_verses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM mantras m
      JOIN users u ON u.id = m.created_by
      WHERE m.id = mantra_id AND u.role = 'instructor'
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mantra_verses') THEN
    RAISE EXCEPTION 'mantra_verses table was not created';
  END IF;

  RAISE NOTICE 'Migration 006 completed: mantra_verses table created with RLS';
END $$;
