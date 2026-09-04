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
    const [scores, reviews, reviewsPending, reviewsApproved, reviewsRejected, gameControlRow] = await Promise.all([
      supabaseGet('oktoberfest_game_scores?game_name=eq.photo_bingo&select=id,player_name,office,duration_seconds,created_at&order=duration_seconds.asc'),
      supabaseGet('bingo_photo_reviews?select=id,status'),
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

    // Deduplicate scores: keep only the best (fastest) time per player
    const bestByPlayer = new Map();
    for (const s of scores) {
      const key = (s.player_name || '').trim().toLowerCase();
      if (!bestByPlayer.has(key) || s.duration_seconds < bestByPlayer.get(key).duration_seconds) {
        bestByPlayer.set(key, s);
      }
    }
    const uniqueScores = Array.from(bestByPlayer.values()).sort((a, b) => a.duration_seconds - b.duration_seconds);

    // Calculate stats
    const totalPlayers = uniqueScores.length;
    const danangPlayers = uniqueScores.filter(s => s.office === 'danang').length;
    const hcmcPlayers = uniqueScores.filter(s => s.office === 'hcmc').length;

    // Average completion time
    const durations = uniqueScores.map(s => s.duration_seconds).filter(d => d > 0);
    const avgTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Champion (fastest)
    const champion = uniqueScores.length > 0 ? uniqueScores[0] : null;

    // Leaderboard (top 10)
    const leaderboard = uniqueScores.slice(0, 10).map((s, idx) => ({
      rank: idx + 1,
      player_name: s.player_name,
      location: s.office,
      elapsed_ms: Math.round(s.duration_seconds * 1000),
      completed_at: s.created_at
    }));

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      stats: {
        total_players: totalPlayers,
        players_by_location: { danang: danangPlayers, hcmc: hcmcPlayers },
        total_completed: totalPlayers, // All in scores table have completed BINGO
        pending_reviews: reviewsPending.length,
        approved_count: reviewsApproved.length,
        rejected_count: reviewsRejected.length,
        avg_completion_time_ms: Math.round(avgTime * 1000),
        champion: champion ? { player_name: champion.player_name, location: champion.office, elapsed_ms: Math.round(champion.duration_seconds * 1000) } : null,
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
