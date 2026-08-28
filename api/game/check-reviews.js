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

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id parameter.' });
  }

  try {
    // Query all non-pending reviews for this session
    const queryUrl = `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?session_id=eq.${encodeURIComponent(sessionId)}&status=neq.pending&select=id,cell_index,status,reviewer_note,reviewed_at`;

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

    const decisions = await sbRes.json();

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
