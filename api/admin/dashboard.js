const { verifyAdminToken, handleCors } = require('./auth');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCorsAll(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function supabaseGet(path, fallback = []) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) {
      console.warn(`Supabase warning for ${path}: ${res.status}`);
      return fallback;
    }
    return await res.json();
  } catch (err) {
    console.warn(`Supabase fetch failed for ${path}:`, err.message);
    return fallback;
  }
}

const BINGO_LINE_CELLS = {
  'row-0': [0, 1, 2],
  'row-1': [3, 4, 5],
  'row-2': [6, 7, 8],
  'col-0': [0, 3, 6],
  'col-1': [1, 4, 7],
  'col-2': [2, 5, 8],
  'diag-main': [0, 4, 8],
  'diag-anti': [2, 4, 6]
};

function findValidBingoLine(completedCells, rejectedCells) {
  const compSet = new Set(Array.from(completedCells || []).map(Number));
  const rejSet = new Set(Array.from(rejectedCells || []).map(Number));

  for (const [lineKey, cellIndices] of Object.entries(BINGO_LINE_CELLS)) {
    const allCompleted = cellIndices.every(c => compSet.has(c));
    const noneRejected = cellIndices.every(c => !rejSet.has(c));
    if (allCompleted && noneRejected) {
      return { line: lineKey, cells: cellIndices };
    }
  }
  return null;
}

