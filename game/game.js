/**
 * mgm Oktoberfest 2026 — Photo Bingo Game
 * ═══════════════════════════════════════════
 * Game logic, camera capture, timer, leaderboard, and anti-cheat.
 */

(function () {
  'use strict';

  /* ─── CONSTANTS ─── */
  const API_BASE = '/api/game';
  const BINGO_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // cols
    [0, 4, 8], [2, 4, 6]               // diagonals
  ];
  const BINGO_LINE_NAMES = {
    'row-0': 'Row 1', 'row-1': 'Row 2', 'row-2': 'Row 3',
    'col-0': 'Col 1', 'col-1': 'Col 2', 'col-2': 'Col 3',
    'diag-main': 'Diagonal ↘', 'diag-anti': 'Diagonal ↙'
  };

  /* ─── GAME STATE ─── */
  let gameState = {
    sessionId: null,
    playerName: '',
    location: 'danang',
    challenges: [],         // 9 challenge objects
    completedCells: [],     // indices of completed cells
    status: 'idle',         // idle | playing | completed
    startedAt: null,        // ISO string from server
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
  let facingMode = 'environment'; // 'user' or 'environment'

  /* ─── DOM ELEMENTS ─── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {};
  function cacheDom() {
    els.gameWelcome = $('#gameWelcome');
    els.bingoBoard = $('#bingoBoard');
    els.startGameBtn = $('#startGameBtn');
    els.welcomeLeaderboardBtn = $('#welcomeLeaderboardBtn');

    // Player modal
    els.playerModal = $('#playerModal');
    els.closePlayerModal = $('#closePlayerModal');
    els.playerForm = $('#playerForm');
    els.playerName = $('#playerName');
    els.submitPlayerBtn = $('#submitPlayerBtn');

    // Timer
    els.gameTimer = $('#gameTimer');
    els.timerDisplay = $('#timerDisplay');

    // Camera
    els.cameraOverlay = $('#cameraOverlay');
    els.cameraVideo = $('#cameraVideo');
    els.cameraChallengeBar = $('#cameraChallengeBar');
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
    els.cameraLoading = $('#cameraLoading');
    els.cameraResult = $('#cameraResult');
    els.resultIcon = $('#resultIcon');
    els.resultText = $('#resultText');
    els.cameraCanvas = $('#cameraCanvas');

    // Victory
    els.victoryModal = $('#victoryModal');
    els.victoryTime = $('#victoryTime');
    els.victoryRank = $('#victoryRank');
    els.victoryLine = $('#victoryLine');
    els.victoryLeaderboardBtn = $('#victoryLeaderboardBtn');
    els.victoryPlayAgainBtn = $('#victoryPlayAgainBtn');

    // Leaderboard
    els.leaderboardModal = $('#leaderboardModal');
    els.leaderboardToggleBtn = $('#leaderboardToggleBtn');
    els.closeLeaderboardBtn = $('#closeLeaderboardBtn');
    els.leaderboardTabs = $('#leaderboardTabs');
    els.leaderboardTableBody = $('#leaderboardTableBody');
    els.leaderboardEmpty = $('#leaderboardEmpty');

    // Toast
    els.toastContainer = $('#gameToastContainer');
  }


  /* ═══════════════════════════════════════════════════════
     MODAL HELPERS
     ═══════════════════════════════════════════════════════ */
  function openModal(modalEl) {
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modalEl) {
    modalEl.classList.remove('active');
    document.body.style.overflow = '';
  }


  /* ═══════════════════════════════════════════════════════
     TOAST NOTIFICATIONS
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
     TIMER
     ═══════════════════════════════════════════════════════ */
  function startTimer() {
    timerStartTime = new Date(gameState.startedAt).getTime();
    els.gameTimer.classList.add('timer-running');
    els.gameTimer.classList.remove('timer-idle', 'timer-stopped');

    timerInterval = setInterval(() => {
      const elapsed = Date.now() - timerStartTime;
      els.timerDisplay.textContent = formatTime(elapsed);
    }, 37); // ~27fps for smooth centiseconds
  }

  function stopTimer(finalMs) {
    clearInterval(timerInterval);
    timerInterval = null;
    els.gameTimer.classList.remove('timer-running');
    els.gameTimer.classList.add('timer-stopped');
    if (finalMs != null) {
      els.timerDisplay.textContent = formatTime(finalMs);
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    els.timerDisplay.textContent = '00:00.00';
    els.gameTimer.classList.remove('timer-running', 'timer-stopped');
    els.gameTimer.classList.add('timer-idle');
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const cents = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
  }


  /* ═══════════════════════════════════════════════════════
     BINGO BOARD RENDERING
     ═══════════════════════════════════════════════════════ */
  function renderBoard() {
    const cells = $$('.bingo-cell');
    cells.forEach((cell, i) => {
      const challenge = gameState.challenges[i];
      if (!challenge) {
        cell.querySelector('.cell-icon').textContent = '❓';
        cell.querySelector('.cell-text').textContent = '???';
        cell.className = 'bingo-cell';
        cell.style.backgroundImage = '';
        return;
      }

      cell.querySelector('.cell-icon').textContent = challenge.icon;
      cell.querySelector('.cell-text').textContent = challenge.challenge;

      // Completed state
      if (gameState.completedCells.includes(i)) {
        cell.classList.add('completed');
      } else {
        cell.classList.remove('completed');
      }

      // Bingo line highlight
      if (gameState.bingoLine) {
        const lineKey = gameState.bingoLine;
        const lineIdx = getBingoLineIndices(lineKey);
        if (lineIdx && lineIdx.includes(i)) {
          cell.classList.add('bingo-line-cell');
        }
      }
    });
  }

  function getBingoLineIndices(lineKey) {
    const map = {
      'row-0': [0,1,2], 'row-1': [3,4,5], 'row-2': [6,7,8],
      'col-0': [0,3,6], 'col-1': [1,4,7], 'col-2': [2,5,8],
      'diag-main': [0,4,8], 'diag-anti': [2,4,6]
    };
    return map[lineKey] || null;
  }

  function runRevealAnimation() {
    return new Promise((resolve) => {
      const cells = $$('.bingo-cell');
      cells.forEach((cell, i) => {
        cell.classList.add('revealing');
        // Stagger each cell
        setTimeout(() => {
          cell.classList.remove('revealing');
          cell.classList.add('revealed');
          const challenge = gameState.challenges[i];
          cell.querySelector('.cell-icon').textContent = challenge.icon;
          cell.querySelector('.cell-text').textContent = challenge.challenge;
        }, 300 + i * 200);
      });
      // All revealed after last cell
      setTimeout(resolve, 300 + 9 * 200 + 300);
    });
  }


  /* ═══════════════════════════════════════════════════════
     GAME FLOW
     ═══════════════════════════════════════════════════════ */

  // Step 1: User clicks "Start Game" → show player modal
  function onStartGame() {
    openModal(els.playerModal);
    els.playerName.focus();
    // Auto-detect location via IP (best effort)
    detectLocation();
  }

  // Step 2: User submits name + location → create session on server
  async function onPlayerSubmit(e) {
    e.preventDefault();

    const name = els.playerName.value.trim();
    if (name.length < 2 || name.length > 30) {
      showToast('Name must be 2-30 characters', 'error');
      els.playerName.classList.add('shake');
      setTimeout(() => els.playerName.classList.remove('shake'), 500);
      return;
    }

    // Show loading
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
        throw new Error(data.error || 'Failed to start game');
      }

      // Update state
      gameState.sessionId = data.session_id;
      gameState.playerName = name;
      gameState.challenges = data.challenges;
      gameState.startedAt = data.started_at;
      gameState.completedCells = [];
      gameState.status = 'playing';
      gameState.bingoLine = null;
      gameState.elapsedMs = null;
      gameState.rank = null;

      // Save session to localStorage for recovery
      saveSession();

      // Close modal, hide welcome
      closeModal(els.playerModal);
      els.gameWelcome.classList.add('hidden');

      // Run reveal animation
      await runRevealAnimation();

      // Start timer
      startTimer();

      showToast('Game started! Tap a cell to begin 📸', 'success');

    } catch (err) {
      showToast(err.message || 'Server error. Please try again.', 'error');
    } finally {
      els.submitPlayerBtn.querySelector('.btn-text').style.display = '';
      els.submitPlayerBtn.querySelector('.btn-loading').style.display = 'none';
      els.submitPlayerBtn.disabled = false;
    }
  }

  // Step 3: User taps a cell → open camera
  function onCellTap(cellIndex) {
    if (gameState.status !== 'playing') return;
    if (gameState.completedCells.includes(cellIndex)) {
      showToast('This cell is already completed! ✅', 'info');
      return;
    }

    currentCellIndex = cellIndex;
    const challenge = gameState.challenges[cellIndex];
    els.cameraIcon.textContent = challenge.icon;
    els.cameraChallenge.textContent = challenge.challenge;

    openCamera();
  }

  // Step 4: Capture photo
  function capturePhoto() {
    const video = els.cameraVideo;
    const canvas = els.cameraCanvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Compress to JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    els.previewImage.src = dataUrl;

    // Show preview, hide live controls
    els.cameraControls.style.display = 'none';
    els.cameraPreview.style.display = 'flex';

    // Shutter flash effect
    els.cameraOverlay.classList.add('shutter-flash');
    setTimeout(() => els.cameraOverlay.classList.remove('shutter-flash'), 200);
  }

  // Step 5: Submit photo to server
  async function submitPhoto() {
    const dataUrl = els.previewImage.src;
    const base64 = dataUrl.split(',')[1];

    // Show loading
    els.cameraPreview.style.display = 'none';
    els.cameraLoading.style.display = 'flex';

    try {
      const res = await fetch(`${API_BASE}/submit-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: gameState.sessionId,
          cell_index: currentCellIndex,
          photo_base64: base64
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      els.cameraLoading.style.display = 'none';

      if (data.verified) {
        // Show success result
        els.resultIcon.textContent = '✅';
        els.resultText.textContent = 'Approved!';
        els.cameraResult.style.display = 'flex';
        els.cameraResult.className = 'camera-result result-success';

        // Update state
        gameState.completedCells.push(currentCellIndex);
        saveSession();

        setTimeout(() => {
          closeCamera();
          renderBoard();

          // Check bingo
          if (data.is_bingo) {
            onBingo(data);
          }
        }, 1000);

      } else {
        // Show rejection
        els.resultIcon.textContent = '❌';
        els.resultText.textContent = data.reason || 'Photo doesn\'t match. Try again!';
        els.cameraResult.style.display = 'flex';
        els.cameraResult.className = 'camera-result result-fail';

        setTimeout(() => {
          els.cameraResult.style.display = 'none';
          // Return to camera live view
          els.cameraControls.style.display = 'flex';
        }, 2000);
      }

    } catch (err) {
      els.cameraLoading.style.display = 'none';
      showToast(err.message || 'Upload error. Please try again.', 'error');
      els.cameraControls.style.display = 'flex';
    }
  }

  // Step 6: BINGO! celebration
  function onBingo(data) {
    gameState.status = 'completed';
    gameState.elapsedMs = data.elapsed_ms;
    gameState.bingoLine = data.bingo_line;
    gameState.rank = data.rank;
    saveSession();

    // Stop timer
    stopTimer(data.elapsed_ms);

    // Highlight winning line
    renderBoard();

    // Show victory modal
    els.victoryTime.textContent = formatTime(data.elapsed_ms);
    els.victoryRank.textContent = data.rank ? `#${data.rank}` : '-';
    els.victoryLine.textContent = BINGO_LINE_NAMES[data.bingo_line] || data.bingo_line;

    setTimeout(() => {
      openModal(els.victoryModal);
      fireConfetti();
    }, 600);
  }


  /* ═══════════════════════════════════════════════════════
     CAMERA MANAGEMENT
     ═══════════════════════════════════════════════════════ */
  async function openCamera() {
    els.cameraPreview.style.display = 'none';
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
      showToast('Camera access denied. Please allow camera access in your browser settings.', 'error', 5000);
      closeCamera();
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    els.cameraVideo.srcObject = null;
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
      showToast('Could not switch camera.', 'error');
    }
  }


  /* ═══════════════════════════════════════════════════════
     LEADERBOARD
     ═══════════════════════════════════════════════════════ */
  let currentLbLocation = 'all';

  async function fetchLeaderboard(location = 'all') {
    try {
      const res = await fetch(`${API_BASE}/leaderboard?location=${location}`);
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
      els.leaderboardEmpty.style.display = 'flex';
      return;
    }

    els.leaderboardEmpty.style.display = 'none';

    entries.forEach((entry, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
      const isMe = entry.player_name === gameState.playerName &&
                    entry.location === gameState.location &&
                    entry.elapsed_ms === gameState.elapsedMs;

      const tr = document.createElement('tr');
      if (isMe) tr.classList.add('lb-current-player');
      if (rank <= 3) tr.classList.add(`lb-top-${rank}`);

      tr.innerHTML = `
        <td class="lb-rank">${medal}</td>
        <td class="lb-name">${escapeHtml(entry.player_name)}</td>
        <td class="lb-time">${formatTime(entry.elapsed_ms)}</td>
        <td class="lb-location">
          <span class="lb-loc-badge lb-loc-${entry.location}">
            ${entry.location === 'danang' ? 'Da Nang' : 'HCMC'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
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
    $$('.location-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.location === loc);
    });
  }


  /* ═══════════════════════════════════════════════════════
     SESSION PERSISTENCE (Recovery on refresh)
     ═══════════════════════════════════════════════════════ */
  function saveSession() {
    try {
      localStorage.setItem('bingo_session', JSON.stringify({
        sessionId: gameState.sessionId,
        playerName: gameState.playerName,
        location: gameState.location,
        status: gameState.status
      }));
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    try { localStorage.removeItem('bingo_session'); } catch (e) { /* ignore */ }
  }

  async function tryRecoverSession() {
    try {
      const saved = localStorage.getItem('bingo_session');
      if (!saved) return false;

      const { sessionId, playerName, location, status } = JSON.parse(saved);
      if (!sessionId || status !== 'playing') {
        clearSession();
        return false;
      }

      // Fetch session from server
      const res = await fetch(`${API_BASE}/session?id=${sessionId}`);
      if (!res.ok) {
        clearSession();
        return false;
      }

      const data = await res.json();
      if (!data.session_id || data.status !== 'playing') {
        clearSession();
        return false;
      }

      // Restore state
      gameState.sessionId = data.session_id;
      gameState.playerName = data.player_name;
      gameState.location = data.location;
      gameState.challenges = data.challenges;
      gameState.startedAt = data.started_at;
      gameState.completedCells = data.completed_cells || [];
      gameState.status = 'playing';

      // Update UI
      els.gameWelcome.classList.add('hidden');
      renderBoard();
      startTimer();

      showToast('Session recovered! Continue playing 🎮', 'success');
      return true;

    } catch (e) {
      clearSession();
      return false;
    }
  }


  /* ═══════════════════════════════════════════════════════
     CONFETTI CELEBRATION
     ═══════════════════════════════════════════════════════ */
  function fireConfetti() {
    if (!window.confetti) return;

    // First burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#d97706', '#ffffff', '#0284c7']
    });

    // Delayed side bursts
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f59e0b', '#fbbf24'] });
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#d97706', '#fbbf24'] });
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
      sessionId: null, playerName: '', location: gameState.location,
      challenges: [], completedCells: [], status: 'idle',
      startedAt: null, elapsedMs: null, bingoLine: null, rank: null
    };

    // Reset board cells
    $$('.bingo-cell').forEach(cell => {
      cell.className = 'bingo-cell';
      cell.style.backgroundImage = '';
      cell.querySelector('.cell-icon').textContent = '❓';
      cell.querySelector('.cell-text').textContent = '???';
    });

    // Show welcome
    els.gameWelcome.classList.remove('hidden');
  }


  /* ═══════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }


  /* ═══════════════════════════════════════════════════════
     EVENT LISTENERS
     ═══════════════════════════════════════════════════════ */
  function bindEvents() {
    // Start game
    els.startGameBtn.addEventListener('click', onStartGame);

    // Player form
    els.playerForm.addEventListener('submit', onPlayerSubmit);
    els.closePlayerModal.addEventListener('click', () => closeModal(els.playerModal));
    els.playerModal.addEventListener('click', (e) => {
      if (e.target === els.playerModal) closeModal(els.playerModal);
    });

    // Location toggle
    $$('.location-btn').forEach(btn => {
      btn.addEventListener('click', () => setLocation(btn.dataset.location));
    });

    // Cell taps
    $$('.bingo-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.dataset.cell, 10);
        onCellTap(idx);
      });
    });

    // Camera controls
    els.cameraShutterBtn.addEventListener('click', capturePhoto);
    els.cameraCancelBtn.addEventListener('click', closeCamera);
    els.cameraSwitchBtn.addEventListener('click', switchCamera);
    els.retakeBtn.addEventListener('click', () => {
      els.cameraPreview.style.display = 'none';
      els.cameraResult.style.display = 'none';
      els.cameraControls.style.display = 'flex';
    });
    els.submitPhotoBtn.addEventListener('click', submitPhoto);

    // Victory modal
    els.victoryLeaderboardBtn.addEventListener('click', () => {
      closeModal(els.victoryModal);
      openLeaderboard();
    });
    els.victoryPlayAgainBtn.addEventListener('click', playAgain);

    // Leaderboard
    els.leaderboardToggleBtn.addEventListener('click', openLeaderboard);
    els.welcomeLeaderboardBtn.addEventListener('click', openLeaderboard);
    els.closeLeaderboardBtn.addEventListener('click', () => closeModal(els.leaderboardModal));
    els.leaderboardModal.addEventListener('click', (e) => {
      if (e.target === els.leaderboardModal) closeModal(els.leaderboardModal);
    });

    // Leaderboard tabs
    els.leaderboardTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.lb-tab');
      if (!tab) return;
      $$('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderLeaderboard(tab.dataset.lbLocation);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.cameraOverlay.classList.contains('active')) closeCamera();
        else if (els.victoryModal.classList.contains('active')) closeModal(els.victoryModal);
        else if (els.leaderboardModal.classList.contains('active')) closeModal(els.leaderboardModal);
        else if (els.playerModal.classList.contains('active')) closeModal(els.playerModal);
      }
    });
  }


  /* ═══════════════════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════════════════ */
  async function init() {
    cacheDom();
    bindEvents();

    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Try to recover existing session
    const recovered = await tryRecoverSession();
    if (!recovered) {
      resetTimer();
    }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
