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
  const location = url.searchParams.get('location') || 'all';

  try {
    let queryUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&order=duration_seconds.asc&limit=1&select=id,player_name,office,duration_seconds,created_at,player_email`;
    if (location === 'danang' || location === 'hcmc') {
      queryUrl += `&office=eq.${location}`;
    }

    const sbRes = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      return res.status(404).json({ error: 'No winner found yet.' });
    }

    const records = await sbRes.json();
    if (!records || records.length === 0) {
      return res.status(200).json({ success: false, message: 'No champions yet. Be the first to win!' });
    }

    const topScore = records[0];
    let snapshotData = {};

    if (topScore.player_email && typeof topScore.player_email === 'string' && topScore.player_email.trim().startsWith('{')) {
      try {
        snapshotData = JSON.parse(topScore.player_email);
      } catch (e) {
        console.warn('Failed to parse winner snapshot JSON:', e);
      }
    }

    const winner = {
      player_name: topScore.player_name,
      location: topScore.office,
      duration_seconds: topScore.duration_seconds,
      elapsed_ms: Math.round((topScore.duration_seconds || 0) * 1000),
      completed_at: topScore.created_at,
      bingo_line: snapshotData.bingo_line || 'row-0',
      completed_cells: snapshotData.completed_cells || [0, 1, 2],
      challenges: snapshotData.challenges || [],
      cell_photos: snapshotData.cell_photos || {},
      cell_ai_reasons: snapshotData.cell_ai_reasons || {}
    };

    res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5');
    return res.status(200).json({ success: true, winner });

  } catch (err) {
    console.error('Winner API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
