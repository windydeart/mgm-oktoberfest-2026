const { verifyAdminToken } = require('./auth');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from('c2Jfc2VjcmV0Xzd3NkZHN2xGTm5tQW5IZVQyTkRKX1FfMm9uTG1iamo=', 'base64').toString('utf-8');

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const ACTION_TO_STATE = {
  'start': 'active',
  'pause': 'paused',
  'finish': 'finished',
  'waiting': 'waiting'
};

const STATE_MESSAGES = {
  'active': 'Game started — all players can now play!',
  'paused': 'Game paused — all player screens are frozen.',
  'finished': 'Game finished — all player screens show end message.',
  'waiting': 'Game set to waiting — players cannot start until you press Start.'
};

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = verifyAdminToken(token);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { action } = body || {};
  const newState = ACTION_TO_STATE[action];

  if (!newState) {
    return res.status(400).json({
      error: `Invalid action "${action}". Must be one of: start, pause, finish, waiting.`
    });
  }

  try {
    // 1. Delete existing game control record
    await fetch(
      `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SECRET_KEY,
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    // 2. Insert new game control record
    const controlData = {
      state: newState,
      updated_at: new Date().toISOString(),
      updated_by: 'admin'
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        player_name: '__game_control__',
        game_name: 'game_control',
        office: 'system',
        score: 0,
        duration_seconds: 0,
        player_email: JSON.stringify(controlData)
      })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Failed to set game control state:', errText);
      return res.status(500).json({ error: 'Failed to update game control state.' });
    }

    console.log(`[Game Control] State changed to "${newState}" by admin at ${controlData.updated_at}`);

    return res.status(200).json({
      success: true,
      state: newState,
      message: STATE_MESSAGES[newState],
      updated_at: controlData.updated_at
    });
  } catch (err) {
    console.error('Game control error:', err);
    return res.status(500).json({ error: 'Failed to process game control action.' });
  }
};
