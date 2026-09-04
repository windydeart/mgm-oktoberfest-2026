const { verifyAdminToken } = require('./auth');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = verifyAdminToken(token);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const status = url.searchParams.get('status') || 'pending';
  const location = url.searchParams.get('location') || 'all';
  const playerName = url.searchParams.get('player_name') || '';

  try {
    let queryUrl = `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?select=id,session_id,player_name,office,cell_index,challenge_text,photo_url,ai_reason,status,reviewer_note,reviewed_at,created_at&order=created_at.desc`;

    if (status !== 'all') {
      queryUrl += `&status=eq.${status}`;
    }
    if (location === 'danang' || location === 'hcmc') {
      queryUrl += `&office=eq.${location}`;
    }
    if (playerName) {
      queryUrl += `&player_name=ilike.*${encodeURIComponent(playerName.trim())}*`;
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    // Parallel fetch: reviews + official leaderboard scores
    const [reviewsRes, scoresRes] = await Promise.all([
      fetch(queryUrl, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&select=player_name,office,duration_seconds,created_at&order=duration_seconds.asc`, { headers })
    ]);

    if (!reviewsRes.ok) {
      const errText = await reviewsRes.text();
      if (errText.includes('does not exist') || errText.includes('PGRST205')) {
        return res.status(200).json({ success: true, reviews: [], total: 0 });
      }
      console.error('Supabase reviews query error:', errText);
      return res.status(500).json({ error: 'Failed to load reviews.' });
    }

    const rawReviews = await reviewsRes.json();
    let rawScores = [];
    if (scoresRes.ok) {
      try { rawScores = await scoresRes.json(); } catch (e) { rawScores = []; }
    }

    // 1. Build rank maps for overall and by office
    // Each unique player's best (fastest) duration
    const playerBestOverall = new Map();
    const playerBestOffice = { danang: new Map(), hcmc: new Map() };

    for (const s of rawScores) {
      const pName = (s.player_name || '').trim();
      const pNameLower = pName.toLowerCase();
      const office = (s.office || '').trim().toLowerCase();
      const dur = parseFloat(s.duration_seconds) || 999999;

      if (!playerBestOverall.has(pNameLower) || dur < playerBestOverall.get(pNameLower).duration) {
        playerBestOverall.set(pNameLower, { player_name: pName, office, duration: dur, created_at: s.created_at });
      }

      if (playerBestOffice[office]) {
        if (!playerBestOffice[office].has(pNameLower) || dur < playerBestOffice[office].get(pNameLower).duration) {
          playerBestOffice[office].set(pNameLower, { player_name: pName, office, duration: dur, created_at: s.created_at });
        }
      }
    }

    // Sort to determine official Rank
    const sortedOverall = Array.from(playerBestOverall.values()).sort((a, b) => a.duration - b.duration);
    const overallRankMap = new Map();
    sortedOverall.forEach((item, idx) => {
      overallRankMap.set(item.player_name.trim().toLowerCase(), {
        rank: idx + 1,
        duration: item.duration
      });
    });

    const officeRankMap = { danang: new Map(), hcmc: new Map() };
    ['danang', 'hcmc'].forEach(off => {
      const sorted = Array.from(playerBestOffice[off].values()).sort((a, b) => a.duration - b.duration);
      sorted.forEach((item, idx) => {
        officeRankMap[off].set(item.player_name.trim().toLowerCase(), {
          rank: idx + 1,
          duration: item.duration
        });
      });
    });

    // 2. Attach rank & elapsed time to each review
    const enrichedReviews = rawReviews.map(r => {
      const pNameLower = (r.player_name || '').trim().toLowerCase();
      const office = (r.office || '').trim().toLowerCase();

      const overallData = overallRankMap.get(pNameLower);
      const officeData = officeRankMap[office] ? officeRankMap[office].get(pNameLower) : null;

      // When filtering by specific location, use office rank; if 'all', use overall rank (or office rank)
      const selectedRankData = (location === 'danang' || location === 'hcmc') ? officeData : (overallData || officeData);
      
      const rank = selectedRankData ? selectedRankData.rank : null;
      const durationSeconds = selectedRankData ? selectedRankData.duration : null;

      return {
        ...r,
        rank: rank, // e.g. 1, 2, 3, etc. or null
        overall_rank: overallData ? overallData.rank : null,
        duration_seconds: durationSeconds,
        elapsed_ms: durationSeconds ? Math.round(durationSeconds * 1000) : null
      };
    });

    // 3. Sort prioritized reviews:
    // - Top 10 Ranked players come FIRST, sorted in order of Rank (Rank #1 first, then Rank #2, #3, ...)
    // - Within the same player: sort by cell_index ascending
    // - Non-ranked / in-progress players come after Top 10, sorted by newest submission (created_at DESC)
    enrichedReviews.sort((a, b) => {
      const rankA = (a.rank !== null && a.rank !== undefined) ? a.rank : 999999;
      const rankB = (b.rank !== null && b.rank !== undefined) ? b.rank : 999999;

      if (rankA !== rankB) {
        return rankA - rankB; // Rank 1, 2, 3... first
      }

      // Same rank / same player
      if (rankA < 999999) {
        if (a.cell_index !== b.cell_index) {
          return (a.cell_index || 0) - (b.cell_index || 0);
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      // Both unranked: newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      reviews: enrichedReviews,
      total: enrichedReviews.length
    });
  } catch (err) {
    console.error('Reviews error:', err);
    return res.status(500).json({ error: 'Failed to load reviews.' });
  }
};
