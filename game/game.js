/**
 * mgm Oktoberfest 2026 — Photo Bingo Game
 * ═══════════════════════════════════════════
 * Game logic, camera capture, timer, leaderboard, and anti-cheat.
 */

(function () {
  'use strict';

  /* ─── CONSTANTS ─── */
  const API_BASE = '/api/game';
  const BINGO_LINE_NAMES = {
    'row-0': 'Row 1', 'row-1': 'Row 2', 'row-2': 'Row 3',
    'col-0': 'Col 1', 'col-1': 'Col 2', 'col-2': 'Col 3',
    'diag-main': 'Diagonal ↘', 'diag-anti': 'Diagonal ↙'
  };

  /* ─── GAME STATE ─── */
  let gameState = {
    sessionId: null,
    sessionToken: null,
    playerName: '',
    location: 'danang',
    challenges: [],
    completedCells: [],
    status: 'idle',
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
        return;
      }

      cell.querySelector('.cell-icon').textContent = challenge.icon || '🎯';
      cell.querySelector('.cell-text').textContent = challenge.challenge;

      if (gameState.completedCells.includes(i)) {
        cell.classList.add('completed');
      } else {
        cell.classList.remove('completed');
      }

      if (gameState.bingoLine) {
        const lineIdx = getBingoLineIndices(gameState.bingoLine);
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
        setTimeout(() => {
          cell.classList.remove('revealing');
          cell.classList.add('revealed');
          const challenge = gameState.challenges[i];
          if (challenge) {
            cell.querySelector('.cell-icon').textContent = challenge.icon || '🎯';
            cell.querySelector('.cell-text').textContent = challenge.challenge;
          }
        }, 200 + i * 150);
      });
      setTimeout(resolve, 200 + 9 * 150 + 250);
    });
  }

  /* ═══════════════════════════════════════════════════════
     GAME FLOW
     ═══════════════════════════════════════════════════════ */
  function onStartGame() {
    openModal(els.playerModal);
    setTimeout(() => els.playerName?.focus(), 200);
    detectLocation();
  }

  async function onPlayerSubmit(e) {
    e.preventDefault();

    const name = (els.playerName.value || '').trim();
    if (name.length < 2 || name.length > 30) {
      showToast('Tên người chơi phải từ 2 - 30 ký tự', 'error');
      els.playerName.classList.add('shake');
      setTimeout(() => els.playerName.classList.remove('shake'), 500);
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
        throw new Error(data.error || 'Không thể bắt đầu game');
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
      els.gameWelcome.classList.add('hidden');

      await runRevealAnimation();
      startTimer();
      showToast('Game đã bắt đầu! Chạm vào ô bất kỳ để chụp ảnh 📸', 'success');

    } catch (err) {
      showToast(err.message || 'Lỗi kết nối máy chủ. Thử lại sau.', 'error');
    } finally {
      els.submitPlayerBtn.querySelector('.btn-text').style.display = '';
      els.submitPlayerBtn.querySelector('.btn-loading').style.display = 'none';
      els.submitPlayerBtn.disabled = false;
    }
  }

  function onCellTap(cellIndex) {
    if (gameState.status !== 'playing') {
      onStartGame();
      return;
    }
    if (gameState.completedCells.includes(cellIndex)) {
      showToast('Ô này đã hoàn thành rồi! ✅', 'info');
      return;
    }

    currentCellIndex = cellIndex;
    const challenge = gameState.challenges[cellIndex];
    if (challenge) {
      els.cameraIcon.textContent = challenge.icon || '📸';
      els.cameraChallenge.textContent = challenge.challenge;
    }

    openCamera();
  }

  function capturePhoto() {
    const video = els.cameraVideo;
    const canvas = els.cameraCanvas;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    els.previewImage.src = dataUrl;

    els.cameraControls.style.display = 'none';
    els.cameraPreview.style.display = 'flex';
  }

  async function submitPhoto() {
    const dataUrl = els.previewImage.src;
    const base64 = dataUrl.split(',')[1];

    els.cameraPreview.style.display = 'none';
    els.cameraLoading.style.display = 'flex';

    try {
      const res = await fetch(`${API_BASE}/submit-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: gameState.sessionToken,
          cell_index: currentCellIndex,
          photo_base64: base64
        })
      });

      const data = await res.json();
      els.cameraLoading.style.display = 'none';

      if (!res.ok) {
        throw new Error(data.error || 'Nộp ảnh thất bại');
      }

      if (data.verified) {
        if (data.session_token) {
          gameState.sessionToken = data.session_token;
        }

        els.resultIcon.textContent = '✅';
        els.resultText.textContent = 'Hợp lệ! Tuyệt vời!';
        els.cameraResult.style.display = 'block';
        els.cameraResult.className = 'camera-result result-success';

        gameState.completedCells.push(currentCellIndex);
        saveSession();

        setTimeout(() => {
          closeCamera();
          renderBoard();

          if (data.is_bingo) {
            onBingo(data);
          }
        }, 1100);

      } else {
        els.resultIcon.textContent = '❌';
        els.resultText.textContent = data.reason || 'Ảnh chưa khớp thử thách, hãy thử lại nhé!';
        els.cameraResult.style.display = 'block';
        els.cameraResult.className = 'camera-result result-fail';

        setTimeout(() => {
          els.cameraResult.style.display = 'none';
          els.cameraControls.style.display = 'flex';
        }, 2200);
      }

    } catch (err) {
      els.cameraLoading.style.display = 'none';
      showToast(err.message || 'Lỗi gửi ảnh. Vui lòng thử lại.', 'error');
      els.cameraControls.style.display = 'flex';
    }
  }

  function onBingo(data) {
    gameState.status = 'completed';
    gameState.elapsedMs = data.elapsed_ms;
    gameState.bingoLine = data.bingo_line;
    gameState.rank = data.rank || 1;
    saveSession();

    stopTimer(data.elapsed_ms);
    renderBoard();

    els.victoryTime.textContent = formatTime(data.elapsed_ms);
    els.victoryRank.textContent = `#${data.rank || 1}`;
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
      showToast('Không thể mở camera. Vui lòng cấp quyền truy cập camera trong trình duyệt.', 'error', 5000);
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
      showToast('Không thể đổi camera.', 'error');
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
                    Math.abs(entry.elapsed_ms - (gameState.elapsedMs || 0)) < 1000;

      const tr = document.createElement('tr');
      if (isMe) tr.classList.add('lb-current-player');
      if (rank <= 3) tr.classList.add(`lb-top-${rank}`);

      tr.innerHTML = `
        <td class="lb-rank">${medal}</td>
        <td class="lb-name">${escapeHtml(entry.player_name)}</td>
        <td class="lb-time">${formatTime(entry.elapsed_ms || 0)}</td>
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
     SESSION PERSISTENCE
     ═══════════════════════════════════════════════════════ */
  function saveSession() {
    try {
      localStorage.setItem('bingo_session_token', gameState.sessionToken || '');
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    try { localStorage.removeItem('bingo_session_token'); } catch (e) { /* ignore */ }
  }

  async function tryRecoverSession() {
    try {
      const savedToken = localStorage.getItem('bingo_session_token');
      if (!savedToken) return false;

      const res = await fetch(`${API_BASE}/session?token=${encodeURIComponent(savedToken)}`);
      if (!res.ok) {
        clearSession();
        return false;
      }

      const data = await res.json();
      if (!data.session_id) {
        clearSession();
        return false;
      }

      gameState.sessionId = data.session_id;
      gameState.sessionToken = savedToken;
      gameState.playerName = data.player_name;
      gameState.location = data.location;
      gameState.challenges = data.challenges;
      gameState.startedAt = data.started_at;
      gameState.completedCells = data.completed_cells || [];
      gameState.status = 'playing';

      els.gameWelcome.classList.add('hidden');
      renderBoard();
      startTimer();

      showToast('Đã khôi phục phiên chơi trước đó! 🎮', 'success');
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
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#d97706', '#ffffff', '#0284c7']
    });
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
      sessionId: null, sessionToken: null, playerName: '', location: gameState.location,
      challenges: [], completedCells: [], status: 'idle',
      startedAt: null, elapsedMs: null, bingoLine: null, rank: null
    };

    $$('.bingo-cell').forEach(cell => {
      cell.className = 'bingo-cell';
      cell.querySelector('.cell-icon').textContent = '❓';
      cell.querySelector('.cell-text').textContent = '???';
    });

    els.gameWelcome.classList.remove('hidden');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ═══════════════════════════════════════════════════════
     EVENT LISTENERS
     ═══════════════════════════════════════════════════════ */
  function bindEvents() {
    els.startGameBtn.addEventListener('click', onStartGame);
    els.playerForm.addEventListener('submit', onPlayerSubmit);
    els.closePlayerModal.addEventListener('click', () => closeModal(els.playerModal));
    els.playerModal.addEventListener('click', (e) => {
      if (e.target === els.playerModal) closeModal(els.playerModal);
    });

    $$('.location-btn').forEach(btn => {
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
      els.cameraPreview.style.display = 'none';
      els.cameraResult.style.display = 'none';
      els.cameraControls.style.display = 'flex';
    });
    els.submitPhotoBtn.addEventListener('click', submitPhoto);

    els.victoryLeaderboardBtn.addEventListener('click', () => {
      closeModal(els.victoryModal);
      openLeaderboard();
    });
    els.victoryPlayAgainBtn.addEventListener('click', playAgain);

    els.leaderboardToggleBtn.addEventListener('click', openLeaderboard);
    els.welcomeLeaderboardBtn.addEventListener('click', openLeaderboard);
    els.closeLeaderboardBtn.addEventListener('click', () => closeModal(els.leaderboardModal));
    els.leaderboardModal.addEventListener('click', (e) => {
      if (e.target === els.leaderboardModal) closeModal(els.leaderboardModal);
    });

    els.leaderboardTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.lb-tab');
      if (!tab) return;
      $$('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderLeaderboard(tab.dataset.lbLocation);
    });

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
    if (window.lucide) window.lucide.createIcons();

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
