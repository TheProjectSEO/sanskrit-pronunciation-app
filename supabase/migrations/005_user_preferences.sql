-- Migration: Create User Preferences Table
-- Purpose: Store user preferences like feedback language
-- Created: 2026-02-10

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  feedback_language VARCHAR(20) DEFAULT 'hindi' CHECK (feedback_language IN ('hindi', 'english', 'kannada', 'tamil', 'telugu')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
