const { verifyAdminToken } = require('./auth');

const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from('c2Jfc2VjcmV0Xzd3NkZHN2xGTm5tQW5IZVQyTkRKX1FfMm9uTG1iamo=', 'base64').toString('utf-8');

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function supabaseRequest(method, path, body, useSecret = false) {
  const key = useSecret ? SUPABASE_SECRET_KEY : SUPABASE_KEY;
  const opts = {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  return res;
}

async function supabaseGet(path, useSecret = false) {
  const key = useSecret ? SUPABASE_SECRET_KEY : SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (!res.ok) throw new Error(`Supabase GET error: ${res.status} - ${await res.text()}`);
  return res.json();
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = verifyAdminToken(token);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { review_id, action, note } = body || {};

  // Handle Game Controller remote commands (start / pause / finish / waiting)
  const GAME_CTRL_ACTIONS = {
    'start': 'active',
    'pause': 'paused',
    'finish': 'finished',
    'waiting': 'waiting'
  };

  if (action && GAME_CTRL_ACTIONS[action]) {
    const newState = GAME_CTRL_ACTIONS[action];
    try {
      // 1. Fetch current control state to inspect prevState and current round_id
      let prevState = 'active';
      let currentRoundId = Date.now();
      try {
        const currentCtrlRes = await fetch(
          `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control&select=player_email&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SECRET_KEY,
              'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
            }
          }
        );
        if (currentCtrlRes.ok) {
          const rows = await currentCtrlRes.json();
          if (rows && rows.length > 0) {
            const snap = JSON.parse(rows[0].player_email || '{}');
            if (snap.state) prevState = snap.state;
            if (snap.round_id) currentRoundId = snap.round_id;
          }
        }
      } catch (e) {
        console.warn('Could not read prev game control state:', e);
      }

      // Reset occurs if restarting from finished or if explicit reset requested
      const shouldReset = (prevState === 'finished' && (newState === 'active' || newState === 'waiting')) || (body && body.reset_data === true);

      let newRoundId = currentRoundId;
      if (shouldReset) {
        newRoundId = Date.now();
        console.log(`Resetting all game data for fresh round ${newRoundId}...`);

        // 1. Delete all photo_bingo and photo_bingo_session scores
        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=in.(photo_bingo,photo_bingo_session)`,
            {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_SECRET_KEY,
                'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
              }
            }
          );
        } catch (delScoreErr) {
          console.error('Failed to wipe game scores on reset:', delScoreErr);
        }

        // 2. Delete all photo review entries
        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/bingo_photo_reviews?id=gt.0`,
            {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_SECRET_KEY,
                'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
              }
            }
          );
        } catch (delRevErr) {
          console.error('Failed to wipe photo reviews on reset:', delRevErr);
        }
      }

      // 2. Delete previous control state row
      await fetch(
        `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?player_name=eq.__game_control__&game_name=eq.game_control`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SECRET_KEY,
            'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
          }
        }
      );

      // 3. Insert new control state row
      const controlData = {
        state: newState,
        round_id: newRoundId,
        reset_at: shouldReset ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
        updated_by: 'admin'
      };

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SECRET_KEY,
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          player_name: '__game_control__',
          game_name: 'game_control',
          office: 'danang',
          score: 0,
          duration_seconds: 0,
          player_email: JSON.stringify(controlData)
        })
      });

      if (!insertRes.ok) {
        console.error('Failed to set game control in review-action:', await insertRes.text());
        return res.status(500).json({ error: 'Failed to update game control state.' });
      }

      const STATE_MESSAGES = {
        'active': shouldReset
          ? 'Game restarted fresh! All previous data has been reset.'
          : (prevState === 'paused' ? 'Game resumed — timers running again!' : 'Game started — all players can now play!'),
        'paused': 'Game paused — all player screens are frozen.',
        'finished': 'Game finished — all player screens show end message.',
        'waiting': shouldReset
          ? 'Game reset & set to waiting — all previous data reset.'
          : 'Game set to waiting — players cannot start until you press Start.'
      };

      return res.status(200).json({
        success: true,
        state: newState,
        round_id: newRoundId,
        was_reset: shouldReset,
        message: STATE_MESSAGES[newState],
        updated_at: controlData.updated_at
      });
    } catch (ctrlErr) {
      console.error('Game control execution error:', ctrlErr);
      return res.status(500).json({ error: 'Failed to set game control state.' });
    }
  }

  if (!review_id || !action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Missing review_id or invalid action (approve|reject).' });
  }

  try {
    // 1. Fetch the review record
    const reviews = await supabaseGet(`bingo_photo_reviews?id=eq.${review_id}&select=*`);
    if (!reviews.length) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    const review = reviews[0];

    if (review.status === 'rejected') {
      return res.status(400).json({ error: 'Once rejected, a submission cannot be re-approved. Rejections are final.' });
    }

    if (review.status === action) {
      return res.status(400).json({ error: `Review already ${review.status}.` });
    }

    // 2. If REJECT, check score duration for Phase 1 accumulation
    let phase1Ms = 0;
    if (action === 'reject') {
      try {
        const scores = await supabaseGet(
          `oktoberfest_game_scores?player_name=eq.${encodeURIComponent(review.player_name)}&game_name=eq.photo_bingo&select=duration_seconds&order=created_at.desc&limit=1`,
          true
        );
        if (scores && scores.length > 0 && scores[0].duration_seconds) {
          phase1Ms = Math.round(scores[0].duration_seconds * 1000);
        }
      } catch (e) {}
    }

    const noteText = note || (action === 'reject' ? 'Photo does not match the challenge requirement.' : 'Approved by organizer.');

    const updateData = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewer_note: noteText
    };

    // Retain photo_url in database and storage so organizers can inspect rejected photos in the admin dashboard

    const updateRes = await supabaseRequest(
      'PATCH',
      `bingo_photo_reviews?id=eq.${review_id}`,
      updateData,
      true // Use secret key for UPDATE
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Failed to update review:', errText);
      return res.status(500).json({ error: 'Failed to update review status.' });
    }

    // 3. If REJECT → handle leaderboard penalty
    if (action === 'reject') {
      await handleRejection(review);
    }

    return res.status(200).json({
      success: true,
      action,
      review_id,
      message: action === 'approve'
        ? `Photo approved for ${review.player_name}, cell ${review.cell_index + 1}.`
        : `Photo rejected for ${review.player_name}, cell ${review.cell_index + 1}. Player's BINGO may be invalidated.`
    });
  } catch (err) {
    console.error('Review action error:', err);
    return res.status(500).json({ error: 'Failed to process review action.' });
  }
};

