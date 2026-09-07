const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

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
  const location = url.searchParams.get('location') || 'all';

  try {
    let queryUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&order=duration_seconds.asc&limit=30&select=id,player_name,office,duration_seconds,created_at,player_email`;
    let reviewQueryUrl = `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?select=player_name,office,cell_index,status,reviewer_note`;
    if (location === 'danang' || location === 'hcmc') {
      queryUrl += `&office=eq.${location}`;
      reviewQueryUrl += `&office=eq.${location}`;
    }

    const [sbRes, revRes] = await Promise.all([
      fetch(queryUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }),
      fetch(reviewQueryUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      })
    ]);

    if (!sbRes.ok) {
      return res.status(404).json({ error: 'No winner found yet.' });
    }

    const records = await sbRes.json();
    const reviews = revRes.ok ? await revRes.json() : [];

    if (!records || records.length === 0) {
      return res.status(200).json({ success: false, message: 'No champions yet. Be the first to win!' });
    }

    // Group reviews by player
    const reviewsByPlayer = new Map();
    for (const r of (reviews || [])) {
      const key = (r.player_name || '').trim().toLowerCase();
      if (!reviewsByPlayer.has(key)) reviewsByPlayer.set(key, []);
      reviewsByPlayer.get(key).push(r);
    }

    // Deduplicate: keep only best time per player
    const bestByPlayer = new Map();
    for (const record of records) {
      const key = (record.player_name || '').trim().toLowerCase();
      if (!bestByPlayer.has(key) || record.duration_seconds < bestByPlayer.get(key).duration_seconds) {
        bestByPlayer.set(key, record);
      }
    }

    // Filter and tier candidates:
    // Rule: Priority for Top 1 is a player who has Bingo, fastest time, and is Approved.
    // Rejected players are disqualified and can NEVER be Top 1.
    const candidates = [];
    for (const record of bestByPlayer.values()) {
      const key = (record.player_name || '').trim().toLowerCase();
      const playerRevs = reviewsByPlayer.get(key) || [];

      let snapshotData = {};
      if (record.player_email && typeof record.player_email === 'string' && record.player_email.trim().startsWith('{')) {
        try { snapshotData = JSON.parse(record.player_email); } catch (e) {}
      }

      // Gather rejected cell indices
      const rejectedCellIndices = new Set(
        playerRevs.filter(r => r.status === 'rejected').map(r => Number(r.cell_index))
      );
      if (snapshotData.rejected_cell !== undefined && snapshotData.rejected_cell !== null) {
        rejectedCellIndices.add(Number(snapshotData.rejected_cell));
      }
      if (Array.isArray(snapshotData.rejected_cells)) {
        snapshotData.rejected_cells.forEach(idx => rejectedCellIndices.add(Number(idx)));
      }

      // Gather completed cells
      let completedCells = Array.isArray(snapshotData.completed_cells) ? snapshotData.completed_cells.map(Number) : [];
      playerRevs.forEach(r => {
        if (r.status !== 'rejected') {
          const idx = Number(r.cell_index);
          if (!completedCells.includes(idx)) completedCells.push(idx);
        }
      });
      if (completedCells.length === 0 && snapshotData.bingo_line && BINGO_LINE_CELLS[snapshotData.bingo_line]) {
        completedCells = [...BINGO_LINE_CELLS[snapshotData.bingo_line]];
      }
      completedCells = completedCells.filter(c => !rejectedCellIndices.has(c));

      // Find valid Bingo line with 0 rejected cells
      const validBingo = findValidBingoLine(completedCells, rejectedCellIndices);
      if (!validBingo) continue; // Disqualified! Cannot be winner.

      const winningCells = validBingo.cells;
      const hasPending = winningCells.some(cIdx => {
        const rev = playerRevs.find(r => Number(r.cell_index) === cIdx);
        if (rev) return rev.status === 'pending';
        return false;
      }) || (snapshotData.review_status === 'pending' && !playerRevs.length);

      const isApproved = !hasPending && (playerRevs.some(r => r.status === 'approved') || snapshotData.review_status === 'approved');

      // Tier 1: Approved, Tier 2: Pending
      const tier = isApproved ? 1 : 2;

      candidates.push({
        ...record,
        snapshotData,
        tier
      });
    }

    if (candidates.length === 0) {
      return res.status(200).json({ success: false, message: 'No champions yet. Be the first to win!' });
    }

    // Sort: Tier 1 (Approved) first, then fastest duration_seconds
    candidates.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.duration_seconds !== b.duration_seconds) return a.duration_seconds - b.duration_seconds;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const topScore = candidates[0];
    const snapshotData = topScore.snapshotData || {};

    const winner = {
      player_name: topScore.player_name,
      location: topScore.office,
      duration_seconds: topScore.duration_seconds,
      elapsed_ms: Math.round((topScore.duration_seconds || 0) * 1000),
      completed_at: topScore.created_at,
      status: topScore.tier === 1 ? 'approved' : 'pending',
      bingo_line: snapshotData.bingo_line || 'row-0',
      completed_cells: snapshotData.completed_cells || [0, 1, 2],
      challenges: snapshotData.challenges || [],
      cell_photos: snapshotData.cell_photos || {},
      cell_ai_reasons: snapshotData.cell_ai_reasons || {}
    };

    res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5');
    return res.status(200).json({ success: true, winner });

  } catch (err) {
    console.error('Winner API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
