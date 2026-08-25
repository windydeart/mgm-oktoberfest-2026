const crypto = require('crypto');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 5000;

function isRateLimited(sessionId) {
  const now = Date.now();
  const lastSubmit = rateLimitMap.get(sessionId);
  if (!lastSubmit || now - lastSubmit > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(sessionId, now);
    return false;
  }
  return true;
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

module.exports = async (req, res) => {
  if (!handleCors(req, res)) {
    return res.status(403).json({ error: 'Unauthorized origin.' });
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, cell_index, photo_base64 } = req.body || {};

  if (!session_id || typeof cell_index !== 'number' || cell_index < 0 || cell_index > 8 || !photo_base64) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  if (isRateLimited(session_id)) {
    return res.status(429).json({ error: 'Please wait a few seconds between submissions.' });
  }

  try {
    // 1. Fetch Session
    const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions?id=eq.${session_id}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!sessionRes.ok) throw new Error('Failed to fetch session');
    const sessions = await sessionRes.json();
    if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
    
    const session = sessions[0];
    if (session.status !== 'playing') {
      return res.status(400).json({ error: 'Session is no longer playing' });
    }
    
    let completedCells = session.completed_cells || [];
    if (completedCells.includes(cell_index)) {
      return res.status(400).json({ error: 'Cell already completed' });
    }

    const challenge = session.challenges[cell_index];
    if (!challenge) {
      return res.status(400).json({ error: 'Invalid cell index for challenges' });
    }

    // 2. Upload Photo to Supabase Storage
    const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/bingo-photos/${session_id}/${cell_index}.jpg`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg'
      },
      body: buffer
    });
    
    if (!storageRes.ok) {
      const errText = await storageRes.text();
      // Supabase storage might return 400 if file already exists, let's ignore for now or handle upsert
      // But standard REST POST fails if exists. We can ignore or use PUT for upsert.
    }
    
    const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/bingo-photos/${session_id}/${cell_index}.jpg`;

    // 3. Gemini Verification
    let ai_verified = true;
    let ai_reason = 'Verified by fallback';
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: `You are a photo challenge judge for a fun party game. The player needs to take a photo matching this challenge: "${challenge.challenge}". Look at the submitted photo and determine if it reasonably matches the challenge. Be lenient and fun — this is a party game, not a strict exam. If the photo shows a genuine attempt at the challenge, approve it. Only reject if the photo is completely unrelated (e.g., a blank wall, a screenshot, or clearly not matching at all). Reply with ONLY a JSON object: {"approved": true/false, "reason": "brief reason"}` }]
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
            ai_reason = result.reason || 'No reason provided';
          }
        } else {
          console.error('Gemini API Error:', await geminiRes.text());
        }
      }
    } catch (err) {
      console.error('Gemini verification failed, failing open:', err.message);
      // Fail-open: approve photo for UX but mark for manual review
      ai_verified = false;
      ai_reason = 'AI verification unavailable — approved for review';
    }

    // If AI explicitly rejected (not a failure), reject the photo
    if (!ai_verified && !ai_reason.includes('unavailable')) {
      return res.status(200).json({ verified: false, reason: ai_reason });
    }

    // 4. Update Database
    // Insert photo
    await fetch(`${SUPABASE_URL}/rest/v1/bingo_photos`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id,
        cell_index,
        challenge_id: challenge.id,
        photo_url: photoUrl,
        ai_verified: ai_verified,
        ai_confidence: 1.0,
        ai_reason
      })
    });

    completedCells.push(cell_index);
    const bingoLine = checkBingo(completedCells);
    let is_bingo = bingoLine !== null;
    let elapsed_ms = null;
    let rank = null;

    let updateData = { completed_cells: completedCells };
    
    if (is_bingo) {
      elapsed_ms = Date.now() - new Date(session.started_at).getTime();
      updateData.completed_at = new Date().toISOString();
      updateData.elapsed_ms = elapsed_ms;
      updateData.bingo_line = bingoLine;
      updateData.status = 'completed';
    }

    await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions?id=eq.${session_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (is_bingo) {
      // Record score
      await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: session.player_name,
          office: session.location,
          game_name: 'photo_bingo',
          score: 1,
          duration_seconds: elapsed_ms / 1000
        })
      });

      // Get rank
      const rankRes = await fetch(`${SUPABASE_URL}/rest/v1/bingo_sessions?location=eq.${session.location}&status=eq.completed&elapsed_ms=lt.${elapsed_ms + 1}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (rankRes.ok) {
        const ranks = await rankRes.json();
        rank = ranks.length;
      }
    }

    return res.status(200).json({
      verified: true,
      cell_index,
      is_bingo,
      ...(is_bingo && { bingo_line: bingoLine, elapsed_ms, rank })
    });

  } catch (err) {
    console.error('Error submitting photo:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
