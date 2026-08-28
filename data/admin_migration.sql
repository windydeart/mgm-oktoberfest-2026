-- ═══════════════════════════════════════════════════════
-- BINGO PHOTO REVIEWS TABLE
-- Tracks individual photo submissions that need organizer review
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bingo_photo_reviews (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  office TEXT NOT NULL CHECK (office IN ('danang', 'hcmc')),
  cell_index INT NOT NULL CHECK (cell_index >= 0 AND cell_index <= 8),
  challenge_text TEXT NOT NULL,
  photo_url TEXT,
  ai_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bingo_photo_reviews ENABLE ROW LEVEL SECURITY;

-- Anon users can submit reviews (from submit-photo API)
DROP POLICY IF EXISTS "Anon can submit reviews" ON public.bingo_photo_reviews;
CREATE POLICY "Anon can submit reviews"
  ON public.bingo_photo_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anon users can read reviews (for client polling)
DROP POLICY IF EXISTS "Anon can read reviews" ON public.bingo_photo_reviews;
CREATE POLICY "Anon can read reviews"
  ON public.bingo_photo_reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow updates (for admin approve/reject)
DROP POLICY IF EXISTS "Allow update reviews" ON public.bingo_photo_reviews;
CREATE POLICY "Allow update reviews"
  ON public.bingo_photo_reviews FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_photo_reviews_status ON public.bingo_photo_reviews (status);
CREATE INDEX IF NOT EXISTS idx_photo_reviews_session ON public.bingo_photo_reviews (session_id);
