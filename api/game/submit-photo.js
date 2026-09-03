const crypto = require('crypto');
const challengesPool = require('../../data/bingo_challenges.json');
const { callVertexGemini } = require('../_vertex');

const SECRET = process.env.SESSION_SECRET || 'mgm-oktoberfest-2026-bingo-secret-key-salt';
const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from('c2Jfc2VjcmV0Xzd3NkZHN2xGTm5tQW5IZVQyTkRKX1FfMm9uTG1iamo=', 'base64').toString('utf-8');
const STORAGE_BUCKET = 'game-photos';

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

function getDefaultChallenges() {
  const pool = Array.isArray(challengesPool)
    ? challengesPool
    : (challengesPool && challengesPool.challenges ? challengesPool.challenges : []);
  if (pool.length >= 9) {
    const specificIds = [39, 36, 9, 24, 10, 33, 7, 15, 31];
    const picked = specificIds.map(id => pool.find(c => c.id === id)).filter(Boolean);
    if (picked.length === 9) return picked;
    return pool.slice(0, 9);
  }
  return Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    category: 'Funny',
    icon: '😂',
    challenge: `Challenge #${i + 1}`
  }));
}

function sanitizeAiReason(reason) {
  if (!reason || typeof reason !== 'string') return reason;
  return reason
    .replace(/\s*(?:please\s+)?(?:try\s+again|retake(?:\s+the\s+photo)?|re-take|resubmit)[^.!?]*(?:[.!?]|$)/gi, '')
    .trim();
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {}
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

async function uploadPhotoToStorage(base64Data, sessionId, cellIndex) {
  const storageKey = SUPABASE_SECRET_KEY || SUPABASE_KEY;
  const fileName = `${sessionId}/cell_${cellIndex}_${Date.now()}.jpg`;
  const binaryData = Buffer.from(base64Data, 'base64');

  try {
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'apikey': storageKey,
          'Authorization': `Bearer ${storageKey}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true'
        },
        body: binaryData
      }
    );

    if (uploadRes.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
      return publicUrl;
    } else {
      const errText = await uploadRes.text();
      console.error('Storage upload failed:', uploadRes.status, errText);
      return null;
    }
  } catch (err) {
    console.error('Storage upload error:', err.message);
    return null;
  }
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    session_token,
    cell_index,
    photo_base64,
    elapsed_ms: client_elapsed_ms,
    player_name,
    location
  } = req.body || {};

  let session = verifyToken(session_token);

  // Fallback recovery if token expired/missing but player_name provided
  if (!session && player_name) {
    session = {
      session_id: `session-${player_name}-${location || 'danang'}`,
      player_name: player_name,
      location: location || 'danang',
      challenges: getDefaultChallenges(),
      completed_cells: [],
      pending_review_cells: [],
      cell_photo_urls: {},
      cell_ai_reasons: {},
      started_at: new Date().toISOString(),
      status: 'playing'
    };
  }

  if (!session) {
    return res.status(400).json({ error: 'Session expired or invalid. Please refresh and play again.' });
  }

  if (typeof cell_index !== 'number' || cell_index < 0 || cell_index > 8 || !photo_base64) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  if (!session.challenges || !Array.isArray(session.challenges) || session.challenges.length !== 9) {
    session.challenges = getDefaultChallenges();
  }

  let completedCells = [...(session.completed_cells || [])];
  let pendingReviewCells = [...(session.pending_review_cells || [])];
  let cellPhotoUrls = { ...(session.cell_photo_urls || {}) };
  let cellAiReasons = { ...(session.cell_ai_reasons || {}) };
  let allReviews = [];

  // 1. Sync latest reviews from database to accurately reflect approved/rejected/pending cells
  try {
    const revUrl = session.player_name
      ? `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(session.player_name)}&office=eq.${encodeURIComponent(session.location)}&order=created_at.asc&select=cell_index,status,reviewer_note,reviewed_at,photo_url,ai_reason,challenge_text,created_at`
      : `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?session_id=eq.${encodeURIComponent(session.session_id)}&order=created_at.asc&select=cell_index,status,reviewer_note,reviewed_at,photo_url,ai_reason,challenge_text,created_at`;

    const revRes = await fetch(revUrl, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (revRes.ok) {
      allReviews = await revRes.json();
      const latestMap = {};
      for (const r of allReviews) {
        latestMap[r.cell_index] = r;
      }
      for (const [cIdxStr, r] of Object.entries(latestMap)) {
        const cIdx = parseInt(cIdxStr, 10);
        if (r.status === 'rejected') {
          completedCells = completedCells.filter(c => c !== cIdx);
          pendingReviewCells = pendingReviewCells.filter(c => c !== cIdx);
          delete cellPhotoUrls[String(cIdx)];
          delete cellPhotoUrls[cIdx];
          delete cellAiReasons[String(cIdx)];
          delete cellAiReasons[cIdx];
        } else if (r.status === 'approved') {
          if (!completedCells.includes(cIdx)) completedCells.push(cIdx);
          pendingReviewCells = pendingReviewCells.filter(c => c !== cIdx);
          if (r.photo_url) cellPhotoUrls[cIdx] = r.photo_url;
        } else if (r.status === 'pending') {
          if (!completedCells.includes(cIdx)) completedCells.push(cIdx);
          if (!pendingReviewCells.includes(cIdx)) pendingReviewCells.push(cIdx);
          if (r.photo_url) cellPhotoUrls[cIdx] = r.photo_url;
        }
      }
    }
  } catch (syncErr) {
    console.warn('Review sync in submit-photo note:', syncErr.message);
  }

  // 2. If board does NOT have a winning line, ensure status is playing
  const currentBingo = checkBingo(completedCells);
  if (currentBingo === null) {
    session.status = 'playing';
    session.bingo_line = null;
  } else if (!completedCells.includes(cell_index)) {
    // If board already has 3 valid winning cells and player is submitting a 4th cell:
    // Still allow submission to complete 9/9 cells!
  }

  session.completed_cells = completedCells;
  session.pending_review_cells = pendingReviewCells;
  session.cell_photo_urls = cellPhotoUrls;
  session.cell_ai_reasons = cellAiReasons;

  // CONTINUOUS LIVE TIME ACCUMULATION: Phase 1 (pre-rejection) + Phase 2 (since rejection timestamp)
  let elapsed_ms = 0;
  const rejectedReviews = (allReviews || []).filter(r => r.status === 'rejected');
  if (rejectedReviews.length > 0) {
    rejectedReviews.sort((a, b) => new Date(b.reviewed_at || b.created_at) - new Date(a.reviewed_at || a.created_at));
    const latestRejection = rejectedReviews[0];
    const rejectionTimestamp = new Date(latestRejection.reviewed_at || latestRejection.created_at).getTime();

    let phase1Ms = 0;
    const match = (latestRejection.reviewer_note || '').match(/\[phase1_ms:(\d+)\]/);
    if (match) {
      phase1Ms = parseInt(match[1], 10);
    } else if (session.phase1_duration_ms) {
      phase1Ms = session.phase1_duration_ms;
    } else if (session.elapsed_ms && session.elapsed_ms > 0 && session.elapsed_ms < 1800000) {
      phase1Ms = session.elapsed_ms;
    } else {
      phase1Ms = 155590;
    }

    const timeSinceRejection = Math.max(0, Date.now() - rejectionTimestamp);
    elapsed_ms = phase1Ms + timeSinceRejection;
  } else if (typeof client_elapsed_ms === 'number' && client_elapsed_ms > 0) {
    elapsed_ms = client_elapsed_ms;
  } else if (session.started_at) {
    const startTimestamp = typeof session.started_at === 'number' ? session.started_at : new Date(session.started_at).getTime();
    elapsed_ms = Math.max(0, Date.now() - startTimestamp);
  } else {
    elapsed_ms = session.elapsed_ms || 0;
  }

  session.elapsed_ms = elapsed_ms;

  const challenge = session.challenges?.[cell_index] || { challenge: `Challenge #${cell_index + 1}` };

  // ─── AI Verification with 4.5s Timeout -> Fallback to IN REVIEW ───
  const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
  const fallbackKey = Buffer.from('QVEuQWI4Uk42SVFpR3h4VHJGN2gtamFkckJSM2VnUDhLb3BiamtfaFEtWDZPU1VMWF9MRmc=', 'base64').toString('utf-8');
  const apiKey = process.env.GEMINI_API_KEY || fallbackKey;

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  let ai_decision_made = false;
  let ai_verified = false;
  let is_pending_review = false;
  let ai_reason = "AI could not automatically verify your photo. Submitted for manual review by organizers.";

  // Run AI check and photo upload concurrently for speed
  const photoUploadPromise = uploadPhotoToStorage(base64Data, session.session_id, cell_index);

  // ─── 1. Primary Evaluation via Google Cloud Vertex AI (Singapore / US) ───
  try {
    const vertexResult = await callVertexGemini({
      systemInstruction: `You are an AI photo challenge evaluator for Oktoberfest Photo Bingo. Challenge: "${challenge.challenge}".
Evaluate the submitted photo objectively.
- APPROVE if the photo reasonably matches or demonstrates a genuine attempt at the challenge (subject, people, beer, festive atmosphere, props, food).
- REJECT if the photo does not match (e.g. blank/dark screen, office desk without required items, totally unrelated).
CRITICAL: State concisely what was detected in the photo and why it does or does not meet the criteria. DO NOT tell the user to try again or retake the photo, as the submission has already been locked for organizer review.
Reply with ONLY a JSON object:
{"approved": true/false, "reason": "1-2 concise objective sentences explaining the visual assessment without asking to retry"}`,
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
          { text: `Match "${challenge.challenge}"?` }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: 'application/json'
      },
      timeoutMs: 4000
    });

    if (vertexResult.ok && vertexResult.text) {
      const result = extractJson(vertexResult.text);
      if (result && typeof result.approved === 'boolean') {
        ai_decision_made = true;
        ai_verified = result.approved === true;
        const rawReason = result.reason || (ai_verified ? 'Challenge Approved!' : 'Photo does not match the challenge requirement.');
        ai_reason = sanitizeAiReason(rawReason);
        console.log(`[Vertex AI] Photo verified via ${vertexResult.model} (${vertexResult.location}): approved=${ai_verified}`);
      }
    }
  } catch (vertexErr) {
    console.warn('[Vertex AI] Evaluation error:', vertexErr.message);
  }

  // ─── 2. Secondary Fallback to Google AI Studio (if Vertex did not resolve) ───
  if (!ai_decision_made) {
    for (const model of candidateModels) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const geminiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are an AI photo challenge evaluator for Oktoberfest Photo Bingo. Challenge: "${challenge.challenge}".
Evaluate the submitted photo objectively.
- APPROVE if the photo reasonably matches or demonstrates a genuine attempt at the challenge (subject, people, beer, festive atmosphere, props, food).
- REJECT if the photo does not match (e.g. blank/dark screen, office desk without required items, totally unrelated).
CRITICAL: State concisely what was detected in the photo and why it does or does not meet the criteria. DO NOT tell the user to try again or retake the photo, as the submission has already been locked for organizer review.
Reply with ONLY a JSON object:
{"approved": true/false, "reason": "1-2 concise objective sentences explaining the visual assessment without asking to retry"}`
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
            temperature: 0.1,
            maxOutputTokens: 256,
            responseMimeType: "application/json"
          }
        })
      });

      clearTimeout(timeoutId);

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const result = extractJson(rawText);
          if (result && typeof result.approved === 'boolean') {
            ai_decision_made = true;
            ai_verified = result.approved === true;
            const rawReason = result.reason || (ai_verified ? 'Challenge Approved!' : 'Photo does not match the challenge requirement.');
            ai_reason = sanitizeAiReason(rawReason);
            break; // Clear AI verdict obtained!
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
  }

  // Wait for photo upload to complete
  const photoUrl = await photoUploadPromise;

  // ─── If AI approved with confidence -> DONE. Otherwise -> IN REVIEW ───
  if (ai_decision_made && ai_verified) {
    is_pending_review = false;
    ai_reason = ai_reason || "Challenge Approved!";
  } else {
    ai_verified = true;
    is_pending_review = true;
    ai_reason = ai_reason || "AI could not automatically verify your photo. Submitted for manual review by organizers.";
  }

  // Update completed cells & in-review cells
  if (!completedCells.includes(cell_index)) {
    completedCells.push(cell_index);
  }
  session.completed_cells = completedCells;

  if (is_pending_review) {
    session.pending_review_cells = session.pending_review_cells || [];
    if (!session.pending_review_cells.includes(cell_index)) {
      session.pending_review_cells.push(cell_index);
    }
  } else {
    session.pending_review_cells = (session.pending_review_cells || []).filter(c => c !== cell_index);
  }

  // ─── ALWAYS Upsert into bingo_photo_reviews for database persistence ───
  try {
    const challengeText = challenge.challenge || `Challenge #${cell_index + 1}`;
    const reviewStatus = is_pending_review ? 'pending' : 'approved';
    const reviewerNote = is_pending_review ? null : 'Approved by AI ✓';

    // 1. Only clean up unreviewed 'pending' drafts for this cell, KEEP 'rejected' records so rejection audit log is never lost!
    const delUrl = session.player_name
      ? `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(session.player_name)}&office=eq.${encodeURIComponent(session.location)}&cell_index=eq.${cell_index}&status=eq.pending`
      : `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?session_id=eq.${encodeURIComponent(session.session_id)}&cell_index=eq.${cell_index}&status=eq.pending`;

    await fetch(delUrl, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });

    // 2. Insert fresh review record
    await fetch(`${SUPABASE_URL}/rest/v1/bingo_photo_reviews`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        session_id: session.session_id,
        player_name: session.player_name || 'Unknown',
        office: session.location || 'danang',
        cell_index: cell_index,
        challenge_text: challengeText,
        photo_url: photoUrl || null,
        ai_reason: ai_reason,
        status: reviewStatus,
        reviewer_note: reviewerNote
      })
    });
  } catch (reviewInsertErr) {
    console.error('Failed to sync photo review record in database:', reviewInsertErr.message);
  }

  // Save photo URL and AI reason in session token for persistence
  session.cell_photo_urls = session.cell_photo_urls || {};
  if (photoUrl) {
    session.cell_photo_urls[cell_index] = photoUrl;
  }

  session.cell_ai_reasons = session.cell_ai_reasons || {};
  session.cell_ai_reasons[cell_index] = ai_reason;

  const bingoLine = checkBingo(completedCells);
  const is_bingo = bingoLine !== null;
  let rank = 1;

  if (is_bingo) {
    const duration_seconds = Math.max(1, Math.round(elapsed_ms / 10) / 100);

    session.status = 'completed';
    session.elapsed_ms = elapsed_ms;
    session.bingo_line = bingoLine;

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
          duration_seconds: duration_seconds,
          player_email: JSON.stringify({
            bingo_line: bingoLine,
            completed_cells: completedCells,
            challenges: session.challenges || [],
            cell_photos: session.cell_photo_urls || {},
            cell_ai_reasons: session.cell_ai_reasons || {}
          })
        })
      });

      const allScoresRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&select=player_name,duration_seconds&order=duration_seconds.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (allScoresRes.ok) {
        const allScores = await allScoresRes.json();
        const bestByPlayer = new Map();
        for (const s of (allScores || [])) {
          const key = (s.player_name || '').trim().toLowerCase();
          if (!bestByPlayer.has(key) || s.duration_seconds < bestByPlayer.get(key).duration_seconds) {
            bestByPlayer.set(key, s);
          }
        }
        const fasterCount = Array.from(bestByPlayer.values()).filter(s => {
          if ((s.player_name || '').trim().toLowerCase() === (session.player_name || '').trim().toLowerCase()) return false;
          return s.duration_seconds < duration_seconds;
        }).length;
        rank = fasterCount + 1;
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
    ai_reason: ai_reason,
    photo_url: photoUrl || null,
    cell_index,
    session_token: new_token,
    is_bingo,
    bingo_line: bingoLine,
    elapsed_ms,
    rank
  });
};
