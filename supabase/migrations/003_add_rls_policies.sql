-- Migration: Add Row Level Security (RLS) Policies
-- Purpose: Enforce data access controls based on user roles and authentication
-- Created: 2026-01-30

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantras ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_audio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantra_processing_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Policy: Users can view their own profile only
-- Ensures users can only access their own data, not other users' profiles
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Users can update their own profile only
-- Allows users to modify their own data (e.g., name, preferences)
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: Service role has full access to users table
-- Required for signup, OAuth account creation, and admin operations
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
CREATE POLICY "Service role has full access to users"
ON users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- MANTRAS TABLE POLICIES
-- ============================================================================

-- Policy: Regular users can only see published mantras
-- Ensures draft mantras are hidden from non-instructors
DROP POLICY IF EXISTS "Users see published mantras only" ON mantras;
CREATE POLICY "Users see published mantras only"
ON mantras FOR SELECT
TO authenticated
USING (
  status = 'published'
  OR
  -- Allow instructors to see all mantras
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Policy: Instructors can see all mantras (including drafts)
-- This is a redundant policy for clarity, already covered above
-- Kept for explicit documentation of instructor permissions
DROP POLICY IF EXISTS "Instructors see all mantras" ON mantras;
CREATE POLICY "Instructors see all mantras"
ON mantras FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Policy: Instructors can insert new mantras
-- Required for the mantra upload workflow
DROP POLICY IF EXISTS "Instructors can insert mantras" ON mantras;
CREATE POLICY "Instructors can insert mantras"
ON mantras FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Policy: Instructors can update mantras
-- Allows instructors to edit text, publish drafts, update metadata
DROP POLICY IF EXISTS "Instructors can update mantras" ON mantras;
CREATE POLICY "Instructors can update mantras"
ON mantras FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Policy: Instructors can delete mantras
-- Allows instructors to remove mantras if needed
DROP POLICY IF EXISTS "Instructors can delete mantras" ON mantras;
CREATE POLICY "Instructors can delete mantras"
ON mantras FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Policy: Service role has full access to mantras table
-- Required for background processing and admin operations
DROP POLICY IF EXISTS "Service role has full access to mantras" ON mantras;
CREATE POLICY "Service role has full access to mantras"
ON mantras FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- REFERENCE_AUDIO_CLIPS TABLE POLICIES
-- ============================================================================

-- Policy: Clips inherit visibility from their parent mantra
-- Users can only see clips for published mantras
-- Instructors can see all clips
DROP POLICY IF EXISTS "Clips follow mantra visibility" ON reference_audio_clips;
CREATE POLICY "Clips follow mantra visibility"
ON reference_audio_clips FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mantras
    WHERE mantras.id = reference_audio_clips.mantra_id
    AND (
      mantras.status = 'published'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'instructor'
      )
    )
  )
);

-- Policy: Service role has full access to reference_audio_clips
-- Required for audio processing jobs that segment and store clips
DROP POLICY IF EXISTS "Service role has full access to clips" ON reference_audio_clips;
CREATE POLICY "Service role has full access to clips"
ON reference_audio_clips FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- MANTRA_PROCESSING_JOBS TABLE POLICIES
-- ============================================================================

-- Policy: Service role has full access to processing jobs
-- Background workers use service role to update job status
DROP POLICY IF EXISTS "Service role has full access to jobs" ON mantra_processing_jobs;
CREATE POLICY "Service role has full access to jobs"
ON mantra_processing_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Instructors can view their own processing jobs
-- Allows instructors to monitor upload progress and job status
DROP POLICY IF EXISTS "Instructors see their jobs" ON mantra_processing_jobs;
CREATE POLICY "Instructors see their jobs"
ON mantra_processing_jobs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mantras
    JOIN users ON mantras.created_by = users.id
    WHERE mantras.id = mantra_processing_jobs.mantra_id
    AND users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- ============================================================================
-- VERIFICATION BLOCK
-- ============================================================================

-- Verify that RLS is enabled on all tables and policies exist
DO $$
DECLARE
  rls_enabled_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Check RLS is enabled on all 4 tables
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('users', 'mantras', 'reference_audio_clips', 'mantra_processing_jobs')
  AND rowsecurity = true;

  IF rls_enabled_count != 4 THEN
    RAISE EXCEPTION 'RLS not enabled on all required tables. Expected 4, got %', rls_enabled_count;
  END IF;

  -- Check that policies exist (expect at least 12 policies total)
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('users', 'mantras', 'reference_audio_clips', 'mantra_processing_jobs');

  IF policy_count < 12 THEN
    RAISE EXCEPTION 'Insufficient policies created. Expected at least 12, got %', policy_count;
  END IF;

  RAISE NOTICE 'RLS migration completed successfully:';
  RAISE NOTICE '  - RLS enabled on % tables', rls_enabled_count;
  RAISE NOTICE '  - % policies created', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Security model summary:';
  RAISE NOTICE '  - Users: Can only view/update own profile';
  RAISE NOTICE '  - Mantras: Users see published only, instructors see all';
  RAISE NOTICE '  - Clips: Inherit mantra visibility rules';
  RAISE NOTICE '  - Jobs: Service role only, instructors can view their jobs';
END $$;

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration must be applied manually via:
-- 1. Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- 2. Or using Supabase CLI: supabase db push

-- To verify RLS is working after migration:
--
-- 1. Check RLS is enabled:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--    AND tablename IN ('users', 'mantras', 'reference_audio_clips', 'mantra_processing_jobs');
--
-- 2. List all policies:
--    SELECT tablename, policyname, cmd, roles
--    FROM pg_policies
--    WHERE tablename IN ('users', 'mantras', 'reference_audio_clips', 'mantra_processing_jobs')
--    ORDER BY tablename, policyname;
--
-- 3. Test as authenticated user:
--    SET ROLE authenticated;
--    SET request.jwt.claims.sub TO '<user-id>';
--    SELECT * FROM mantras; -- Should only see published
--    RESET ROLE;
