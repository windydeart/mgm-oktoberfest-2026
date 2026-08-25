-- ═══════════════════════════════════════════════════════
-- mgm Oktoberfest 2026 — Photo Bingo Database Schema
-- Run this in Supabase SQL Editor to create tables
-- ═══════════════════════════════════════════════════════

-- 1. Bingo Game Sessions
CREATE TABLE IF NOT EXISTS public.bingo_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('danang', 'hcmc')),
  challenges JSONB NOT NULL,
  server_seed TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  elapsed_ms INTEGER,
  completed_cells INTEGER[] DEFAULT '{}',
  bingo_line TEXT,
  status TEXT DEFAULT 'playing' CHECK (status IN ('playing', 'completed', 'abandoned', 'flagged')),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  photo_count INTEGER DEFAULT 0,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_bingo_leaderboard 
  ON bingo_sessions (location, status, elapsed_ms)
  WHERE status = 'completed' AND elapsed_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bingo_ip 
  ON bingo_sessions (ip_address, created_at);

-- 2. Bingo Photos (linked to sessions)
CREATE TABLE IF NOT EXISTS public.bingo_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES bingo_sessions(id) ON DELETE CASCADE,
  cell_index INTEGER NOT NULL CHECK (cell_index BETWEEN 0 AND 8),
  challenge_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  ai_verified BOOLEAN DEFAULT FALSE,
  ai_confidence FLOAT,
  ai_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, cell_index)
);

-- 3. Row Level Security
ALTER TABLE bingo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_photos ENABLE ROW LEVEL SECURITY;

-- Allow public insert (game creates sessions via API with anon key)
CREATE POLICY "Allow anon insert sessions" ON bingo_sessions
  FOR INSERT WITH CHECK (true);

-- Allow public read completed sessions (leaderboard)
CREATE POLICY "Public read completed sessions" ON bingo_sessions
  FOR SELECT USING (true);

-- Allow public update sessions (for cell completion)
CREATE POLICY "Allow anon update sessions" ON bingo_sessions
  FOR UPDATE USING (true);

-- Allow insert photos
CREATE POLICY "Allow anon insert photos" ON bingo_photos
  FOR INSERT WITH CHECK (true);

-- Allow read photos
CREATE POLICY "Allow read photos" ON bingo_photos
  FOR SELECT USING (true);

-- 4. Enable Realtime for live leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE bingo_sessions;

-- 5. Create Storage Bucket (run separately in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bingo-photos', 'bingo-photos', true);
-- CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bingo-photos');
-- CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'bingo-photos');