module.exports = async (req, res) => {
  handleCorsAll(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = verifyAdminToken(token);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all data in parallel
    const [scores, allReviews, reviewsPending, reviewsApproved, reviewsRejected, gameControlRow, sessionRows] = await Promise.all([
      supabaseGet('oktoberfest_game_scores?game_name=eq.photo_bingo&select=id,player_name,office,duration_seconds,created_at,player_email&order=duration_seconds.asc'),
      supabaseGet('bingo_photo_reviews?select=id,player_name,office,cell_index,status,created_at'),
      supabaseGet('bingo_photo_reviews?status=eq.pending&select=id'),
      supabaseGet('bingo_photo_reviews?status=eq.approved&select=id'),
      supabaseGet('bingo_photo_reviews?status=eq.rejected&select=id'),
      supabaseGet('oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control&select=player_email&limit=1'),
      supabaseGet('oktoberfest_game_scores?game_name=eq.photo_bingo_session&select=player_name,player_email')
    ]);

    let gameState = 'active';
    let roundId = 1;
    if (gameControlRow && gameControlRow.length > 0) {
      try {
        const snap = JSON.parse(gameControlRow[0].player_email || '{}');
        if (snap.state && ['active', 'waiting', 'paused', 'finished'].includes(snap.state)) {
          gameState = snap.state;
        }
        if (snap.round_id) {
          roundId = snap.round_id;
        }
      } catch (e) {}
    }

    const sessionsByPlayer = new Map();
    for (const row of (sessionRows || [])) {
      const key = (row.player_name || '').trim().toLowerCase();
      try {
        const snap = JSON.parse(row.player_email || '{}');
        if (snap.started_at) sessionsByPlayer.set(key, snap.started_at);
      } catch (e) {}
    }

    // Group reviews by player key
    const reviewsByPlayer = new Map();
    for (const r of (allReviews || [])) {
      const key = (r.player_name || '').trim().toLowerCase();
      if (!reviewsByPlayer.has(key)) reviewsByPlayer.set(key, []);
      reviewsByPlayer.get(key).push(r);
    }

    // Deduplicate scores: keep only the best (fastest) time per player
    const bestByPlayer = new Map();
    for (const s of scores) {
      const key = (s.player_name || '').trim().toLowerCase();
      if (s.duration_seconds >= 9999) {
        const startedAt = sessionsByPlayer.get(key);
        const playerRevs = reviewsByPlayer.get(key) || [];
        const refTime = playerRevs.length > 0 && playerRevs[0].created_at
          ? new Date(playerRevs[0].created_at).getTime()
          : new Date(s.created_at).getTime();
        if (startedAt) {
          const startTime = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
          s.duration_seconds = Math.round(Math.max(1000, refTime - startTime) / 10) / 100;
        } else {
          s.duration_seconds = 15.0;
        }
      }
      if (!bestByPlayer.has(key) || s.duration_seconds < bestByPlayer.get(key).duration_seconds) {
        bestByPlayer.set(key, s);
      }
    }

    // Classify into tiers:
    // Tier 1: Approved BINGO (Priority for Champion & Top 1)
    // Tier 2: Pending BINGO
    // Tier 3: Disqualified (bị loại do ô trên hàng Bingo bị reject) -> Lowest on leaderboard
    const categorized = Array.from(bestByPlayer.values()).map(s => {
      const key = (s.player_name || '').trim().toLowerCase();
      const playerRevs = reviewsByPlayer.get(key) || [];

      let snapshot = {};
      if (s.player_email && typeof s.player_email === 'string' && s.player_email.startsWith('{')) {
        try { snapshot = JSON.parse(s.player_email); } catch (e) {}
      }

      // 1. Gather all rejected cell indices
      const rejectedCellIndices = new Set(
        playerRevs.filter(r => r.status === 'rejected').map(r => Number(r.cell_index))
      );
      if (snapshot.rejected_cell !== undefined && snapshot.rejected_cell !== null) {
        rejectedCellIndices.add(Number(snapshot.rejected_cell));
      }
      if (Array.isArray(snapshot.rejected_cells)) {
        snapshot.rejected_cells.forEach(idx => rejectedCellIndices.add(Number(idx)));
      }

      // 2. Gather completed cells
      let completedCells = Array.isArray(snapshot.completed_cells) ? snapshot.completed_cells.map(Number) : [];
      playerRevs.forEach(r => {
        if (r.status !== 'rejected') {
          const idx = Number(r.cell_index);
          if (!completedCells.includes(idx)) completedCells.push(idx);
        }
      });
      if (completedCells.length === 0 && snapshot.bingo_line && BINGO_LINE_CELLS[snapshot.bingo_line]) {
        completedCells = [...BINGO_LINE_CELLS[snapshot.bingo_line]];
      }

      // Filter out rejected cells
      completedCells = completedCells.filter(c => !rejectedCellIndices.has(c));

      // 3. Find valid Bingo line with ZERO rejected cells
      const validBingo = findValidBingoLine(completedCells, rejectedCellIndices);

      let tier = 2;
      let status = 'pending';
      let isDisqualified = false;

      if (!validBingo) {
        // Winning line was broken by rejection or has rejected cell -> OUT
        tier = 3;
        status = 'rejected';
        isDisqualified = true;
      } else {
        // Has a valid winning line! Check if any cell on this winning line is pending
        const winningCells = validBingo.cells;
        const hasPendingOnLine = winningCells.some(cIdx => {
          const rev = playerRevs.find(r => Number(r.cell_index) === cIdx);
          if (rev) return rev.status === 'pending';
          return false;
        }) || (snapshot.review_status === 'pending' && !playerRevs.length);

        if (hasPendingOnLine) {
          tier = 2; // Pending BINGO
          status = 'pending';
          isDisqualified = false;
        } else {
          tier = 1; // Approved BINGO
          status = 'approved';
          isDisqualified = false;
        }
      }

      return {
        ...s,
        tier,
        status,
        is_disqualified: isDisqualified
      };
    });

    // Sort: Tier 1 first, then Tier 2, then Tier 3 (Disqualified) at the bottom
    categorized.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.duration_seconds !== b.duration_seconds) return a.duration_seconds - b.duration_seconds;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Calculate stats
    const totalPlayers = categorized.length;
    const danangPlayers = categorized.filter(s => s.office === 'danang').length;
    const hcmcPlayers = categorized.filter(s => s.office === 'hcmc').length;

    // Average completion time (only for qualified players)
    const durations = categorized.filter(s => !s.is_disqualified && s.duration_seconds > 0 && s.duration_seconds < 9999).map(s => s.duration_seconds);
    const avgTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Champion: Top 1 eligible player (Approved prioritized, never disqualified)
    const eligibleForChampion = categorized.filter(s => !s.is_disqualified);
    const champion = eligibleForChampion.length > 0 ? eligibleForChampion[0] : null;

    // Leaderboard (top 10)
    const leaderboard = categorized.slice(0, 10).map((s, idx) => ({
      rank: idx + 1,
      player_name: s.player_name,
      location: s.office,
      elapsed_ms: Math.round(Math.max(1, s.duration_seconds >= 9999 ? 15 : (s.duration_seconds || 1)) * 1000),
      completed_at: s.created_at,
      status: s.status,
      is_disqualified: s.is_disqualified
    }));

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      stats: {
        total_players: totalPlayers,
        players_by_location: { danang: danangPlayers, hcmc: hcmcPlayers },
        total_completed: categorized.filter(s => !s.is_disqualified).length,
        pending_reviews: reviewsPending.length,
        approved_count: reviewsApproved.length,
        rejected_count: reviewsRejected.length,
        avg_completion_time_ms: Math.round(avgTime * 1000),
        champion: champion ? { player_name: champion.player_name, location: champion.office, elapsed_ms: Math.round(champion.duration_seconds * 1000), status: champion.status } : null,
        game_state: gameState,
        round_id: roundId
      },
      leaderboard
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
};
