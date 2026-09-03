const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session_id');
  const playerName = url.searchParams.get('player_name');
  const location = url.searchParams.get('location') || 'danang';

  if (!sessionId && !playerName) {
    return res.status(400).json({ error: 'Missing session_id or player_name parameter.' });
  }

  try {
    const queryUrl = playerName
      ? `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(playerName)}&office=eq.${encodeURIComponent(location)}&select=id,cell_index,status,reviewer_note,reviewed_at,created_at&order=created_at.asc,id.asc`
      : `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?session_id=eq.${encodeURIComponent(sessionId)}&select=id,cell_index,status,reviewer_note,reviewed_at,created_at&order=created_at.asc,id.asc`;

    const sbRes = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      const errText = await sbRes.text();
      // If table doesn't exist yet, return empty array
      if (errText.includes('does not exist') || errText.includes('PGRST205')) {
        return res.status(200).json({ success: true, decisions: [] });
      }
      console.error('Check reviews error:', errText);
      return res.status(500).json({ error: 'Failed to check review status.' });
    }

    const allRevs = await sbRes.json();

    // Map each cell_index to its latest submission
    const latestByCell = {};
    for (const r of allRevs) {
      latestByCell[Number(r.cell_index)] = r;
    }

    // Only return decisions for cells where the LATEST submission has been resolved (status !== 'pending')
    // If a cell currently has a newer 'pending' photo, any older rejection is obsolete and must not be returned
    const decisions = [];
    for (const [cellIdxStr, r] of Object.entries(latestByCell)) {
      if (r.status !== 'pending') {
        decisions.push({
          id: r.id,
          cell_index: Number(r.cell_index),
          status: r.status,
          reviewer_note: r.reviewer_note,
          reviewed_at: r.reviewed_at
        });
      }
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      decisions
    });
  } catch (err) {
    console.error('Check reviews error:', err);
    return res.status(500).json({ error: 'Failed to check review status.' });
  }
};
