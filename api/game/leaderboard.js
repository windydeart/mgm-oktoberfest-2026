const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCors(req, res) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  if (origin) {
    const isAllowedOrigin = 
      origin.includes('vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('mgm-tp.com') ||
      origin.includes('mgmvn.events');
    if (!isAllowedOrigin) {
      return false;
    }
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

module.exports = async (req, res) => {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Unauthorized origin.' });
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const location = url.searchParams.get('location') || 'all';

  try {
    let queryUrl = `${SUPABASE_URL}/rest/v1/bingo_sessions?status=eq.completed&elapsed_ms=not.is.null&order=elapsed_ms.asc&limit=50&select=player_name,location,elapsed_ms,completed_at,bingo_line`;
    if (location !== 'all') {
      queryUrl += `&location=eq.${location}`;
    }

    const sbRes = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) throw new Error('Failed to fetch leaderboard');
    const records = await sbRes.json();

    const leaderboard = records.map((record, index) => ({
      rank: index + 1,
      player_name: record.player_name,
      location: record.location,
      elapsed_ms: record.elapsed_ms,
      completed_at: record.completed_at,
      bingo_line: record.bingo_line
    }));

    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10');
    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
