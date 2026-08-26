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
    const queryUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=ilike.${encodeURIComponent(name)}&select=id,player_name&limit=1`;
    
    const sbRes = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      return res.status(200).json({ available: true, taken: false });
    }

    const records = await sbRes.json();
    const isTaken = records && records.length > 0;

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      available: !isTaken,
      taken: isTaken,
      player_name: name,
      message: isTaken ? 'This name is already registered.' : 'Name is available!'
    });

  } catch (err) {
    console.error('Check name error:', err);
    return res.status(200).json({ available: true, taken: false });
  }
};
