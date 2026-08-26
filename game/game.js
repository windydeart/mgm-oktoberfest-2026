/**
 * mgm Oktoberfest 2026 — Photo Bingo Mini-Game Engine
 * ══════════════════════════════════════════════════════
 * Flat icons, 4x camera watermark, frozen completion reload state,
 * waving line highlights, Grand Winner prize highlights, and anti-cheat timer.
 */

(function () {
  'use strict';

  /* ─── CONSTANTS & FLAT ICON MAPPINGS ─── */
  const API_BASE = '/api/game';
  const SUPABASE_URL = 'https://jijngdphviddhdtnyhwr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm';
  const BINGO_LINE_NAMES = {
    'row-0': 'Row 1 (Top)', 'row-1': 'Row 2 (Middle)', 'row-2': 'Row 3 (Bottom)',
    'col-0': 'Column 1 (Left)', 'col-1': 'Column 2 (Center)', 'col-2': 'Column 3 (Right)',
    'diag-main': 'Diagonal ↘', 'diag-anti': 'Diagonal ↙'
  };

  const CATEGORY_ICONS = {
    'Beer': 'beer',
    'Food': 'utensils',
    'Outfit': 'shirt',
    'People': 'user',
    'Party': 'party-popper',
    'Funny': 'smile',
    'Around the Venue': 'map-pin',
    'Team Building': 'users'
  };

  /* ─── GAME STATE ─── */
  let gameState = {
    sessionId: null,
    sessionToken: null,
    playerName: '',
    location: 'danang',
    challenges: [],
    completedCells: [],
    status: 'idle', // 'idle' | 'playing' | 'completed'
    startedAt: null,
    elapsedMs: null,
    bingoLine: null,
    rank: null
  };

  /* ─── TIMER ─── */
  let timerInterval = null;
  let timerStartTime = null;

  /* ─── CAMERA ─── */
  let cameraStream = null;
  let currentCellIndex = null;
  let facingMode = 'environment';
  /* ─── ACTIVE STORAGE RESET (BUMP TO V3) ─── */
  const STORAGE_KEY_TOKEN = 'bingo_session_token_v4';
  const STORAGE_KEY_STATE = 'bingo_game_state_v4';

  try {
    ['bingo_session_token', 'bingo_game_state', 'bingo_session_token_v2', 'bingo_game_state_v2', 'bingo_session_token_v3', 'bingo_game_state_v3'].forEach(k => {
      localStorage.removeItem(k);
    });
  } catch (e) {}

  /* ─── DOM SELECTORS ─── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {};
  function cacheDom() {
    // Welcome Overlay & Board
    els.gameWelcome = $('#gameWelcome');
    els.bingoBoard = $('#bingoBoard');
    els.startGameBtn = $('#startGameBtn');
    els.welcomeLeaderboardBtn = $('#welcomeLeaderboardBtn');

    // Status bar & User header
    els.headerUserLine = $('#headerUserLine');
    els.headerPulseDot = $('#headerPulseDot');
    els.gameStatusBar = $('#gameStatusBar');
    els.statusPlayerName = $('#statusPlayerName');
    els.statusLocation = $('#statusLocation');
    els.statusRankPill = $('#statusRankPill');
    els.statusRankText = $('#statusRankText');
    els.statusProgressPill = $('#statusProgressPill');
    els.statusProgress = $('#statusProgress');
    els.statusGoalPill = $('#statusGoalPill');
    els.statusGoalText = $('#statusGoalText');

    // Player Registration Modal
    els.playerModal = $('#playerModal');
    els.closePlayerModal = $('#closePlayerModal');
    els.playerForm = $('#playerForm');
    els.playerName = $('#playerName');
    els.playerNameStatusHint = $('#playerNameStatusHint');
    els.submitPlayerBtn = $('#submitPlayerBtn');

    // Stopwatch
    els.gameTimer = $('#gameTimer');
    els.timerDisplay = $('#timerDisplay');

    // Camera Overlay
    els.cameraOverlay = $('#cameraOverlay');
    els.cameraVideo = $('#cameraVideo');
    els.cameraIcon = $('#cameraIcon');
    els.cameraChallenge = $('#cameraChallenge');
    els.cameraControls = $('#cameraControls');
    els.cameraShutterBtn = $('#cameraShutterBtn');
    els.cameraCancelBtn = $('#cameraCancelBtn');
    els.cameraSwitchBtn = $('#cameraSwitchBtn');
    els.cameraPreview = $('#cameraPreview');
    els.previewImage = $('#previewImage');
    els.retakeBtn = $('#retakeBtn');
    els.submitPhotoBtn = $('#submitPhotoBtn');
    els.cameraConfirmOverlay = $('#cameraConfirmOverlay');
    els.cancelSubmitPhotoBtn = $('#cancelSubmitPhotoBtn');
    els.proceedSubmitPhotoBtn = $('#proceedSubmitPhotoBtn');
    els.cameraLoading = $('#cameraLoading');
    els.cameraResult = $('#cameraResult');
    els.resultIcon = $('#resultIcon');
    els.resultText = $('#resultText');
    els.cameraCanvas = $('#cameraCanvas');

    // Winner Showcase Modal
    els.winnerShowcaseModal = $('#winnerShowcaseModal');
    els.closeWinnerShowcaseBtn = $('#closeWinnerShowcaseBtn');
    els.winnerCloseBtn = $('#winnerCloseBtn');
    els.winnerPlayerName = $('#winnerPlayerName');
    els.winnerLocationBadge = $('#winnerLocationBadge');
    els.winnerTimeBadge = $('#winnerTimeBadge');
    els.winnerLineBadge = $('#winnerLineBadge');
    els.winnerMiniBoard = $('#winnerMiniBoard');

    // Victory Modal
    els.victoryModal = $('#victoryModal');
    els.victoryTime = $('#victoryTime');
    els.victoryRank = $('#victoryRank');
    els.victoryLine = $('#victoryLine');
    els.victoryLeaderboardBtn = $('#victoryLeaderboardBtn');
    els.victoryBackGameBtn = $('#victoryBackGameBtn');
    els.bingoBoardFrame = $('#bingoBoardFrame');

    // Leaderboard Modal
    els.leaderboardModal = $('#leaderboardModal');
    els.leaderboardToggleBtn = $('#leaderboardToggleBtn');
    els.closeLeaderboardBtn = $('#closeLeaderboardBtn');
    els.leaderboardTabs = $('#leaderboardTabs');
    els.leaderboardTableBody = $('#leaderboardTableBody');
    els.leaderboardEmpty = $('#leaderboardEmpty');

    // Sidebar
    els.sidebarLbList = $('#sidebarLbList');
    els.sidebarViewAllBtn = $('#sidebarViewAllBtn');

    // Photo Detail & Review Modal
    els.photoReviewModal = $('#photoReviewModal');
    els.closePhotoReviewBtn = $('#closePhotoReviewBtn');
    els.photoReviewCloseBtn = $('#photoReviewCloseBtn');

    // Toast Container
    els.toastContainer = $('#gameToastContainer');
  }

  /* ═══════════════════════════════════════════════════════
     MODAL CONTROLS
     ═══════════════════════════════════════════════════════ */
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ═══════════════════════════════════════════════════════
     TOAST NOTIFICATIONS (100% English)
     ═══════════════════════════════════════════════════════ */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <span class="toast-msg">${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;
    els.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const dismiss = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  /* ═══════════════════════════════════════════════════════
     TIMER ENGINE
     ═══════════════════════════════════════════════════════ */
  function startTimer() {
    timerStartTime = typeof gameState.startedAt === 'number' ? gameState.startedAt : new Date(gameState.startedAt).getTime();
    els.gameTimer.classList.add('timer-running');
    els.gameTimer.classList.remove('timer-idle', 'timer-stopped');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - timerStartTime;
      els.timerDisplay.textContent = formatTime(elapsed);
    }, 41);
  }

  function stopTimer(finalMs) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    els.gameTimer.classList.remove('timer-running');
    els.gameTimer.classList.add('timer-stopped');
    if (finalMs != null) {
      els.timerDisplay.textContent = formatTime(finalMs);
    }
  }

  function resetTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    els.timerDisplay.textContent = '00:00.00';
    els.gameTimer.classList.remove('timer-running', 'timer-stopped');
    els.gameTimer.classList.add('timer-idle');
  }

  function formatTime(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const cents = Math.floor(((ms || 0) % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
  }

  /* ═══════════════════════════════════════════════════════
     BINGO HELPER
     ═══════════════════════════════════════════════════════ */
  function checkBingo(cells) {
    if (!cells || !cells.length) return null;
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

  function getBingoLineIndices(lineKey) {
    const map = {
      'row-0': [0,1,2], 'row-1': [3,4,5], 'row-2': [6,7,8],
      'col-0': [0,3,6], 'col-1': [1,4,7], 'col-2': [2,5,8],
      'diag-main': [0,4,8], 'diag-anti': [2,4,6]
    };
    return map[lineKey] || null;
  }

  /* ═══════════════════════════════════════════════════════
     BINGO BOARD RENDERING (Flat Icons + 4x Camera Watermark)
     ═══════════════════════════════════════════════════════ */
  function renderBoard() {
    const cells = $$('.bingo-cell');
    const winningLine = gameState.bingoLine || checkBingo(gameState.completedCells || []);
    const winningIndices = winningLine ? getBingoLineIndices(winningLine) : [];

    cells.forEach((cell, i) => {
      const challenge = gameState.challenges[i];
      if (!challenge) return;

      const catIcon = CATEGORY_ICONS[challenge.category] || 'camera';
      
      // 1. Top row: Icon (left) and Done (right)
      const iconSpan = cell.querySelector('.cell-cat-icon');
      if (iconSpan) {
        iconSpan.innerHTML = `<i data-lucide="${catIcon}"></i>`;
      }

      // 2. Center: Challenge text
      const textP = cell.querySelector('.cell-challenge-text');
      if (textP) {
        textP.textContent = challenge.challenge;
      }

      // 3. Completed State & Translucent Photo Background
      if (gameState.completedCells.includes(i)) {
        cell.classList.remove('cell-unfilled', 'cell-inactive', 'cell-locked');
        cell.classList.add('completed');
        if (gameState.pendingReviewCells && gameState.pendingReviewCells.includes(i)) {
          cell.classList.add('pending-review');
        } else {
          cell.classList.remove('pending-review');
        }
        const photoUrl = gameState.cellPhotos && gameState.cellPhotos[i];
        if (photoUrl) {
          cell.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.45), rgba(11, 19, 43, 0.70)), url('${photoUrl}')`;
          cell.style.backgroundSize = 'cover';
          cell.style.backgroundPosition = 'center';
        }
        const hint = cell.querySelector('.cell-tap-hint');
        if (hint) hint.textContent = '';
      } else {
        cell.classList.remove('completed', 'pending-review', 'cell-locked');
        cell.style.backgroundImage = '';
        const hint = cell.querySelector('.cell-tap-hint');
        if (gameState.status === 'completed') {
          cell.classList.add('cell-unfilled');
          cell.classList.remove('cell-inactive');
          if (hint) hint.textContent = '';
        } else {
          cell.classList.remove('cell-unfilled', 'cell-inactive');
          if (hint) hint.textContent = 'Tap to Snap';
        }
      }

      // 4. Winning Line Highlight (waving pulse)
      if (winningIndices && winningIndices.includes(i)) {
        cell.classList.add('bingo-line-cell');
      } else {
        cell.classList.remove('bingo-line-cell');
      }
    });

    // Update Status Bar & User Header Line
    if (gameState.status === 'playing' || gameState.status === 'completed') {
      if (els.headerUserLine) els.headerUserLine.style.display = 'inline-flex';
      if (els.gameStatusBar) els.gameStatusBar.style.display = 'inline-flex';
      if (els.statusPlayerName) els.statusPlayerName.textContent = gameState.playerName || 'Player';
      if (els.statusLocation) els.statusLocation.textContent = gameState.location === 'danang' ? 'Da Nang' : 'HCMC';
      if (els.statusProgress) els.statusProgress.textContent = `${gameState.completedCells.length} / 9 Completed`;

      const rankStr = gameState.rank ? `#${gameState.rank}` : (gameState.status === 'completed' ? '#1' : '#--');
      if (els.statusRankText) els.statusRankText.textContent = `Rank ${rankStr}`;

      if (els.statusGoalPill) {
        if (gameState.status === 'completed') {
          els.statusGoalPill.style.display = 'inline-flex';
          if (els.statusGoalText) els.statusGoalText.textContent = 'BINGO Achieved!';
        } else {
          els.statusGoalPill.style.display = 'none';
        }
      }
    } else {
      if (els.headerUserLine) els.headerUserLine.style.display = 'none';
      if (els.gameStatusBar) els.gameStatusBar.style.display = 'none';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function runRevealAnimation() {
    return new Promise((resolve) => {
      const cells = $$('.bingo-cell');
      cells.forEach((cell, i) => {
        cell.classList.add('revealing');
        setTimeout(() => {
          cell.classList.remove('revealing');
          cell.classList.add('revealed');
          const challenge = gameState.challenges[i];
          if (challenge) {
            const catIcon = CATEGORY_ICONS[challenge.category] || 'camera';
            const iconSpan = cell.querySelector('.cell-cat-icon');
            if (iconSpan) iconSpan.innerHTML = `<i data-lucide="${catIcon}"></i>`;
            const textP = cell.querySelector('.cell-challenge-text');
            if (textP) textP.textContent = challenge.challenge;
          }
        }, 150 + i * 120);
      });
      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
        resolve();
      }, 150 + 9 * 120 + 200);
    });
  }

  /* ═══════════════════════════════════════════════════════
     LIVE REAL-TIME NAME AVAILABILITY CHECKER
     ═══════════════════════════════════════════════════════ */
  let nameCheckDebounceTimer = null;
  let isCurrentNameTaken = false;

  async function checkNameAvailability(name) {
    const trimmed = (name || '').trim();
    if (trimmed.length < 2) {
      isCurrentNameTaken = false;
      if (els.playerNameStatusHint) {
        els.playerNameStatusHint.style.display = 'none';
        els.playerNameStatusHint.className = 'name-status-hint';
        els.playerNameStatusHint.textContent = '';
      }
      if (els.playerName) {
        els.playerName.classList.remove('input-status-taken', 'input-status-available');
      }
      return;
    }

    if (els.playerNameStatusHint) {
      els.playerNameStatusHint.style.display = 'flex';
      els.playerNameStatusHint.className = 'name-status-hint status-checking';
      els.playerNameStatusHint.innerHTML = '<span class="spinner-small" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span> Checking availability...';
    }

    try {
      const sbUrl = `${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=ilike.${encodeURIComponent(trimmed)}&select=id,player_name&limit=1`;
      const res = await fetch(sbUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (els.playerName && els.playerName.value.trim() !== trimmed) return;

      if (res.ok) {
        const records = await res.json();
        const isTaken = records && records.length > 0;

        if (isTaken) {
          isCurrentNameTaken = true;
          if (els.playerNameStatusHint) {
            els.playerNameStatusHint.style.display = 'flex';
            els.playerNameStatusHint.className = 'name-status-hint status-taken';
            els.playerNameStatusHint.innerHTML = '<i data-lucide="x-circle"></i> <span>Name already taken. Please choose another name.</span>';
          }
          if (els.playerName) {
            els.playerName.classList.add('input-status-taken');
            els.playerName.classList.remove('input-status-available');
          }
        } else {
          isCurrentNameTaken = false;
          if (els.playerNameStatusHint) {
            els.playerNameStatusHint.style.display = 'flex';
            els.playerNameStatusHint.className = 'name-status-hint status-available';
            els.playerNameStatusHint.innerHTML = '<i data-lucide="check-circle-2"></i> <span>Name is available</span>';
          }
          if (els.playerName) {
            els.playerName.classList.add('input-status-available');
            els.playerName.classList.remove('input-status-taken');
          }
        }
        if (window.lucide) window.lucide.createIcons();
      }
    } catch (e) {
      console.warn('Name availability check error:', e);
    }
  }

  /* ═══════════════════════════════════════════════════════
     GAME FLOW
     ═══════════════════════════════════════════════════════ */
  function onStartGame() {
    isCurrentNameTaken = false;
    if (els.playerNameStatusHint) {
      els.playerNameStatusHint.style.display = 'none';
      els.playerNameStatusHint.className = 'name-status-hint';
      els.playerNameStatusHint.textContent = '';
    }
    if (els.playerName) {
      els.playerName.classList.remove('input-status-taken', 'input-status-available');
    }
    openModal(els.playerModal);
    setTimeout(() => els.playerName?.focus(), 200);
    detectLocation();
  }

  async function onPlayerSubmit(e) {
    e.preventDefault();

    const name = (els.playerName.value || '').trim();
    if (name.length < 2 || name.length > 30) {
      showToast('Please enter a player name between 2 and 30 characters.', 'error');
      els.playerName.classList.add('shake');
      setTimeout(() => els.playerName.classList.remove('shake'), 500);
      return;
    }

    if (isCurrentNameTaken) {
      showToast(`The name "${name}" is already registered. Please choose another name.`, 'error');
      els.playerName.classList.add('shake');
      setTimeout(() => els.playerName.classList.remove('shake'), 500);
      els.playerName.focus();
      return;
    }

    els.submitPlayerBtn.querySelector('.btn-text').style.display = 'none';
    els.submitPlayerBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    els.submitPlayerBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: name,
          location: gameState.location
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start game session.');
      }

      gameState.sessionId = data.session_id;
      gameState.sessionToken = data.session_token;
      gameState.playerName = name;
      gameState.challenges = data.challenges;
      gameState.startedAt = data.started_at;
      gameState.completedCells = [];
      gameState.status = 'playing';
      gameState.bingoLine = null;
      gameState.elapsedMs = null;
      gameState.rank = null;

      saveSession();

      closeModal(els.playerModal);
      
      // Smooth frame switch from Welcome to 3x3 Grid
      els.gameWelcome.style.display = 'none';
      els.bingoBoard.style.display = 'grid';

      await runRevealAnimation();
      renderBoard();
      startTimer();
      showToast('Game started! Tap any cell to take a photo.', 'success');

    } catch (err) {
      showToast(err.message || 'Server connection error. Please try again.', 'error');
    } finally {
      els.submitPlayerBtn.querySelector('.btn-text').style.display = '';
      els.submitPlayerBtn.querySelector('.btn-loading').style.display = 'none';
      els.submitPlayerBtn.disabled = false;
    }
  }

  function onCellTap(cellIndex) {
    if (gameState.status !== 'playing' && gameState.status !== 'completed') {
      onStartGame();
      return;
    }

    // If cell is already completed or in-review -> Open Photo Detail & Review Modal!
    if (gameState.completedCells.includes(cellIndex)) {
      openPhotoReview(cellIndex);
      return;
    }

    // If game is completed (Bingo achieved), lock non-completed cells from taking new photos!
    if (gameState.status === 'completed') {
      showToast('Game finished! You already achieved BINGO!', 'info', 3000);
      return;
    }

    currentCellIndex = cellIndex;
    const challenge = gameState.challenges[cellIndex];
    if (challenge) {
      const catIcon = CATEGORY_ICONS[challenge.category] || 'camera';
      els.cameraIcon.innerHTML = `<i data-lucide="${catIcon}"></i>`;
      els.cameraChallenge.textContent = challenge.challenge;
      if (window.lucide) window.lucide.createIcons();
    }

    openCamera();
  }

      function sanitizeAiReason(reason) {
    if (!reason || typeof reason !== 'string') return reason;
    return reason
      .replace(/\s*(?:please\s+)?(?:try\s+again|retake(?:\s+the\s+photo)?|re-take|resubmit)[^.!?]*(?:[.!?]|$)/gi, '')
      .trim();
  }

  function openPhotoReview(cellIndex) {
    const challenge = gameState.challenges[cellIndex];
    if (!challenge) return;

    const isPending = gameState.pendingReviewCells && gameState.pendingReviewCells.includes(cellIndex);
    const photoUrl = (gameState.cellPhotos && gameState.cellPhotos[cellIndex]) || '';
    const rawAiReason = (gameState.cellAiReasons && gameState.cellAiReasons[cellIndex]) || (isPending ? 'AI could not automatically verify your photo. Submitted for manual review by organizers.' : 'Challenge approved by AI photo engine.');
    const aiReason = sanitizeAiReason(rawAiReason);

    const catIcon = CATEGORY_ICONS[challenge.category] || 'camera';
    const iconSpan = $('#photoReviewCatIcon');
    if (iconSpan) iconSpan.innerHTML = `<i data-lucide="${catIcon}"></i>`;

    const challengeText = $('#photoReviewChallengeText');
    if (challengeText) challengeText.textContent = challenge.challenge;

    const img = $('#photoReviewImg');
    if (img) {
      img.src = photoUrl || '';
      img.style.display = photoUrl ? 'block' : 'none';
    }

    const pill = $('#photoReviewStatusPill');
    const aiBox = $('#photoReviewAiBox');
    const aiTitle = $('#photoReviewAiTitle');
    const aiReasonEl = $('#photoReviewAiReason');
    const aiTip = $('#photoReviewAiTip');

    if (isPending) {
      if (pill) {
        pill.className = 'photo-review-status-pill status-pending';
        pill.innerHTML = '<i data-lucide="clock"></i> <span>IN REVIEW</span>';
      }
      if (aiBox) aiBox.className = 'photo-review-ai-box';
      if (aiTitle) aiTitle.textContent = 'AI Reason for IN REVIEW';
      if (aiReasonEl) aiReasonEl.textContent = aiReason;
      if (aiTip) aiTip.innerHTML = '<i data-lucide="info"></i> <span>The Organizing Committee will review and verify this photo during prize evaluation.</span>';
    } else {
      if (pill) {
        pill.className = 'photo-review-status-pill status-done';
        pill.innerHTML = '<i data-lucide="check-circle-2"></i> <span>DONE</span>';
      }
      if (aiBox) aiBox.className = 'photo-review-ai-box is-approved';
      if (aiTitle) aiTitle.textContent = 'AI Assessment';
      if (aiReasonEl) aiReasonEl.textContent = aiReason;
      if (aiTip) aiTip.innerHTML = '<i data-lucide="check"></i> <span>Photo verified and matched challenge requirements!</span>';
    }

    openModal($('#photoReviewModal'));
    if (window.lucide) window.lucide.createIcons();
  }

    function createThumbnail(dataUrl, maxWidth = 260) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / Math.max(img.width, img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function capturePhoto() {
    const video = els.cameraVideo;
    const canvas = els.cameraCanvas;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // High speed compact JPEG (~25KB for instant transmission)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    els.previewImage.src = dataUrl;

    els.cameraControls.style.display = 'none';
    els.cameraPreview.style.display = 'flex';
  }

    /* ═══════════════════════════════════════════════════════
     PROMOTE CELL TO IN REVIEW (Organizers manual verify)
     ═══════════════════════════════════════════════════════ */
  function promoteToPendingReview(targetIdx, dataUrl, challenge) {
    const targetCell = $$('.bingo-cell')[targetIdx];
    if (!targetCell) return;

    targetCell.classList.remove('verifying');
    targetCell.classList.add('completed', 'pending-review');
    targetCell.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.45), rgba(11, 19, 43, 0.70)), url('${dataUrl}')`;
    const hint = targetCell.querySelector('.cell-tap-hint');
    if (hint) hint.textContent = '';

    if (!gameState.completedCells.includes(targetIdx)) {
      gameState.completedCells.push(targetIdx);
    }
    if (!gameState.pendingReviewCells) gameState.pendingReviewCells = [];
    if (!gameState.pendingReviewCells.includes(targetIdx)) {
      gameState.pendingReviewCells.push(targetIdx);
    }
    if (!gameState.cellPhotos) gameState.cellPhotos = {};
    gameState.cellPhotos[targetIdx] = dataUrl;
    if (!gameState.cellAiReasons) gameState.cellAiReasons = {};
    if (!gameState.cellAiReasons[targetIdx]) {
      gameState.cellAiReasons[targetIdx] = 'AI could not automatically verify your photo. Submitted for manual review by organizers.';
    }

    if (window.lucide) window.lucide.createIcons();

    // Check if this pending review cell achieves BINGO!
    const bingoLine = checkBingo(gameState.completedCells);
    if (bingoLine && gameState.status !== 'completed') {
      const elapsedMs = Date.now() - (gameState.startedAt || Date.now());
      const data = {
        is_bingo: true,
        bingo_line: bingoLine,
        elapsed_ms: elapsedMs,
        rank: gameState.rank || 1,
        pending_review: true
      };
      saveSession();
      onBingo(data);
    } else {
      saveSession();
      showToast('Photo submitted! Marked as IN REVIEW for organizers.', 'info', 4000);
    }
  }

      async function submitPhoto() {
    const dataUrl = els.previewImage.src;
    const base64 = dataUrl.split(',')[1];
    const targetIdx = currentCellIndex;
    const challenge = gameState.challenges[targetIdx];

    // ─── 1. Instantly close camera & unblock player ───
    closeCamera();

    // ─── 2. Set cell into Verifying state immediately ───
    const targetCell = $$('.bingo-cell')[targetIdx];
    if (targetCell) {
      targetCell.classList.add('verifying');
      targetCell.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.45), rgba(11, 19, 43, 0.70)), url('${dataUrl}')`;
      const hint = targetCell.querySelector('.cell-tap-hint');
      if (hint) hint.textContent = 'Verifying photo...';
      if (window.lucide) window.lucide.createIcons();
    }

    showToast('Photo submitted! AI is verifying in background...', 'info', 2200);

    let hasResolved = false;

    // ─── 3. Automatic 5.5-Second Timer -> Fail-open to IN REVIEW ───
    const fallbackTimer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        promoteToPendingReview(targetIdx, dataUrl, challenge);
      }
    }, 5500);

    // ─── 4. Background Asynchronous Verification ───
    try {
      const res = await fetch(`${API_BASE}/submit-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: gameState.sessionToken,
          cell_index: targetIdx,
          photo_base64: base64
        })
      });

      clearTimeout(fallbackTimer);

      const rawText = await res.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        data = { verified: true, pending_review: true, ai_reason: 'Photo submitted. Queued for manual review by organizers.' };
      }

      hasResolved = true;

      if (data.session_token) {
        gameState.sessionToken = data.session_token;
      }
      if (!gameState.cellAiReasons) gameState.cellAiReasons = {};
      gameState.cellAiReasons[targetIdx] = data.ai_reason || data.reason || (data.pending_review ? 'Photo queued for manual review.' : 'Challenge approved!');

      if (data.pending_review) {
        promoteToPendingReview(targetIdx, data.photo_url || dataUrl, challenge);
      } else {
        // AI Approved directly
        if (!gameState.completedCells.includes(targetIdx)) {
          gameState.completedCells.push(targetIdx);
        }
        if (gameState.pendingReviewCells) {
          gameState.pendingReviewCells = gameState.pendingReviewCells.filter(id => id !== targetIdx);
        }
        if (!gameState.cellPhotos) gameState.cellPhotos = {};
        gameState.cellPhotos[targetIdx] = data.photo_url || dataUrl;

        if (targetCell) {
          targetCell.classList.remove('verifying', 'pending-review');
          targetCell.classList.add('completed');
          targetCell.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.45), rgba(11, 19, 43, 0.70)), url('${data.photo_url || dataUrl}')`;
          const hint = targetCell.querySelector('.cell-tap-hint');
          if (hint) hint.textContent = '';
          if (window.lucide) window.lucide.createIcons();
        }

        if (data.is_bingo) {
          gameState.status = 'completed';
          gameState.elapsedMs = data.elapsed_ms;
          gameState.bingoLine = data.bingo_line;
          gameState.rank = data.rank || 1;
          saveSession();
          onBingo(data);
        } else {
          saveSession();
          showToast(`Challenge approved: ${challenge?.challenge || 'Cell completed!'}`, 'success', 3000);
        }
      }

    } catch (err) {
      if (!hasResolved) {
        clearTimeout(fallbackTimer);
        hasResolved = true;
        promoteToPendingReview(targetIdx, dataUrl, challenge);
      }
    }
  }

      /* ═══════════════════════════════════════════════════════
     PRECISION TAPERED LASER CUT SLICE (Sharp Tips, Gold Bloom)
     ═══════════════════════════════════════════════════════ */
  function triggerLaserCut(lineKey) {
    const laserSvg = $('#bingoLaserSvg');
    const glowPath = $('#bingoLaserGlowPath');
    const corePath = $('#bingoLaserCorePath');
    const laserHead = $('#bingoLaserHead');
    const frame = els.bingoBoardFrame || $('#bingoBoardFrame');
    if (!laserSvg || !glowPath || !corePath || !frame) return;

    const lineMap = {
      'row-0': [0, 2], 'row-1': [3, 5], 'row-2': [6, 8],
      'col-0': [0, 6], 'col-1': [1, 7], 'col-2': [2, 8],
      'diag-main': [0, 8], 'diag-anti': [2, 6]
    };

    const indices = lineMap[lineKey] || [0, 2];
    const cells = $$('.bingo-cell');
    const cellA = cells[indices[0]];
    const cellB = cells[indices[1]];
    if (!cellA || !cellB) return;

    const frameRect = frame.getBoundingClientRect();
    const rectA = cellA.getBoundingClientRect();
    const rectB = cellB.getBoundingClientRect();

    const x1 = (rectA.left + rectA.right) / 2 - frameRect.left;
    const y1 = (rectA.top + rectA.bottom) / 2 - frameRect.top;
    const x2 = (rectB.left + rectB.right) / 2 - frameRect.left;
    const y2 = (rectB.top + rectB.bottom) / 2 - frameRect.top;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const extend = 30;
    const startX = x1 - ux * extend;
    const startY = y1 - uy * extend;
    const endX = x2 + ux * extend;
    const endY = y2 + uy * extend;

    laserSvg.setAttribute('viewBox', `0 0 ${frameRect.width} ${frameRect.height}`);
    laserSvg.classList.add('active');

    function buildTaperedPath(ax, ay, bx, by, halfWidth) {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const c1x = mx + nx * halfWidth;
      const c1y = my + ny * halfWidth;
      const c2x = mx - nx * halfWidth;
      const c2y = my - ny * halfWidth;
      return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)} Q ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)} Z`;
    }

    const startTime = performance.now();
    const slashDuration = 460;

    if (laserHead) {
      laserHead.style.opacity = '1';
      laserHead.setAttribute('cx', startX);
      laserHead.setAttribute('cy', startY);
    }

    function animateSlash(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / slashDuration);
      // Fast powerful ease-out cut slash
      const ease = 1 - Math.pow(1 - progress, 3);

      const curEndX = startX + (endX - startX) * ease;
      const curEndY = startY + (endY - startY) * ease;

      const currentHalfWidth = Math.max(1.5, 7.5 * Math.sin(ease * Math.PI * 0.9 + 0.1));
      const currentGlowWidth = currentHalfWidth * 2.2;

      const coreD = buildTaperedPath(startX, startY, curEndX, curEndY, currentHalfWidth);
      const glowD = buildTaperedPath(startX, startY, curEndX, curEndY, currentGlowWidth);

      corePath.setAttribute('d', coreD);
      glowPath.setAttribute('d', glowD);

      if (laserHead) {
        laserHead.setAttribute('cx', curEndX);
        laserHead.setAttribute('cy', curEndY);
      }

      if (progress < 1) {
        requestAnimationFrame(animateSlash);
      } else {
        if (laserHead) laserHead.style.opacity = '0';
        setTimeout(() => {
          laserSvg.classList.remove('active');
        }, 1900);
      }
    }

    requestAnimationFrame(animateSlash);
  }
    async function recordBingoScore() {
    if (!gameState.playerName || !gameState.elapsedMs) return;
    const duration_seconds = Math.max(1, Math.round(gameState.elapsedMs / 10) / 100);
    try {
      // Check if this score is already recorded
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(gameState.playerName)}&office=eq.${gameState.location}&duration_seconds=eq.${duration_seconds}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing && existing.length > 0) {
          // Score already recorded, but still save snapshot data
          saveWinnerSnapshot(existing[0].id);
          startLeaderboardPolling();
          return;
        }
      }

      const snapshot = JSON.stringify({
        bingo_line: gameState.bingoLine || checkBingo(gameState.completedCells),
        completed_cells: gameState.completedCells || [],
        challenges: gameState.challenges || [],
        cell_photos: gameState.cellPhotos || {},
        cell_ai_reasons: gameState.cellAiReasons || {}
      });

      // Record score to Supabase
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          player_name: gameState.playerName,
          office: gameState.location,
          game_name: 'photo_bingo',
          score: 1,
          duration_seconds: duration_seconds,
          player_email: snapshot
        })
      });

      if (postRes.ok) {
        const inserted = await postRes.json();
        if (inserted && inserted.length > 0) {
          saveWinnerSnapshot(inserted[0].id);
        }
      }

      startLeaderboardPolling();
      if (els.leaderboardModal && els.leaderboardModal.classList.contains('active')) {
        renderLeaderboard(currentLbLocation);
      }
    } catch (e) {
      console.warn('Score recording fallback error:', e);
    }
  }

  async function saveWinnerSnapshot(scoreId) {
    if (!scoreId) return;
    try {
      const snapshot = JSON.stringify({
        bingo_line: gameState.bingoLine,
        completed_cells: gameState.completedCells || [],
        challenges: gameState.challenges || [],
        cell_photos: gameState.cellPhotos || {},
        cell_ai_reasons: gameState.cellAiReasons || {}
      });

      await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?id=eq.${scoreId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ player_email: snapshot })
      });
    } catch (e) {
      console.warn('Winner snapshot save error:', e);
    }
  }

  async function saveWinnerSnapshotByName(playerName, office) {
    try {
      // Find the score record ID for this player
      const findRes = await fetch(`${SUPABASE_URL}/rest/v1/oktoberfest_game_scores?game_name=eq.photo_bingo&player_name=eq.${encodeURIComponent(playerName)}&office=eq.${office}&order=duration_seconds.asc&limit=1&select=id,player_email`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (!findRes.ok) return;
      const records = await findRes.json();
      if (!records || records.length === 0) return;
      // Only save if snapshot is empty
      if (records[0].player_email && records[0].player_email.trim().startsWith('{')) return;
      saveWinnerSnapshot(records[0].id);
    } catch (e) {
      console.warn('saveWinnerSnapshotByName error:', e);
    }
  }

  function onBingo(data) {
    gameState.status = 'completed';
    gameState.elapsedMs = data.elapsed_ms || (Date.now() - (gameState.startedAt || Date.now()));
    gameState.bingoLine = data.bingo_line || checkBingo(gameState.completedCells);
    gameState.rank = data.rank || 1;
    saveSession();
    recordBingoScore();

    // Freeze timer immediately at final completion time
    stopTimer(gameState.elapsedMs);
    renderBoard();

    els.victoryTime.textContent = formatTime(gameState.elapsedMs);
    els.victoryRank.textContent = `#${gameState.rank || 1}`;
    els.victoryLine.textContent = BINGO_LINE_NAMES[gameState.bingoLine] || gameState.bingoLine;

    // ─── 1. Precision Dynamic Laser Cut Slice (A to B) ───
    const lineKey = gameState.bingoLine || 'row-0';
    triggerLaserCut(lineKey);

    // ─── 2. Spotlight Zoom on 3 cells & Dim rest of website ───
    document.body.classList.add('celebrating-bingo');
    const backdrop = $('#bingoCelebrationBackdrop');
    if (backdrop) {
      backdrop.classList.add('active');
      if (window.lucide) window.lucide.createIcons();
    }

    // ─── 3. Continuous Fireworks Spectacle ───
    fireFireworks(2600);

    // ─── 4. Seamless transition back to gentle waving pulse & Victory Modal ───
    setTimeout(() => {
      if (backdrop) backdrop.classList.remove('active');
      document.body.classList.remove('celebrating-bingo');

      setTimeout(() => {
        openModal(els.victoryModal);
        startLeaderboardPolling();
        if (window.lucide) window.lucide.createIcons();
      }, 350);
    }, 2800);
  }

  /* ═══════════════════════════════════════════════════════
     CAMERA MANAGEMENT
     ═══════════════════════════════════════════════════════ */
  async function openCamera() {
    els.cameraPreview.style.display = 'none';
    if (els.cameraConfirmOverlay) els.cameraConfirmOverlay.style.display = 'none';
    els.cameraLoading.style.display = 'none';
    els.cameraResult.style.display = 'none';
    els.cameraControls.style.display = 'flex';
    els.cameraOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      els.cameraVideo.srcObject = cameraStream;
    } catch (err) {
      showToast('Unable to access camera. Please allow camera permissions in your browser.', 'error', 5000);
      closeCamera();
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    if (els.cameraVideo) els.cameraVideo.srcObject = null;
    els.cameraOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentCellIndex = null;
  }

  async function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      els.cameraVideo.srcObject = cameraStream;
    } catch (err) {
      showToast('Unable to switch camera.', 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════
     LEADERBOARD WITH TOP 1 WINNER PRIZE HIGHLIGHT
     ═══════════════════════════════════════════════════════ */
  let currentLbLocation = 'all';
  /* ─── LIVE 10-SECOND AUTO POLLING ─── */
  let leaderboardPollingTimer = null;

  function startLeaderboardPolling() {
    if (leaderboardPollingTimer) clearInterval(leaderboardPollingTimer);
    
    // Initial fetch
    loadSidebarLeaderboard();

    // Poll every 10 seconds automatically
    leaderboardPollingTimer = setInterval(() => {
      loadSidebarLeaderboard();
      if (els.leaderboardModal && els.leaderboardModal.classList.contains('active')) {
        renderLeaderboard(currentLbLocation);
      }
    }, 10000);

    // Refresh immediately when tab gains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadSidebarLeaderboard();
        if (els.leaderboardModal && els.leaderboardModal.classList.contains('active')) {
          renderLeaderboard(currentLbLocation);
        }
      }
    });
  }

  async function fetchLeaderboard(location = 'all') {
    try {
      const res = await fetch(`${API_BASE}/leaderboard?location=${location}&_t=${Date.now()}`);
      const data = await res.json();
      return data.leaderboard || [];
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      return [];
    }
  }

  async function renderLeaderboard(location) {
    currentLbLocation = location || currentLbLocation;
    const entries = await fetchLeaderboard(currentLbLocation);
    const tbody = els.leaderboardTableBody;
    tbody.innerHTML = '';

    if (!entries.length) {
      els.leaderboardEmpty.style.display = 'block';
      return;
    }

    els.leaderboardEmpty.style.display = 'none';

    const top10 = entries.slice(0, 10);
    top10.forEach((entry, i) => {
      const rank = i + 1;
      const isTop1 = rank === 1;
      const medal = isTop1 ? '👑 #1' : `#${rank}`;
      const isMe = entry.player_name === gameState.playerName &&
                    entry.location === gameState.location &&
                    Math.abs(entry.elapsed_ms - (gameState.elapsedMs || 0)) < 1000;

      const tr = document.createElement('tr');
      if (isTop1) {
        tr.classList.add('lb-winner-row');
        tr.title = 'Click to view Champion Winning Board';
        tr.addEventListener('click', () => openWinnerShowcase(currentLbLocation));
      }
      if (isMe && !isTop1) tr.classList.add('current-player-row');

      tr.innerHTML = `
        <td class="lb-rank">
          ${isTop1 ? `<span class="lb-rank-crown">${medal}</span>` : `<span style="font-weight:700;">${medal}</span>`}
        </td>
        <td class="lb-name">
          <div class="lb-player-with-prize">
            <span style="font-weight:700;">${escapeHtml(entry.player_name)}</span>
            ${isTop1 ? `<span class="sidebar-prize-badge">WINNER</span>` : (isMe ? `<span class="current-user-tag">YOU</span>` : '')}
          </div>
        </td>
        <td class="lb-time" style="font-family:monospace; font-weight:700; color:${isTop1?'#fbbf24':'var(--text-gold)'};">${formatTime(entry.elapsed_ms || 0)}</td>
        <td class="lb-location">
          <span class="status-loc-badge">${entry.location === 'danang' ? 'Da Nang' : 'HCMC'}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadSidebarLeaderboard() {
    const entries = await fetchLeaderboard('all');
    if (!els.sidebarLbList) return;

    if (!entries.length) {
      els.sidebarLbList.innerHTML = '<div class="sidebar-lb-empty">No champions yet. Be the first!</div>';
      return;
    }

    // Update live rank for current user if found in leaderboard
    if (gameState.playerName) {
      const myIdx = entries.findIndex(e => e.player_name === gameState.playerName && e.location === gameState.location);
      if (myIdx !== -1) {
        gameState.rank = myIdx + 1;
        if (els.statusRankText) els.statusRankText.textContent = `Rank #${gameState.rank}`;
      }
    }

    const top10 = entries.slice(0, 10);
    els.sidebarLbList.innerHTML = top10.map((entry, idx) => {
      const rank = idx + 1;
      const isWinner = rank === 1;
      const medal = isWinner ? '👑 #1' : `#${rank}`;
      const isMe = entry.player_name === gameState.playerName &&
                    entry.location === gameState.location &&
                    Math.abs(entry.elapsed_ms - (gameState.elapsedMs || 0)) < 1000;
      return `
        <div class="sidebar-lb-item ${isWinner ? 'sidebar-lb-winner' : (isMe ? 'current-player-item' : '')}" ${isWinner ? 'title="Click to view Champion Winning Board"' : ''}>
          <span class="sidebar-lb-rank" style="color:${isWinner?'#fbbf24':(isMe?'#38bdf8':'inherit')};">${medal}</span>
          <div class="sidebar-lb-name-group">
            <span class="sidebar-lb-name">${escapeHtml(entry.player_name)}</span>
            ${isWinner ? `<span class="sidebar-prize-badge">WINNER</span>` : (isMe ? `<span class="current-user-tag">YOU</span>` : '')}
          </div>
          <span class="sidebar-lb-time">${formatTime(entry.elapsed_ms || 0)}</span>
        </div>
      `;
    }).join('');

    const winnerItem = els.sidebarLbList.querySelector('.sidebar-lb-winner');
    if (winnerItem) {
      winnerItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWinnerShowcase('all');
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

    /* ═══════════════════════════════════════════════════════
     WINNER SHOWCASE MODAL (Top 1 Board Preview)
     ═══════════════════════════════════════════════════════ */
  let wasLeaderboardOpen = false;

  async function openWinnerShowcase(location) {
    if (!els.winnerShowcaseModal) return;

    if (els.leaderboardModal && els.leaderboardModal.classList.contains('active')) {
      wasLeaderboardOpen = true;
      closeModal(els.leaderboardModal);
    } else {
      wasLeaderboardOpen = false;
    }

    openModal(els.winnerShowcaseModal);

    els.winnerPlayerName.textContent = 'Loading Champion...';
    els.winnerMiniBoard.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:var(--text-muted);">Loading winner board...</div>';

    try {
      const targetLoc = location || currentLbLocation || 'all';
      const res = await fetch(`${API_BASE}/winner?location=${targetLoc}`);
      if (!res.ok) throw new Error('Failed to load winner');
      const data = await res.json();
      if (!data.success || !data.winner) {
        els.winnerPlayerName.textContent = 'No Champion Yet';
        els.winnerMiniBoard.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:var(--text-gold); font-weight:700;">No champions yet.<br><span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">Be the first to score BINGO and claim the crown!</span></div>';
        return;
      }

      const winner = data.winner;
      const isCurrentPlayer = (winner.player_name === gameState.playerName && winner.location === gameState.location);
      const winnerHasSnapshot = (winner.challenges && winner.challenges.length === 9);

      let rawChallenges = [];
      let completedCells = [];
      let cellPhotos = {};
      let cellAiReasons = {};
      let winningLineKey = null;

      if (isCurrentPlayer && gameState.challenges && gameState.challenges.length === 9) {
        rawChallenges = gameState.challenges;
        completedCells = gameState.completedCells || [];
        cellPhotos = gameState.cellPhotos || {};
        cellAiReasons = gameState.cellAiReasons || {};
        winningLineKey = gameState.bingoLine || winner.bingo_line || checkBingo(completedCells);
      } else if (winnerHasSnapshot) {
        rawChallenges = winner.challenges;
        completedCells = winner.completed_cells || [];
        cellPhotos = winner.cell_photos || {};
        cellAiReasons = winner.cell_ai_reasons || {};
        winningLineKey = winner.bingo_line || checkBingo(completedCells);
      } else {
        rawChallenges = Array.from({length: 9}, (_, idx) => ({ id: `w_${idx}`, category: 'social', icon: 'camera', challenge: `Challenge #${idx+1}` }));
        completedCells = winner.completed_cells || [];
        cellPhotos = {};
        cellAiReasons = {};
        winningLineKey = winner.bingo_line || checkBingo(completedCells);
      }

      if (!winningLineKey) {
        winningLineKey = checkBingo(completedCells) || 'row-0';
      }

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
      const winningLineObj = lines.find(l => l.name === winningLineKey);
      const winningIndices = winningLineObj ? winningLineObj.indices : [0, 1, 2];

      els.winnerPlayerName.textContent = winner.player_name || 'Champion';
      els.winnerLocationBadge.textContent = winner.location === 'danang' ? 'Da Nang' : (winner.location === 'hcmc' ? 'HCMC' : 'All Offices');
      els.winnerTimeBadge.innerHTML = `<i data-lucide="timer"></i> ${formatTime(winner.elapsed_ms || 0)}`;
      els.winnerLineBadge.innerHTML = `<i data-lucide="award"></i> ${BINGO_LINE_NAMES[winningLineKey] || winningLineKey || 'BINGO Line'}`;

      els.winnerMiniBoard.innerHTML = '';
      for (let idx = 0; idx < 9; idx++) {
        const isWinningCell = winningIndices.includes(idx);
        const ch = rawChallenges[idx] || { id: `w_${idx}`, category: 'social', icon: 'camera', challenge: `Challenge #${idx+1}` };
        const photoUrl = cellPhotos[idx] || null;
        const catIcon = CATEGORY_ICONS[ch.category] || 'camera';

        const cellEl = document.createElement('div');
        cellEl.className = `winner-mini-cell ${isWinningCell ? 'winner-winning-cell' : ''}`;

        if (isWinningCell) {
          // ONLY the 3 Winning BINGO cells have background photo, category icon, checkmark, and click event
          if (photoUrl) {
            cellEl.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.25), rgba(11, 19, 43, 0.65)), url('${photoUrl}')`;
          }

          cellEl.innerHTML = `
            <div class="winner-cell-overlay"></div>
            <div class="winner-cell-cat-icon"><i data-lucide="${catIcon}"></i></div>
            <div class="winner-cell-check"><i data-lucide="check"></i></div>
            <p class="winner-cell-text">${escapeHtml(ch.challenge)}</p>
          `;

          cellEl.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const imgEl = $('#photoReviewImg');
            const txtEl = $('#photoReviewChallengeText');
            const reasonEl = $('#photoReviewAiReason');
            const pillEl = $('#photoReviewStatusPill');
            const catIconEl = $('#photoReviewCatIcon');

            if (imgEl) {
              imgEl.src = photoUrl || '';
              imgEl.style.display = photoUrl ? 'block' : 'none';
            }
            if (txtEl) txtEl.textContent = ch.challenge;
            if (reasonEl) reasonEl.textContent = cellAiReasons[idx] || 'Verified winning challenge submission by Champion.';
            if (pillEl) {
              pillEl.className = 'photo-review-status-pill status-done';
              pillEl.innerHTML = '<i data-lucide="check"></i> <span>DONE</span>';
            }
            if (catIconEl) catIconEl.innerHTML = `<i data-lucide="${catIcon}"></i>`;

            openModal(els.photoReviewModal);
            if (window.lucide) window.lucide.createIcons();
          });

        } else {
          // Non-winning cells: pure placeholder, NO camera icon, NO checkmark, NO click handler
          cellEl.innerHTML = `
            <p class="winner-cell-text" style="color:var(--text-muted); opacity:0.8; font-size:0.7rem;">Challenge #${idx+1}</p>
          `;
        }

        els.winnerMiniBoard.appendChild(cellEl);
      }

      if (window.lucide) window.lucide.createIcons();

    } catch (e) {
      els.winnerMiniBoard.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:var(--text-muted);">Could not load winner board.</div>';
    }
  }

  function closeWinnerShowcase() {
    closeModal(els.winnerShowcaseModal);
    if (wasLeaderboardOpen && els.leaderboardModal) {
      openModal(els.leaderboardModal);
      renderLeaderboard(currentLbLocation);
    }
  }


  function openLeaderboard() {
    openModal(els.leaderboardModal);
    renderLeaderboard(currentLbLocation);
    if (window.lucide) window.lucide.createIcons();
  }

  /* ═══════════════════════════════════════════════════════
     LOCATION DETECTION
     ═══════════════════════════════════════════════════════ */
  async function detectLocation() {
    try {
      const res = await fetch('https://ipwho.is/', { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        const city = (data.city || '').toLowerCase();
        const lat = data.latitude;
        if (city.includes('ho chi minh') || city.includes('saigon') || city.includes('can tho') || city.includes('binh duong') || (lat && lat < 13.5)) {
          setLocation('hcmc');
        } else {
          setLocation('danang');
        }
      }
    } catch (e) { /* silently fail */ }
  }

  function setLocation(loc) {
    gameState.location = loc;
    $$('.loc-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.location === loc);
    });
  }

  /* ═══════════════════════════════════════════════════════
     SESSION PERSISTENCE & RELOAD RECOVERY
     ═══════════════════════════════════════════════════════ */
  function saveSession() {
    try {
      const dataToSave = {
        sessionId: gameState.sessionId,
        sessionToken: gameState.sessionToken,
        playerName: gameState.playerName,
        location: gameState.location,
        challenges: gameState.challenges,
        completedCells: gameState.completedCells,
        pendingReviewCells: gameState.pendingReviewCells || [],
        cellPhotos: gameState.cellPhotos || {},
        cellAiReasons: gameState.cellAiReasons || {},
        status: gameState.status,
        startedAt: gameState.startedAt,
        elapsedMs: gameState.elapsedMs,
        bingoLine: gameState.bingoLine,
        rank: gameState.rank
      };
      localStorage.setItem(STORAGE_KEY_TOKEN, gameState.sessionToken || '');
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(dataToSave));
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_STATE);
    } catch (e) { /* ignore */ }
  }

    function resetToWelcome() {
    clearSession();
    gameState = {
      sessionId: null, sessionToken: null, playerName: '', location: gameState.location || 'danang',
      challenges: [], completedCells: [], cellPhotos: {}, status: 'idle',
      startedAt: null, elapsedMs: null, bingoLine: null, rank: null
    };
    $$('.bingo-cell').forEach(cell => {
      cell.className = 'bingo-cell';
      cell.style.backgroundImage = '';
      const textP = cell.querySelector('.cell-challenge-text');
      if (textP) textP.textContent = 'Ready to play...';
    });
    if (els.gameWelcome) els.gameWelcome.style.display = '';
    if (els.bingoBoard) els.bingoBoard.style.display = 'none';
    if (els.gameStatusBar) els.gameStatusBar.style.display = 'none';
    resetTimer();
  }

    async function tryRecoverSession() {
    try {
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      const savedLocalStateStr = localStorage.getItem(STORAGE_KEY_STATE);
      let localState = null;
      if (savedLocalStateStr) {
        try { localState = JSON.parse(savedLocalStateStr); } catch (e) {}
      }

      if (!savedToken && !localState) return false;

      // 1. FAST LOCAL HYDRATION: Immediately render UI from local storage
      if (localState && localState.sessionId) {
        gameState = Object.assign({}, gameState, localState);
        els.gameWelcome.style.display = 'none';
        els.bingoBoard.style.display = 'grid';
        renderBoard();

        const isLocalCompleted = gameState.status === 'completed' || checkBingo(gameState.completedCells || []) !== null;
        if (isLocalCompleted) {
          gameState.status = 'completed';
          if (!gameState.bingoLine) gameState.bingoLine = checkBingo(gameState.completedCells);
          stopTimer(gameState.elapsedMs || 0);
        } else {
          startTimer();
        }
      }

      // 2. Background Server Sync (Never wipes local data on error)
      if (savedToken) {
        try {
          const res = await fetch(`${API_BASE}/session?token=${encodeURIComponent(savedToken)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session_id) {
              const completedCells = data.completed_cells || gameState.completedCells || [];
              const bingoLine = data.bingo_line || checkBingo(completedCells);
              const isCompleted = data.status === 'completed' || bingoLine !== null;

              const pendingReviewCells = Array.from(new Set([
                ...(data.pending_review_cells || []),
                ...(localState && localState.pendingReviewCells ? localState.pendingReviewCells : []),
                ...(gameState.pendingReviewCells || [])
              ]));

              const serverPhotos = data.cell_photo_urls || {};
              const localPhotos = Object.assign({}, localState && localState.cellPhotos ? localState.cellPhotos : {}, gameState.cellPhotos || {});
              const cellPhotos = {};
              for (const idx of completedCells) {
                cellPhotos[idx] = serverPhotos[idx] || localPhotos[idx] || null;
              }

              const cellAiReasons = Object.assign({}, localState && localState.cellAiReasons ? localState.cellAiReasons : {}, data.cell_ai_reasons || {});

              gameState.sessionId = data.session_id;
              gameState.playerName = data.player_name;
              gameState.location = data.location;
              gameState.challenges = data.challenges || [];
              gameState.completedCells = completedCells;
              gameState.pendingReviewCells = pendingReviewCells;
              gameState.cellPhotos = cellPhotos;
              gameState.cellAiReasons = cellAiReasons;
              gameState.startedAt = data.started_at;
              gameState.status = isCompleted ? 'completed' : 'playing';
              gameState.elapsedMs = data.elapsed_ms || (isCompleted ? gameState.elapsedMs : null);
              gameState.bingoLine = bingoLine;
              gameState.rank = data.rank || gameState.rank || 1;

              saveSession();
              renderBoard();

              if (isCompleted) {
                stopTimer(gameState.elapsedMs || 0);
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Server session sync note:', fetchErr);
        }
      }

      return true;
    } catch (e) {
      console.warn('Session recovery error:', e);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════
     CONFETTI CELEBRATION
     ═══════════════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════════════
     CONTINUOUS FIREWORKS CELEBRATION
     ═══════════════════════════════════════════════════════ */
  function fireFireworks(duration = 2400) {
    if (!window.confetti) return;
    const end = Date.now() + duration;
    const colors = ['#f59e0b', '#fbbf24', '#ffffff', '#0284c7', '#ec4899', '#10b981'];

    (function frame() {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors
      });
      confetti({
        particleCount: 10,
        spread: 90,
        origin: { x: 0.5, y: 0.3 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  function fireConfetti() {
    if (!window.confetti) return;
    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#d97706', '#ffffff', '#0284c7']
    });
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f59e0b', '#fbbf24'] });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#d97706', '#fbbf24'] });
    }, 250);
  }

  /* ═══════════════════════════════════════════════════════
     PLAY AGAIN
     ═══════════════════════════════════════════════════════ */
  function playAgain() {
    closeModal(els.victoryModal);
    resetTimer();
    clearSession();

    gameState = {
      sessionId: null, sessionToken: null, playerName: '', location: gameState.location,
      challenges: [], completedCells: [], cellPhotos: {}, status: 'idle',
      startedAt: null, elapsedMs: null, bingoLine: null, rank: null
    };

    $$('.bingo-cell').forEach(cell => {
      cell.className = 'bingo-cell';
      cell.style.backgroundImage = '';
      const textP = cell.querySelector('.cell-challenge-text');
      if (textP) textP.textContent = 'Ready to play...';
    });

    els.gameWelcome.style.display = '';
    els.bingoBoard.style.display = 'none';
    els.gameStatusBar.style.display = 'none';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ═══════════════════════════════════════════════════════
     EVENT BINDINGS
     ═══════════════════════════════════════════════════════ */
  function bindEvents() {
    els.startGameBtn.addEventListener('click', onStartGame);
    if (els.playerName) {
      els.playerName.addEventListener('input', (e) => {
        if (nameCheckDebounceTimer) clearTimeout(nameCheckDebounceTimer);
        nameCheckDebounceTimer = setTimeout(() => {
          checkNameAvailability(e.target.value);
        }, 200);
      });
    }
    els.playerForm.addEventListener('submit', onPlayerSubmit);
    els.closePlayerModal.addEventListener('click', () => closeModal(els.playerModal));
    els.playerModal.addEventListener('click', (e) => {
      if (e.target === els.playerModal) closeModal(els.playerModal);
    });

    $$('.loc-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setLocation(btn.dataset.location));
    });

    $$('.bingo-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.dataset.cell, 10);
        onCellTap(idx);
      });
    });

    els.cameraShutterBtn.addEventListener('click', capturePhoto);
    els.cameraCancelBtn.addEventListener('click', closeCamera);
    els.cameraSwitchBtn.addEventListener('click', switchCamera);
    els.retakeBtn.addEventListener('click', () => {
      if (els.cameraConfirmOverlay) els.cameraConfirmOverlay.style.display = 'none';
      els.cameraPreview.style.display = 'none';
      els.cameraResult.style.display = 'none';
      els.cameraControls.style.display = 'flex';
    });
    els.submitPhotoBtn.addEventListener('click', () => {
      if (els.cameraConfirmOverlay) {
        els.cameraConfirmOverlay.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
      } else {
        submitPhoto();
      }
    });

    if (els.cancelSubmitPhotoBtn) {
      els.cancelSubmitPhotoBtn.addEventListener('click', () => {
        if (els.cameraConfirmOverlay) els.cameraConfirmOverlay.style.display = 'none';
      });
    }

    if (els.proceedSubmitPhotoBtn) {
      els.proceedSubmitPhotoBtn.addEventListener('click', () => {
        if (els.cameraConfirmOverlay) els.cameraConfirmOverlay.style.display = 'none';
        submitPhoto();
      });
    }

    els.victoryLeaderboardBtn.addEventListener('click', () => {
      closeModal(els.victoryModal);
      openLeaderboard();
    });

    if (els.victoryBackGameBtn) {
      els.victoryBackGameBtn.addEventListener('click', () => {
        closeModal(els.victoryModal);
      });
    }
    

    els.leaderboardToggleBtn.addEventListener('click', openLeaderboard);
    if (els.welcomeLeaderboardBtn) els.welcomeLeaderboardBtn.addEventListener('click', openLeaderboard);
    if (els.sidebarViewAllBtn) els.sidebarViewAllBtn.addEventListener('click', openLeaderboard);
    els.closeLeaderboardBtn.addEventListener('click', () => closeModal(els.leaderboardModal));
    els.leaderboardModal.addEventListener('click', (e) => {
      if (e.target === els.leaderboardModal) closeModal(els.leaderboardModal);
    });

    // Winner Showcase Modal Close Bindings
    if (els.closeWinnerShowcaseBtn) {
      els.closeWinnerShowcaseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeWinnerShowcase();
      });
    }

    if (els.winnerCloseBtn) {
      els.winnerCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeWinnerShowcase();
      });
    }

    if (els.winnerShowcaseModal) {
      els.winnerShowcaseModal.addEventListener('click', (e) => {
        if (e.target === els.winnerShowcaseModal) {
          closeWinnerShowcase();
        }
      });
    }

    // Photo Review Modal Close Bindings
    if (els.closePhotoReviewBtn) {
      els.closePhotoReviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal(els.photoReviewModal);
      });
    }

    if (els.photoReviewCloseBtn) {
      els.photoReviewCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal(els.photoReviewModal);
      });
    }

    if (els.photoReviewModal) {
      els.photoReviewModal.addEventListener('click', (e) => {
        if (e.target === els.photoReviewModal) {
          closeModal(els.photoReviewModal);
        }
      });
    }

    // Collapsible Sidebar Leaderboard Accordion
    const sidebarLbToggleBtn = $('#sidebarLbToggleBtn');
    const sidebarLbContent = $('#sidebarLbContent');
    if (sidebarLbToggleBtn && sidebarLbContent) {
      sidebarLbToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebarLbContent.classList.toggle('collapsed');
        sidebarLbToggleBtn.classList.toggle('active', !isCollapsed);
        sidebarLbToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
      });
    }

    // Collapsible Sidebar Pro Tips Accordion
    const proTipsToggleBtn = $('#proTipsToggleBtn');
    const proTipsContent = $('#proTipsContent');
    if (proTipsToggleBtn && proTipsContent) {
      proTipsToggleBtn.addEventListener('click', () => {
        const isCollapsed = proTipsContent.classList.toggle('collapsed');
        proTipsToggleBtn.classList.toggle('active', !isCollapsed);
        proTipsToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
      });
    }

    els.leaderboardTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.lb-filter-tab');
      if (!tab) return;
      $$('.lb-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderLeaderboard(tab.dataset.lbLocation);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.photoReviewModal && els.photoReviewModal.classList.contains('active')) closeModal(els.photoReviewModal);
        else if (els.winnerShowcaseModal && els.winnerShowcaseModal.classList.contains('active')) closeWinnerShowcase();
        else if (els.cameraOverlay && els.cameraOverlay.classList.contains('active')) closeCamera();
        else if (els.victoryModal && els.victoryModal.classList.contains('active')) closeModal(els.victoryModal);
        else if (els.leaderboardModal && els.leaderboardModal.classList.contains('active')) closeModal(els.leaderboardModal);
        else if (els.playerModal && els.playerModal.classList.contains('active')) closeModal(els.playerModal);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════════════════ */
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === '1' || urlParams.get('reset') === 'true') {
      clearSession();
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
    }

    cacheDom();
    bindEvents();
    if (window.lucide) window.lucide.createIcons();

    startLeaderboardPolling();

    const recovered = await tryRecoverSession();
    if (!recovered) {
      resetTimer();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
