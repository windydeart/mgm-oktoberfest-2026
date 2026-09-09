const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const name = (url.searchParams.get('name') || '').trim();

  if (!name || name.length < 2) {
    return res.status(200).json({ available: false, message: 'Name must be at least 2 characters.' });
  }

  try {
    const trimmed = name.trim();
    const encoded = encodeURIComponent(trimmed);
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    // Query both tables in parallel for sub-100ms response
    const [scoresRes, reviewsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?player_name=ilike.${encoded}&player_name=neq.__game_control__&select=id&limit=1`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=ilike.${encoded}&select=id&limit=1`, { headers })
    ]);

    let isTaken = false;
    if (scoresRes.ok) {
      const scores = await scoresRes.json();
      if (scores && scores.length > 0) isTaken = true;
    }
    if (!isTaken && reviewsRes.ok) {
      const reviews = await reviewsRes.json();
      if (reviews && reviews.length > 0) isTaken = true;
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      available: !isTaken,
      taken: isTaken,
      player_name: trimmed,
      message: isTaken ? 'This name is already registered.' : 'Name is available!'
    });

  } catch (err) {
    console.error('Check name error:', err);
    return res.status(200).json({ available: true, taken: false });
  }
};
