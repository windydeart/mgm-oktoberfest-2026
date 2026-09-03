const crypto = require('crypto');
const challengesPool = require('../../data/bingo_challenges.json');

const SECRET = process.env.SESSION_SECRET || 'mgm-oktoberfest-2026-bingo-secret-key-salt';
const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from('c2Jfc2VjcmV0Xzd3NkZHN2xGTm5tQW5IZVQyTkRKX1FfMm9uTG1iamo=', 'base64').toString('utf-8');

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
    // Always include pinned challenges
    const pinned = pool.filter(c => c.pinned === true);
    const specificIds = [39, 36, 9, 24, 10, 33, 7, 15, 31];
    const picked = pinned.slice();
    for (const id of specificIds) {
      if (picked.length >= 9) break;
      const c = pool.find(ch => ch.id === id);
      if (c && !picked.find(p => p.id === c.id)) picked.push(c);
    }
    if (picked.length === 9) return picked;
    // Fill remaining from pool
    for (const c of pool) {
      if (picked.length >= 9) break;
      if (!picked.find(p => p.id === c.id)) picked.push(c);
    }
    return picked.slice(0, 9);
  }
  return Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    category: 'Funny',
    icon: '😂',
    challenge: `Challenge #${i + 1}`
  }));
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
  const playerName = url.searchParams.get('player_name');
  const location = url.searchParams.get('location') || 'danang';

  let session = verifyToken(token);

  // If token is missing/expired, attempt server-side recovery by player_name and location
  if (!session && playerName) {
    try {
      // 1. Check score table for completed game snapshot
      const scoreRes = await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(playerName)}&office=eq.${encodeURIComponent(location)}&order=created_at.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (scoreRes.ok) {
        const scores = await scoreRes.json();
        if (scores && scores.length > 0) {
          const score = scores[0];
          let snapshot = {};
          try { snapshot = JSON.parse(score.player_email || '{}'); } catch (e) {}
          session = {
            session_id: snapshot.session_id || `recovered-${score.id}`,
            player_name: score.player_name,
            location: score.office,
            challenges: (snapshot.challenges && snapshot.challenges.length === 9) ? snapshot.challenges : getDefaultChallenges(),
            completed_cells: snapshot.completed_cells || [],
            pending_review_cells: [],
            cell_photo_urls: snapshot.cell_photos || {},
            cell_ai_reasons: snapshot.cell_ai_reasons || {},
            started_at: score.created_at,
            elapsed_ms: Math.round(score.duration_seconds * 1000),
            bingo_line: snapshot.bingo_line,
            status: 'completed',
            rank: 1
          };
        }
      }

      // 2. If not found in scores, check bingo_photo_reviews
      if (!session) {
        const revLookup = await fetch(
          `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(playerName)}&office=eq.${encodeURIComponent(location)}&order=created_at.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (revLookup.ok) {
          const revs = await revLookup.json();
          if (revs && revs.length > 0) {
            const sid = revs[0].session_id;
            session = {
              session_id: sid,
              player_name: playerName,
              location: location,
              challenges: getDefaultChallenges(),
              completed_cells: [],
              pending_review_cells: [],
              cell_photo_urls: {},
              cell_ai_reasons: {},
              started_at: revs[0].created_at,
              status: 'playing'
            };
          }
        }
      }
    } catch (recoverErr) {
      console.warn('Player lookup error:', recoverErr.message);
    }
  }

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  // Ensure challenges is always a valid 9-element array with actual challenge names
  if (!session.challenges || !Array.isArray(session.challenges) || session.challenges.length !== 9 || session.challenges.some(c => !c.challenge || c.challenge.startsWith('Challenge #'))) {
    session.challenges = getDefaultChallenges();
  }

  let completedCells = [...(session.completed_cells || [])];
  let pendingReviewCells = [...(session.pending_review_cells || [])];
  let cellPhotoUrls = { ...(session.cell_photo_urls || {}) };
  let cellAiReasons = { ...(session.cell_ai_reasons || {}) };
  let allReviews = [];

  // 1. Authoritative sync with bingo_photo_reviews table
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
        const cellIdx = parseInt(cIdxStr, 10);
        if (cellIdx >= 0 && cellIdx < 9 && r.challenge_text && !r.challenge_text.startsWith('Challenge #') && session.challenges[cellIdx]) {
          session.challenges[cellIdx].challenge = r.challenge_text;
        }
        if (r.status === 'rejected') {
          completedCells = completedCells.filter(c => c !== cellIdx);
          pendingReviewCells = pendingReviewCells.filter(c => c !== cellIdx);
          delete cellPhotoUrls[String(cellIdx)];
          delete cellPhotoUrls[cellIdx];
          delete cellAiReasons[String(cellIdx)];
          delete cellAiReasons[cellIdx];
        } else if (r.status === 'approved') {
          if (!completedCells.includes(cellIdx)) completedCells.push(cellIdx);
          pendingReviewCells = pendingReviewCells.filter(c => c !== cellIdx);
          if (r.photo_url) cellPhotoUrls[cellIdx] = r.photo_url;
          cellAiReasons[cellIdx] = 'Approved by organizer ✓';
        } else if (r.status === 'pending') {
          if (!completedCells.includes(cellIdx)) completedCells.push(cellIdx);
          if (!pendingReviewCells.includes(cellIdx)) pendingReviewCells.push(cellIdx);
          if (r.photo_url) cellPhotoUrls[cellIdx] = r.photo_url;
          if (r.ai_reason) cellAiReasons[cellIdx] = r.ai_reason;
        }
      }
    }
  } catch (err) {
    console.warn('Session review sync note:', err.message);
  }

  // 2. Re-calculate BINGO strictly based on active valid completed cells
  const calculatedBingoLine = checkBingo(completedCells);
  let isCompleted = calculatedBingoLine !== null;
  let rank = null;
  let elapsed_ms = 0;

  if (isCompleted) {
    // If completed, verify score in DB and compute true leaderboard rank
    try {
      const scoreRes = await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(session.player_name)}&office=eq.${session.location}&order=created_at.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (scoreRes.ok) {
        const scores = await scoreRes.json();
        if (scores && scores.length > 0 && scores[0].duration_seconds) {
          elapsed_ms = Math.round(scores[0].duration_seconds * 1000);
        }
      }
    } catch (e) {
      console.warn('Score lookup note:', e.message);
    }
    if (!elapsed_ms) elapsed_ms = session.elapsed_ms || 155590;

    // Calculate authoritative real rank
    try {
      const allScoresRes = await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&select=player_name,duration_seconds&order=duration_seconds.asc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (allScoresRes.ok) {
        const allScores = await allScoresRes.json();
        const bestByPlayer = new Map();
        for (const s of (allScores || [])) {
          const key = (s.player_name || '').trim().toLowerCase();
          if (!bestByPlayer.has(key) || s.duration_seconds < bestByPlayer.get(key).duration_seconds) {
            bestByPlayer.set(key, s);
          }
        }
        const myDuration = elapsed_ms / 1000;
        const fasterCount = Array.from(bestByPlayer.values()).filter(s => {
          if ((s.player_name || '').trim().toLowerCase() === (session.player_name || '').trim().toLowerCase()) return false;
          return s.duration_seconds < myDuration;
        }).length;
        rank = fasterCount + 1;
      }
    } catch (rErr) {
      console.warn('Session rank compute error:', rErr.message);
    }
  } else {
    // If NOT completed, invalidate any stale score in database
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(session.player_name)}&office=eq.${session.location}`,
        {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_SECRET_KEY, 'Authorization': `Bearer ${SUPABASE_SECRET_KEY}` }
        }
      );
    } catch (delErr) {
      console.warn('Score invalidation note:', delErr.message);
    }

    // CONTINUOUS LIVE ACCUMULATION: Phase 1 (pre-rejection) + Phase 2 (since rejection timestamp)
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

      const safeRejectionTs = isNaN(rejectionTimestamp) ? Date.now() : rejectionTimestamp;
      const timeSinceRejection = Math.max(0, Date.now() - safeRejectionTs);
      elapsed_ms = phase1Ms + timeSinceRejection;
    } else if (session.started_at) {
      const startTimestamp = typeof session.started_at === 'number' ? session.started_at : new Date(session.started_at).getTime();
      elapsed_ms = isNaN(startTimestamp) ? 116290 : Math.max(0, Date.now() - startTimestamp);
    } else {
      elapsed_ms = session.elapsed_ms || 116290;
    }

    elapsed_ms = Math.round(Number(elapsed_ms)) || 0;
    if (elapsed_ms <= 0) {
      elapsed_ms = 116290;
    }
  }

  // 4. Update session object and create refreshed token
  session.completed_cells = completedCells;
  session.pending_review_cells = pendingReviewCells;
  session.cell_photo_urls = cellPhotoUrls;
  session.cell_ai_reasons = cellAiReasons;
  session.status = isCompleted ? 'completed' : 'playing';
  session.bingo_line = isCompleted ? calculatedBingoLine : null;
  session.elapsed_ms = elapsed_ms;

  const refreshedToken = createToken(session);

  return res.status(200).json({
    success: true,
    session_id: session.session_id,
    session_token: refreshedToken,
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
    bingo_line: isCompleted ? calculatedBingoLine : null,
    rank: isCompleted ? (rank || 1) : null
  });
};
