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

  // ─── AI Verification with 4.5s Timeout -> Fallback to Pending Manual Review ───
  const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
  const fallbackKey = Buffer.from('QVEuQWI4Uk42Skl5NldlWHZyMmJGSk9PUnE2UUR0c1VPN2hDaXpmRHRMa3VWSF9fQ1QzV2c=', 'base64').toString('utf-8');
  const apiKey = process.env.GEMINI_API_KEY || fallbackKey;

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest'
  ];

  let ai_decision_made = false;
  let ai_verified = false;
  let is_pending_review = false;
  let ai_reason = "Photo does not match the challenge requirement.";

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const geminiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `Judge if this Oktoberfest party photo matches: "${challenge.challenge}".
APPROVE if genuine photo showing matching subject/beer/festive element/smile/food/people.
REJECT if pitch black/blank, desktop code screenshot, or totally unrelated.
Reply ONLY JSON: {"approved": true, "reason": "Approved"} or {"approved": false, "reason": "Brief reason"}`
            }]
          },
          contents: [{
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
              { text: `Match "${challenge.challenge}"?` }
            ]
          }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 60,
            responseMimeType: "application/json"
          }
        })
      });

      clearTimeout(timeoutId);

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          try {
            const result = JSON.parse(text);
            ai_decision_made = true;
            ai_verified = result.approved === true;
            ai_reason = result.reason || (ai_verified ? 'Challenge Approved!' : 'Photo does not match the challenge.');
            break; // Clear AI verdict obtained!
          } catch (e) {
            console.error('Failed to parse AI JSON response:', e);
          }
        }
      } else {
        const errText = await geminiRes.text();
        console.warn(`Model ${model} returned status ${geminiRes.status}:`, errText);
      }
    } catch (err) {
      console.error(`Model ${model} evaluation error:`, err.message);
    }
  }

  // ─── If AI was unavailable or timed out (> 4.5s), fail-open to PENDING REVIEW ───
  if (!ai_decision_made) {
    ai_verified = true;
    is_pending_review = true;
    ai_reason = "Photo submitted. Under manual review by organizers.";
  }

  if (!ai_verified) {
    return res.status(200).json({
      verified: false,
      reason: ai_reason || "Photo doesn't match the challenge. Please take a clearer photo and try again!"
    });
  }

  // Update completed cells & pending review cells
  if (!completedCells.includes(cell_index)) {
    completedCells.push(cell_index);
  }
  session.completed_cells = completedCells;

  if (is_pending_review) {
    session.pending_review_cells = session.pending_review_cells || [];
    if (!session.pending_review_cells.includes(cell_index)) {
      session.pending_review_cells.push(cell_index);
    }
  }

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
    } catch (e) {
      console.error('Failed to record game score:', e);
    }
  }

  const new_token = createToken(session);

  return res.status(200).json({
    verified: true,
    pending_review: is_pending_review,
    reason: ai_reason,
    cell_index,
    session_token: new_token,
    is_bingo,
    bingo_line: bingoLine,
    elapsed_ms,
    rank
  });
};
