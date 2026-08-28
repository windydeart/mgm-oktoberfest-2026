const { verifyAdminToken } = require('./auth');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = verifyAdminToken(token);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const status = url.searchParams.get('status') || 'pending';
  const location = url.searchParams.get('location') || 'all';

  try {
    let queryUrl = `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?select=id,session_id,player_name,office,cell_index,challenge_text,photo_url,ai_reason,status,reviewer_note,reviewed_at,created_at&order=created_at.asc`;

    if (status !== 'all') {
      queryUrl += `&status=eq.${status}`;
    }
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
      const errText = await sbRes.text();
      if (errText.includes('does not exist') || errText.includes('PGRST205')) {
        return res.status(200).json({ success: true, reviews: [], total: 0 });
      }
      console.error('Supabase reviews query error:', errText);
      return res.status(500).json({ error: 'Failed to load reviews.' });
    }

    const reviews = await sbRes.json();

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      reviews,
      total: reviews.length
    });
  } catch (err) {
    console.error('Reviews error:', err);
    return res.status(500).json({ error: 'Failed to load reviews.' });
  }
};
