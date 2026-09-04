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
  if (!cells || !cells.length) return null;
  const numCells = cells.map(Number);
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
    if (line.indices.every(i => numCells.includes(i))) {
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
    // Always include pinned challenges (e.g. ID 41: Selfie with "A12 open source" banner)
    const pinned = pool.filter(c => c.pinned === true);
    const unpinned = pool.filter(c => c.pinned !== true);
    const specificIds = [39, 36, 9, 24, 10, 33, 7, 15, 31];
    const picked = [...pinned];
    for (const id of specificIds) {
      if (picked.length >= 9) break;
      const c = pool.find(ch => ch.id === id);
      if (c && !picked.find(p => p.id === c.id)) picked.push(c);
    }
    // Fill remaining from unpinned pool
    for (const c of unpinned) {
      if (picked.length >= 9) break;
      if (!picked.find(p => p.id === c.id)) picked.push(c);
    }
    const final9 = picked.slice(0, 9);
    // Shuffle the final 9 so the pinned challenge lands at a random position (0-8)
    for (let i = final9.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [final9[i], final9[j]] = [final9[j], final9[i]];
    }
    return final9;
  }
  return Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    category: 'Marketing',
    icon: '📸',
    challenge: i === 0 ? 'Selfie with "A12 open source" banner' : `Challenge #${i + 1}`
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

      // 2. If not found in completed scores, check photo_bingo_session for the starting snapshot (active or invalidated game)
      if (!session) {
        const sessionRes = await fetch(
          `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo_session&player_name=eq.${encodeURIComponent(playerName)}&office=eq.${encodeURIComponent(location)}&order=created_at.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (sessionRes.ok) {
          const sessions = await sessionRes.json();
          if (sessions && sessions.length > 0) {
            let sessionSnap = {};
            try { sessionSnap = JSON.parse(sessions[0].player_email || '{}'); } catch (e) {}
            if (sessionSnap.challenges && Array.isArray(sessionSnap.challenges) && sessionSnap.challenges.length === 9) {
              session = {
                session_id: sessionSnap.session_id || `session-${playerName}`,
                player_name: sessions[0].player_name,
                location: sessions[0].office,
                challenges: sessionSnap.challenges,
                completed_cells: [],
                pending_review_cells: [],
                cell_photo_urls: {},
                cell_ai_reasons: {},
                started_at: sessionSnap.started_at || sessions[0].created_at,
                status: 'playing'
              };
            }
          }
        }
      }

      // 3. If still not found, check bingo_photo_reviews for the latest active session
      if (!session) {
        const latestRevLookup = await fetch(
          `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(playerName)}&office=eq.${encodeURIComponent(location)}&order=created_at.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (latestRevLookup.ok) {
          const revs = await latestRevLookup.json();
          if (revs && revs.length > 0) {
            const sid = revs[0].session_id;
            let sessionStartedAt = revs[0].created_at;
            try {
              const earliestRes = await fetch(
                `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?session_id=eq.${encodeURIComponent(sid)}&order=created_at.asc&limit=1`,
                { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
              );
              if (earliestRes.ok) {
                const earliestList = await earliestRes.json();
                if (earliestList && earliestList.length > 0) {
                  sessionStartedAt = earliestList[0].created_at;
                }
              }
            } catch (e) {}

            // If the start time is more than 24 hours old, it is from an old testing session days ago. Find today's earliest photo!
            const sessionStartTs = new Date(sessionStartedAt).getTime();
            if (isNaN(sessionStartTs) || Date.now() - sessionStartTs > 24 * 3600 * 1000) {
              try {
                const todayCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
                const todayRes = await fetch(
                  `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?player_name=eq.${encodeURIComponent(playerName)}&created_at=gte.${encodeURIComponent(todayCutoff)}&order=created_at.asc&limit=1`,
                  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
                );
                if (todayRes.ok) {
                  const todayList = await todayRes.json();
                  if (todayList && todayList.length > 0) {
                    sessionStartedAt = todayList[0].created_at;
                  }
                }
              } catch (e) {}
            }

            session = {
              session_id: sid,
              player_name: playerName,
              location: location,
              challenges: getDefaultChallenges(),
              completed_cells: [],
              pending_review_cells: [],
              cell_photo_urls: {},
              cell_ai_reasons: {},
              started_at: sessionStartedAt,
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

  // If session challenges are missing or invalid, try to restore from photo_bingo_session
  if (session && (!session.challenges || !Array.isArray(session.challenges) || session.challenges.length !== 9 || session.challenges.some(c => !c.challenge || c.challenge.startsWith('Challenge #'))) && session.player_name) {
    try {
      const snapRes = await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo_session&player_name=eq.${encodeURIComponent(session.player_name)}&order=created_at.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (snapRes.ok) {
        const snaps = await snapRes.json();
        if (snaps && snaps.length > 0) {
          const snapObj = JSON.parse(snaps[0].player_email || '{}');
          if (snapObj.challenges && Array.isArray(snapObj.challenges) && snapObj.challenges.length === 9) {
            session.challenges = snapObj.challenges;
          }
        }
      }
    } catch (e) {}
  }

  // Fallback if still not a valid 9-element array
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

  // 2. Calculate BINGO based on all completed cells (including in-review cells)
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
    if (!elapsed_ms) {
      if (allReviews && allReviews.length > 0) {
        const sorted = [...allReviews].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const lastPhotoTime = new Date(sorted[sorted.length - 1].created_at).getTime();
        const startTs = new Date(session.started_at).getTime();
        if (!isNaN(lastPhotoTime) && !isNaN(startTs) && lastPhotoTime > startTs) {
          elapsed_ms = Math.max(1000, lastPhotoTime - startTs);
        }
      }
      if (!elapsed_ms) elapsed_ms = session.elapsed_ms || 60000;
    }

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

    let startTimestamp = session.started_at ? new Date(session.started_at).getTime() : 0;
    if (isNaN(startTimestamp) || startTimestamp <= 0 || Date.now() - startTimestamp > 24 * 3600 * 1000) {
      startTimestamp = Date.now() - (session.elapsed_ms || 60000);
      session.started_at = new Date(startTimestamp).toISOString();
    }
    elapsed_ms = Math.max(1000, Date.now() - startTimestamp);
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
