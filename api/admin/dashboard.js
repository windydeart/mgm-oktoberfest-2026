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
    const [scores, allReviews, reviewsPending, reviewsApproved, reviewsRejected, gameControlRow] = await Promise.all([
      supabaseGet('oktoberfest_game_scores?game_name=eq.photo_bingo&select=id,player_name,office,duration_seconds,created_at,player_email&order=duration_seconds.asc'),
      supabaseGet('bingo_photo_reviews?select=id,player_name,office,cell_index,status,created_at'),
      supabaseGet('bingo_photo_reviews?status=eq.pending&select=id'),
      supabaseGet('bingo_photo_reviews?status=eq.approved&select=id'),
      supabaseGet('bingo_photo_reviews?status=eq.rejected&select=id'),
      supabaseGet('oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control&select=player_email&limit=1')
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
      if (!bestByPlayer.has(key) || s.duration_seconds < bestByPlayer.get(key).duration_seconds) {
        bestByPlayer.set(key, s);
      }
    }

    // Include any rejected players from reviews not in scores
    for (const [key, revs] of reviewsByPlayer.entries()) {
      const hasRejected = revs.some(r => r.status === 'rejected');
      if (hasRejected && !bestByPlayer.has(key)) {
        const sampleRev = revs.find(r => r.status === 'rejected') || revs[0];
        bestByPlayer.set(key, {
          player_name: sampleRev.player_name,
          office: sampleRev.office || 'danang',
          duration_seconds: 9999,
          created_at: sampleRev.created_at,
          player_email: JSON.stringify({ is_disqualified: true, review_status: 'rejected' })
        });
      }
    }

    // Classify into tiers:
    // Tier 1: Approved BINGO (Priority for Champion & Top 1)
    // Tier 2: Pending BINGO
    // Tier 3: Disqualified (bị loại) -> Lowest on leaderboard
    const categorized = Array.from(bestByPlayer.values()).map(s => {
      const key = (s.player_name || '').trim().toLowerCase();
      const playerRevs = reviewsByPlayer.get(key) || [];

      let snapshot = {};
      if (s.player_email && typeof s.player_email === 'string' && s.player_email.startsWith('{')) {
        try { snapshot = JSON.parse(s.player_email); } catch (e) {}
      }

      const hasRejected = playerRevs.some(r => r.status === 'rejected') || snapshot.is_disqualified === true || snapshot.review_status === 'rejected';
      const hasPending = playerRevs.some(r => r.status === 'pending') || snapshot.review_status === 'pending';

      let tier = 2;
      let status = 'pending';
      let isDisqualified = false;

      if (hasRejected) {
        tier = 3;
        status = 'rejected';
        isDisqualified = true;
      } else if (!hasPending && (playerRevs.some(r => r.status === 'approved') || snapshot.review_status === 'approved')) {
        tier = 1;
        status = 'approved';
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

    // Leaderboard (top 15)
    const leaderboard = categorized.slice(0, 15).map((s, idx) => ({
      rank: idx + 1,
      player_name: s.player_name,
      location: s.office,
      elapsed_ms: s.duration_seconds >= 9999 ? 0 : Math.round(s.duration_seconds * 1000),
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
