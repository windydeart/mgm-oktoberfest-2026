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
  const id = url.searchParams.get('id');

  if (!id) {
    return res.status(400).json({ error: 'Missing session id' });
  }

  try {
    const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions?id=eq.${id}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sessionRes.ok) throw new Error('Failed to fetch session');
    const sessions = await sessionRes.json();
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[0];

    const photosRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_photos?session_id=eq.${id}&select=cell_index,photo_url,ai_verified`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    let photos = [];
    if (photosRes.ok) {
      photos = await photosRes.json();
    }

    const sessionData = {
      session_id: session.id,
      player_name: session.player_name,
      location: session.location,
      challenges: session.challenges,
      started_at: session.started_at,
      completed_at: session.completed_at,
      elapsed_ms: session.elapsed_ms,
      completed_cells: session.completed_cells || [],
      bingo_line: session.bingo_line,
      status: session.status,
      photos: photos
    };

    return res.status(200).json(sessionData);

  } catch (err) {
    console.error('Session API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
