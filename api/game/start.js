const { readFileSync } = require('fs');
const { join } = require('path');
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'mgm-oktoberfest-2026-bingo-secret-key-salt';

function createToken(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 20;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
  }

  const { player_name, location } = req.body || {};
  if (!player_name || typeof player_name !== 'string' || player_name.trim().length < 2 || player_name.trim().length > 30) {
    return res.status(400).json({ error: 'Player name must be between 2 and 30 characters.' });
  }
  if (location !== 'danang' && location !== 'hcmc') {
    return res.status(400).json({ error: 'Please select either Da Nang or HCMC.' });
  }

  let allChallenges = [];
  try {
    const filePath = join(process.cwd(), 'data', 'bingo_challenges.json');
    allChallenges = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('Failed to load challenges:', err);
    return res.status(500).json({ error: 'Failed to load challenge library.' });
  }

  // Balanced random selection (max 2 per category)
  const categoryCount = {};
  const selected = [];
  const shuffled = [...allChallenges].sort(() => 0.5 - Math.random());
  
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

  const session_id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const started_at = Date.now();

  const sessionData = {
    session_id,
    player_name: player_name.trim(),
    location,
    challenges: selected,
    started_at,
    completed_cells: []
  };

  const session_token = createToken(sessionData);

  return res.status(200).json({
    success: true,
    session_id,
    session_token,
    challenges: selected,
    started_at
  });
};