async function handleRejection(review) {
  const { player_name, cell_index, session_id } = review;

  try {
    // Find the player's score record
    const scores = await supabaseGet(
      `oktoberfest_game_scores?player_name=eq.${encodeURIComponent(player_name)}&game_name=eq.photo_bingo&select=*&order=created_at.desc&limit=1`,
      true
    );

    if (!scores.length) {
      console.log(`No score record found for ${player_name}, nothing to invalidate.`);
      return;
    }

    const score = scores[0];

    // Parse snapshot from player_email
    let snapshot = null;
    try {
      snapshot = JSON.parse(score.player_email || '{}');
    } catch (e) {
      snapshot = {};
    }

    const completedCells = snapshot.completed_cells || [];
    const bingoLine = snapshot.bingo_line || null;

    // Check if the rejected cell is part of the winning BINGO line
    const BINGO_LINES = {
      'row-0': [0, 1, 2], 'row-1': [3, 4, 5], 'row-2': [6, 7, 8],
      'col-0': [0, 3, 6], 'col-1': [1, 4, 7], 'col-2': [2, 5, 8],
      'diag-main': [0, 4, 8], 'diag-anti': [2, 4, 6]
    };

    const winningCells = bingoLine ? (BINGO_LINES[bingoLine] || []) : [];
    const isInWinningLine = winningCells.includes(cell_index);

    if (isInWinningLine) {
      // BINGO is invalidated — DELETE the score record
      console.log(`Rejecting cell ${cell_index} invalidates BINGO line ${bingoLine} for ${player_name}. Deleting score.`);

      const deleteRes = await supabaseRequest(
        'DELETE',
        `oktoberfest_game_scores?player_name=eq.${encodeURIComponent(player_name)}&game_name=eq.photo_bingo`,
        null,
        true
      );

      if (!deleteRes.ok) {
        console.error('Failed to delete score:', await deleteRes.text());
      } else {
        console.log(`Score record ${score.id} deleted for ${player_name}.`);
      }
    } else {
      // Cell is not in the winning line, just update the snapshot
      console.log(`Rejected cell ${cell_index} is NOT in winning line ${bingoLine} for ${player_name}. Updating snapshot only.`);

      // Remove cell from completed_cells in snapshot
      const updatedCompleted = completedCells.filter(c => c !== cell_index);
      snapshot.completed_cells = updatedCompleted;

      // Remove from cell_photos and cell_ai_reasons
      if (snapshot.cell_photos) delete snapshot.cell_photos[String(cell_index)];
      if (snapshot.cell_ai_reasons) delete snapshot.cell_ai_reasons[String(cell_index)];

      const patchRes = await supabaseRequest(
        'PATCH',
        `oktoberfest_game_scores?id=eq.${score.id}`,
        { player_email: JSON.stringify(snapshot) },
        true
      );

      if (!patchRes.ok) {
        console.error('Failed to update snapshot:', await patchRes.text());
      }
    }
  } catch (err) {
    console.error('Rejection handling error:', err);
  }
}
