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

  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control&select=player_email&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!sbRes.ok) {
      // If Supabase is down or table inaccessible, default to active (backward compatible)
      return res.status(200).json({ state: 'active', updated_at: null });
    }

    const rows = await sbRes.json();
    if (!rows || rows.length === 0) {
      // No game control record exists — default to active (backward compatible)
      return res.status(200).json({ state: 'active', updated_at: null });
    }

    let controlData = {};
    try {
      controlData = JSON.parse(rows[0].player_email || '{}');
    } catch (e) {
      controlData = {};
    }

    const validStates = ['active', 'waiting', 'paused', 'finished'];
    const state = validStates.includes(controlData.state) ? controlData.state : 'active';

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      state,
      updated_at: controlData.updated_at || null
    });
  } catch (err) {
    console.error('Game state fetch error:', err);
    // On any error, default to active so game is never accidentally blocked
    return res.status(200).json({ state: 'active', updated_at: null });
  }
};
