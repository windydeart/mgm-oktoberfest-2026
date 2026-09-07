const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';

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
    let queryUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&order=duration_seconds.asc&limit=50&select=id,player_name,office,duration_seconds,created_at,player_email`;
    let reviewQueryUrl = `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?select=player_name,office,cell_index,status,reviewer_note,created_at`;
    let sessionQueryUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo_session&select=player_name,player_email`;
    
    if (location === 'danang' || location === 'hcmc') {
      queryUrl += `&office=eq.${location}`;
      reviewQueryUrl += `&office=eq.${location}`;
      sessionQueryUrl += `&office=eq.${location}`;
    }

    const [sbRes, revRes, sessRes] = await Promise.all([
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
      }),
      fetch(sessionQueryUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      })
    ]);

    if (!sbRes.ok) {
      return res.status(200).json({ leaderboard: [] });
    }

    const records = await sbRes.json();
    const reviews = revRes.ok ? await revRes.json() : [];
    const sessions = sessRes.ok ? await sessRes.json() : [];

    const sessionsByPlayer = new Map();
    for (const s of (sessions || [])) {
      const key = (s.player_name || '').trim().toLowerCase();
      try {
        const snap = JSON.parse(s.player_email || '{}');
        if (snap.started_at) sessionsByPlayer.set(key, snap.started_at);
      } catch (e) {}
    }

    // Group reviews by player key
    const reviewsByPlayer = new Map();
    for (const r of (reviews || [])) {
      const key = (r.player_name || '').trim().toLowerCase();
      if (!reviewsByPlayer.has(key)) reviewsByPlayer.set(key, []);
      reviewsByPlayer.get(key).push(r);
    }

    // Deduplicate scores: keep only best time per player
    const bestByPlayer = new Map();
    for (const record of (records || [])) {
      const key = (record.player_name || '').trim().toLowerCase();
      if (record.duration_seconds >= 9999) {
        const startedAt = sessionsByPlayer.get(key);
        const playerRevs = reviewsByPlayer.get(key) || [];
        const refTime = playerRevs.length > 0 && playerRevs[0].created_at
          ? new Date(playerRevs[0].created_at).getTime()
          : new Date(record.created_at).getTime();
        if (startedAt) {
          const startTime = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
          record.duration_seconds = Math.round(Math.max(1000, refTime - startTime) / 10) / 100;
        } else {
          record.duration_seconds = 15.0;
        }
      }
      if (!bestByPlayer.has(key) || record.duration_seconds < bestByPlayer.get(key).duration_seconds) {
        bestByPlayer.set(key, record);
      }
    }

    // Also collect rejected players from reviews who may not have a score record
    for (const [key, revs] of reviewsByPlayer.entries()) {
      const hasRejected = revs.some(r => r.status === 'rejected');
      if (hasRejected && !bestByPlayer.has(key)) {
        const sampleRev = revs.find(r => r.status === 'rejected') || revs[0];
        let calcDuration = 0;
        const startedAt = sessionsByPlayer.get(key);
        if (startedAt && sampleRev.created_at) {
          const startTime = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
          const photoTime = new Date(sampleRev.created_at).getTime();
          calcDuration = Math.round(Math.max(1000, photoTime - startTime) / 10) / 100;
        }
        bestByPlayer.set(key, {
          player_name: sampleRev.player_name,
          office: sampleRev.office || location,
          duration_seconds: calcDuration > 0 ? calcDuration : 15.0,
          created_at: sampleRev.created_at,
          player_email: JSON.stringify({ is_disqualified: true, review_status: 'rejected' })
        });
      }
    }

    // Classify each player into Ranking Tiers:
    // Tier 1 (Priority): BINGO + Approved (no pending, no rejected) -> eligible for Top 1 / Champion
    // Tier 2: BINGO + Pending review (no rejected)
    // Tier 3: Disqualified (bị loại do có ảnh bị reject) -> lowest on leaderboard
    const categorized = Array.from(bestByPlayer.values()).map(record => {
      const key = (record.player_name || '').trim().toLowerCase();
      const playerRevs = reviewsByPlayer.get(key) || [];

      let snapshot = {};
      if (record.player_email && typeof record.player_email === 'string' && record.player_email.startsWith('{')) {
        try { snapshot = JSON.parse(record.player_email); } catch (e) {}
      }

      const hasRejected = playerRevs.some(r => r.status === 'rejected') || snapshot.is_disqualified === true || snapshot.review_status === 'rejected';
      const hasPending = playerRevs.some(r => r.status === 'pending') || snapshot.review_status === 'pending';

      let tier = 2; // Default to pending BINGO
      let status = 'pending';
      let isDisqualified = false;

      if (hasRejected) {
        tier = 3; // Disqualified -> push to lowest
        status = 'rejected';
        isDisqualified = true;
      } else if (!hasPending && playerRevs.length > 0 && playerRevs.some(r => r.status === 'approved')) {
        tier = 1; // Approved BINGO
        status = 'approved';
      } else if (!hasPending && snapshot.review_status === 'approved') {
        tier = 1;
        status = 'approved';
      }

      return {
        ...record,
        tier,
        status,
        is_disqualified: isDisqualified
      };
    });

    // Sort: Tier 1 first (fastest time), then Tier 2 (fastest time), then Tier 3 (Disqualified) at the bottom
    categorized.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.duration_seconds !== b.duration_seconds) return a.duration_seconds - b.duration_seconds;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const uniqueRecords = categorized.slice(0, 10);

    const leaderboard = uniqueRecords.map((record, index) => ({
      rank: index + 1,
      player_name: record.player_name,
      location: record.office,
      elapsed_ms: Math.round(Math.max(1, record.duration_seconds >= 9999 ? 15 : (record.duration_seconds || 1)) * 1000),
      completed_at: record.created_at,
      status: record.status,
      is_disqualified: record.is_disqualified
    }));

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(200).json({ leaderboard: [] });
  }
};
