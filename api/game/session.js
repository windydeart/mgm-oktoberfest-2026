const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'mgm-oktoberfest-2026-bingo-secret-key-salt';
const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const jsonStr = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function checkBingo(cells) {
  const lines = [
    { indices: [0, 1, 2], name: 'row-0' },
    { indices: [3, 4, 5], name: 'row-1' },
    { indices: [6, 7, 8], name: 'row-2' },
    { indices: [0, 3, 6], name: 'col-0' },
    { indices: [1, 4, 7], name: 'col-1' },
    { indices: [2, 5, 8], name: 'col-2' },
    { indices: [0, 4, 8], name: 'diag-main' },
    { indices: [2, 4, 6], name: 'diag-anti' }
  ];
  for (const line of lines) {
    if (line.indices.every(i => cells.includes(i))) {
      return line.name;
    }
  }
  return null;
}

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
  const token = url.searchParams.get('token');

  const session = verifyToken(token);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const completedCells = session.completed_cells || [];
  const calculatedBingoLine = checkBingo(completedCells);
  const isCompleted = session.status === 'completed' || calculatedBingoLine !== null;

  let elapsed_ms = session.elapsed_ms || null;
  let rank = session.rank || null;

  if (isCompleted) {
    try {
      const scoreRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(session.player_name)}&office=eq.${session.location}&order=created_at.desc&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (scoreRes.ok) {
        const scores = await scoreRes.json();
        if (scores && scores.length > 0 && scores[0].duration_seconds) {
          elapsed_ms = Math.round(scores[0].duration_seconds * 1000);
        }
      }
    } catch (e) {
      console.error('Score lookup note:', e.message);
    }
  }

  const pendingReviewCells = session.pending_review_cells || [];
  const cellPhotoUrls = session.cell_photo_urls || {};
  const cellAiReasons = session.cell_ai_reasons || {};

  return res.status(200).json({
    success: true,
    session_id: session.session_id,
    player_name: session.player_name,
    location: session.location,
    challenges: session.challenges,
    started_at: session.started_at,
    completed_cells: completedCells,
    pending_review_cells: pendingReviewCells,
    cell_photo_urls: cellPhotoUrls,
    cell_ai_reasons: cellAiReasons,
    status: isCompleted ? 'completed' : 'playing',
    elapsed_ms: elapsed_ms,
    bingo_line: session.bingo_line || calculatedBingoLine,
    rank: rank || 1
  });
};
