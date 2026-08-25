const { readFileSync } = require('fs');
const { join } = require('path');
const crypto = require('crypto');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

module.exports = async (req, res) => {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Unauthorized origin.' });
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: 'Too many sessions started. Try again later.' });
  }

  const { player_name, location } = req.body || {};
  if (!player_name || typeof player_name !== 'string' || player_name.trim().length < 2 || player_name.trim().length > 30) {
    return res.status(400).json({ error: 'Invalid player_name (must be 2-30 characters)' });
  }
  if (location !== 'danang' && location !== 'hcmc') {
    return res.status(400).json({ error: 'Invalid location (must be danang or hcmc)' });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions?ip_address=eq.${clientIP}&status=eq.playing&created_at=gt.${oneHourAgo}&select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing && existing.length > 0) {
        return res.status(429).json({ error: 'You already have an active session.' });
      }
    }
  } catch (err) {
    console.error('Error checking existing sessions:', err);
  }

  let allChallenges = [];
  try {
    const filePath = join(process.cwd(), 'data', 'bingo_challenges.json');
    allChallenges = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('Failed to load challenges:', err);
    return res.status(500).json({ error: 'Failed to load challenges' });
  }

  const categoryCount = {};
  const selected = [];
  const shuffled = allChallenges.sort(() => 0.5 - Math.random());
  
  for (const challenge of shuffled) {
    const cat = challenge.category || 'unknown';
    if ((categoryCount[cat] || 0) < 2) {
      selected.push(challenge);
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
    if (selected.length === 9) break;
  }
  
  if (selected.length < 9) {
    for (const challenge of shuffled) {
      if (!selected.find(s => s.id === challenge.id)) {
        selected.push(challenge);
      }
      if (selected.length === 9) break;
    }
  }

  const server_seed = crypto.randomBytes(16).toString('hex');
  const started_at = new Date().toISOString();

  const insertData = {
    player_name: player_name.trim(),
    location,
    challenges: selected,
    server_seed,
    started_at,
    status: 'playing',
    ip_address: clientIP,
    user_agent: req.headers['user-agent'] || '',
    completed_cells: []
  };

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertData)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(`Supabase insert failed: ${errText}`);
    }
    
    const inserted = await insertRes.json();
    const session = inserted[0];

    return res.status(200).json({
      success: true,
      session_id: session.id || session.session_id,
      challenges: session.challenges,
      started_at: session.started_at
    });
  } catch (err) {
    console.error('Error starting session:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
