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

function createToken(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_token, cell_index, photo_base64 } = req.body || {};

  const session = verifyToken(session_token);
  if (!session) {
    return res.status(400).json({ error: 'Session expired or invalid. Please refresh and play again.' });
  }

  if (typeof cell_index !== 'number' || cell_index < 0 || cell_index > 8 || !photo_base64) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  let completedCells = session.completed_cells || [];
  if (completedCells.includes(cell_index)) {
    return res.status(400).json({ error: 'This cell is already completed!' });
  }

  const challenge = session.challenges?.[cell_index];
  if (!challenge) {
    return res.status(400).json({ error: 'Challenge not found.' });
  }

  // AI Verification via Gemini Vision
  const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
  let ai_verified = true;
  let ai_reason = 'Approved';

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `You are a friendly photo challenge judge for a fun Oktoberfest party game. The player needs to take a photo matching this challenge: "${challenge.challenge}". Look at the photo and determine if it reasonably matches the challenge. Be lenient and festive. Only reject if the photo is clearly unrelated (e.g. pitch black, completely empty wall, screenshot). Reply with ONLY JSON: {"approved": true/false, "reason": "brief reason"}` }]
          },
          contents: [{
            role: 'user',
            parts: [{
              inline_data: { mime_type: 'image/jpeg', data: base64Data }
            }]
          }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const result = JSON.parse(text);
          ai_verified = result.approved === true;
          ai_reason = result.reason || '';
        }
      }
    }
  } catch (err) {
    console.error('Gemini verification error, failing open:', err.message);
    ai_verified = true;
    ai_reason = 'Auto-approved';
  }

  if (!ai_verified) {
    return res.status(200).json({ verified: false, reason: ai_reason || "Photo doesn't match the challenge. Please try again!" });
  }

  // Update completed cells
  completedCells.push(cell_index);
  session.completed_cells = completedCells;

  const bingoLine = checkBingo(completedCells);
  const is_bingo = bingoLine !== null;
  let elapsed_ms = null;
  let rank = 1;

  if (is_bingo) {
    elapsed_ms = Date.now() - session.started_at;
    const duration_seconds = Math.max(1, Math.round(elapsed_ms / 10) / 100);

    session.status = 'completed';
    session.elapsed_ms = elapsed_ms;
    session.bingo_line = bingoLine;

    // Record score to Supabase
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          player_name: session.player_name,
          office: session.location,
          game_name: 'photo_bingo',
          score: 1,
          duration_seconds: duration_seconds
        })
      });

      // Calculate rank
      const rankRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&office=eq.${session.location}&duration_seconds=lte.${duration_seconds}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (rankRes.ok) {
        const ranks = await rankRes.json();
        rank = ranks.length || 1;
      }
      session.rank = rank;
    } catch (dbErr) {
      console.error('Database score record error:', dbErr);
    }
  }

  const updatedToken = createToken(session);

  return res.status(200).json({
    verified: true,
    cell_index,
    session_token: updatedToken,
    is_bingo,
    ...(is_bingo && { bingo_line: bingoLine, elapsed_ms, rank })
  });
};
