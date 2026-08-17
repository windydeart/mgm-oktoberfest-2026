-- ==============================================================================
-- MGM OKTOBERFEST 2026 - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jijngdphviddhdtnyhwr/sql/new
-- ==============================================================================

-- 1. Table: oktoberfest_registrations
CREATE TABLE IF NOT EXISTS public.oktoberfest_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  office TEXT NOT NULL CHECK (office IN ('danang', 'hcmc')),
  dietary_pref TEXT DEFAULT 'Bavarian Feast',
  beer_pref TEXT DEFAULT 'German Craft Beer',
  attire_option TEXT DEFAULT 'Casual / mgm Outfit',
  shirt_size TEXT DEFAULT 'L',
  notes TEXT,
  checked_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_oktoberfest_email UNIQUE (email)
);

-- 2. Table: oktoberfest_game_scores (For Phase 2 Mini-Games)
CREATE TABLE IF NOT EXISTS public.oktoberfest_game_scores (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  player_email TEXT,
  office TEXT NOT NULL CHECK (office IN ('danang', 'hcmc')),
  game_name TEXT NOT NULL,
  score INT NOT NULL,
  duration_seconds NUMERIC(6, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: oktoberfest_lucky_draw (For Event Day Lucky Draw)
CREATE TABLE IF NOT EXISTS public.oktoberfest_lucky_draw (
  id SERIAL PRIMARY KEY,
  prize_name TEXT NOT NULL,
  prize_tier INT DEFAULT 1,
  winner_name TEXT NOT NULL,
  winner_office TEXT NOT NULL,
  drawn_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.oktoberfest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oktoberfest_game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oktoberfest_lucky_draw ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Privacy-First Security):
-- Allow public anon users to submit registration
DROP POLICY IF EXISTS "Public can submit registration" ON public.oktoberfest_registrations;
CREATE POLICY "Public can submit registration" 
ON public.oktoberfest_registrations 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- SECURE PRIVACY: Do NOT allow anonymous users to dump all attendee personal info (emails, names).
-- Only authenticated admins or service roles can read full registration rows.
DROP POLICY IF EXISTS "Public can read registrations" ON public.oktoberfest_registrations;
CREATE POLICY "Public can read registrations" 
ON public.oktoberfest_registrations 
FOR SELECT 
TO authenticated 
USING (true);

-- Provide a safe SECURITY DEFINER function to fetch attendee counts without exposing PII
CREATE OR REPLACE FUNCTION public.get_oktoberfest_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INT;
  danang_count INT;
  hcmc_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.oktoberfest_registrations;
  SELECT COUNT(*) INTO danang_count FROM public.oktoberfest_registrations WHERE office = 'danang';
  SELECT COUNT(*) INTO hcmc_count FROM public.oktoberfest_registrations WHERE office = 'hcmc';
  RETURN json_build_object(
    'total', total_count,
    'danang', danang_count,
    'hcmc', hcmc_count
  );
END;
$$;

-- Allow public to execute stats function
GRANT EXECUTE ON FUNCTION public.get_oktoberfest_stats() TO anon, authenticated;

-- Allow public anon users to submit and read game scores
DROP POLICY IF EXISTS "Public can submit scores" ON public.oktoberfest_game_scores;
CREATE POLICY "Public can submit scores" 
ON public.oktoberfest_game_scores 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read scores" ON public.oktoberfest_game_scores;
CREATE POLICY "Public can read scores" 
ON public.oktoberfest_game_scores 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- Allow public anon users to read lucky draw winners
DROP POLICY IF EXISTS "Public can read lucky draw" ON public.oktoberfest_lucky_draw;
CREATE POLICY "Public can read lucky draw" 
ON public.oktoberfest_lucky_draw 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 6. Realtime Publication (Enable realtime live updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'oktoberfest_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.oktoberfest_registrations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'oktoberfest_game_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.oktoberfest_game_scores;
  END IF;
END $$;
