// Constants
const API_BASE = '/api/admin';
const GAME_API_BASE = '/api/game';

// State
let adminToken = sessionStorage.getItem('admin_token') || null;
let currentReviewFilter = 'pending';
let currentLocationFilter = 'all';
let refreshInterval = null;
let currentGameControlState = 'active';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');
const ctrlStatusDot = document.getElementById('ctrlStatusDot');
const ctrlStatusText = document.getElementById('ctrlStatusText');
const btnCtrlStart = document.getElementById('btnCtrlStart');
const btnCtrlPause = document.getElementById('btnCtrlPause');
const btnCtrlFinish = document.getElementById('btnCtrlFinish');
const btnCtrlWaiting = document.getElementById('btnCtrlWaiting');
const gameCtrlHint = document.getElementById('gameCtrlHint');
let pendingGameCtrlAction = null;
const gameCtrlModal = document.getElementById('gameCtrlModal');
const ctrlConfirmModalCard = document.getElementById('ctrlConfirmModalCard');
const ctrlModalIconBadge = document.getElementById('ctrlModalIconBadge');
const ctrlModalTitle = document.getElementById('ctrlModalTitle');
const ctrlModalSubtitle = document.getElementById('ctrlModalSubtitle');
const ctrlModalDesc = document.getElementById('ctrlModalDesc');
const confirmGameCtrlBtn = document.getElementById('confirmGameCtrlBtn');

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (isAuthenticated()) {
        showDashboard();
    } else {
        showLogin();
    }
    bindEvents();
});

// Auth Functions
function isAuthenticated() {
    return !!adminToken;
}

function getAuthHeaders() {
    return {
        'Authorization': 'Bearer ' + adminToken,
        'Content-Type': 'application/json'
    };
}

async function login(password) {
    try {
        const response = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.token;
            sessionStorage.setItem('admin_token', adminToken);
            loginError.textContent = '';
            showDashboard();
        } else {
            loginError.textContent = data.message || 'Login failed';
        }
    } catch (err) {
        loginError.textContent = 'Connection error. Please try again.';
        console.error(err);
    }
}

function logout() {
    adminToken = null;
    sessionStorage.removeItem('admin_token');
    stopAutoRefresh();
    showLogin();
}

function showLogin() {
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    fetchDashboardStats();
    fetchReviews();
    fetchGameControlState();
    startAutoRefresh();
}

// Dashboard Functions
async function fetchDashboardStats() {
    if (!isAuthenticated()) return;
    try {
        const response = await fetch(`${API_BASE}/dashboard`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        if (response.ok) {
            const data = await response.json();
            renderStats(data.stats);
            if (adminLbLocation === 'all') {
                renderLeaderboard(data.leaderboard);
            } else {
                fetchAdminLeaderboard(adminLbLocation);
            }
        }
    } catch (err) {
        console.error('Failed to fetch stats:', err);
    }
}

function renderStats(stats) {
    if (!stats) return;
    document.getElementById('statTotalPlayers').textContent = stats.total_players || 0;
    const loc = stats.players_by_location || {};
    document.getElementById('statLocationBreakdown').textContent = `Da Nang: ${loc.danang || 0} | HCMC: ${loc.hcmc || 0}`;
    document.getElementById('statBingo').textContent = stats.total_completed || 0;
    
    const pending = stats.pending_reviews || 0;
    document.getElementById('statPending').textContent = pending;
    
    const pendingIndicator = document.getElementById('pendingIndicator');
    if (pending > 0) {
        pendingIndicator.classList.add('active');
    } else {
        pendingIndicator.classList.remove('active');
    }
    
    document.getElementById('statApproved').textContent = stats.approved_count || 0;
    document.getElementById('statRejected').textContent = stats.rejected_count || 0;
    document.getElementById('statAvgTime').textContent = stats.avg_completion_time_ms ? formatTime(stats.avg_completion_time_ms) : '00:00.00';
}

let adminLbLocation = 'all';

async function fetchAdminLeaderboard(location = 'all') {
    try {
        const response = await fetch(`${GAME_API_BASE}/leaderboard?location=${location}&_t=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            renderLeaderboard(data.leaderboard || []);
        }
    } catch (err) {
        console.error('Failed to fetch admin leaderboard:', err);
    }
}

let currentAllLeaderboardEntries = [];
let currentLbSearchQuery = '';

function renderLeaderboard(entries) {
    if (entries) currentAllLeaderboardEntries = entries;
    const tbody = document.getElementById('leaderboardBody');
    const emptyEl = document.getElementById('adminLbEmpty');
    if (!tbody) return;

    let locFiltered = currentAllLeaderboardEntries;
    if (adminLbLocation && adminLbLocation !== 'all') {
        locFiltered = locFiltered.filter(e => (e.location || '').toLowerCase() === adminLbLocation.toLowerCase());
    }

    const query = (currentLbSearchQuery || '').trim().toLowerCase();
    const filteredEntries = query
        ? locFiltered.filter(e => (e.player_name || '').toLowerCase().includes(query))
        : locFiltered;

    if (!filteredEntries || filteredEntries.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) {
            emptyEl.textContent = query
                ? `No player found matching "${escapeHTML(currentLbSearchQuery)}".`
                : (adminLbLocation !== 'all' ? `No completions yet for ${adminLbLocation === 'hcmc' ? 'HCMC' : 'Da Nang'}.` : 'No completions yet.');
            emptyEl.classList.remove('hidden');
        }
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    
    tbody.innerHTML = filteredEntries.map((entry, index) => {
        const rank = index + 1;
        const isTop1 = rank === 1;
        const medal = isTop1 ? '👑 #1' : `#${rank}`;
        const locationClass = (entry.location || '').toLowerCase() === 'danang' ? 'loc-danang' : 'loc-hcmc';
        const locationLabel = (entry.location || '').toLowerCase() === 'danang' ? 'Da Nang' : 'HCMC';

        return `
            <tr class="${isTop1 ? 'lb-winner-row' : ''}" ${isTop1 ? `onclick="openWinnerShowcaseAdmin('${adminLbLocation || 'all'}')"` : ''} title="${isTop1 ? 'Click to view Winner Showcase & 3x3 Board' : ''}">
                <td class="lb-rank">
                    ${isTop1 ? `<span class="lb-rank-crown">${medal}</span>` : `<span style="font-weight:700;">${medal}</span>`}
                </td>
                <td class="lb-name">
                    <div class="lb-player-with-prize">
                        <span style="font-weight:700; color:var(--gold);">${escapeHTML(entry.player_name)}</span>
                        ${isTop1 ? `<span class="sidebar-prize-badge">WINNER</span>` : ''}
                    </div>
                </td>
                <td class="lb-time" style="font-family:monospace; font-weight:700; color:${isTop1?'#fbbf24':'var(--gold)'};">${formatTime(entry.elapsed_ms || 0)}</td>
                <td class="lb-location">
                    <span class="location-badge ${locationClass}">${locationLabel}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Review Functions
let lastRenderedReviewsJson = '';

let currentPlayerSearchQuery = '';

async function fetchReviews() {
    if (!isAuthenticated()) return;
    try {
        const queryParams = new URLSearchParams({
            status: currentReviewFilter,
            location: currentLocationFilter
        });
        if (currentPlayerSearchQuery.trim()) {
            queryParams.set('player_name', currentPlayerSearchQuery.trim());
        }
        
        const response = await fetch(`${API_BASE}/reviews?${queryParams}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            renderReviews(data.reviews || []);
        }
    } catch (err) {
        console.error('Failed to fetch reviews:', err);
    }
}

let currentAllReviews = [];
let isMobileReviewsExpanded = false;
const MOBILE_REVIEW_LIMIT = 3;

function renderReviews(reviews) {
    currentAllReviews = reviews || [];
    const grid = document.getElementById('reviewGrid');
    const emptyMsg = document.getElementById('emptyReviewMsg');
    const showMoreContainer = document.getElementById('showMoreContainer');
    
    const query = (currentPlayerSearchQuery || '').trim().toLowerCase();
    const filteredReviews = query
        ? currentAllReviews.filter(r => (r.player_name || '').toLowerCase().includes(query))
        : currentAllReviews;

    if (!filteredReviews || filteredReviews.length === 0) {
        grid.innerHTML = '';
        emptyMsg.textContent = query
            ? `No reviews found for player "${escapeHTML(currentPlayerSearchQuery)}".`
            : 'No reviews found matching criteria.';
        emptyMsg.classList.remove('hidden');
        if (showMoreContainer) showMoreContainer.classList.add('hidden');
        lastRenderedReviewsJson = '[]';
        return;
    }
    
    emptyMsg.classList.add('hidden');

    const isMobile = window.innerWidth <= 768;
    const shouldTruncate = isMobile && !isMobileReviewsExpanded && filteredReviews.length > MOBILE_REVIEW_LIMIT;
    const displayedReviews = shouldTruncate ? filteredReviews.slice(0, MOBILE_REVIEW_LIMIT) : filteredReviews;

    // Prevent DOM thrashing and image flickering if reviews data hasn't changed
    const renderSignature = `${JSON.stringify(displayedReviews)}-${isMobile}-${isMobileReviewsExpanded}-${query}`;
    if (renderSignature === lastRenderedReviewsJson) {
        return;
    }
    lastRenderedReviewsJson = renderSignature;
    
    grid.innerHTML = displayedReviews.map(review => {
        let actionHTML = '';
        if (review.status === 'pending') {
            actionHTML = `
                <div class="review-actions">
                    <button type="button" class="btn-review btn-approve" onclick="approveReview(${review.id})">
                        <i data-lucide="check"></i> <span>Approve</span>
                    </button>
                    <button type="button" class="btn-review btn-reject" onclick="rejectReview(${review.id})">
                        <i data-lucide="x"></i> <span>Reject</span>
                    </button>
                </div>
            `;
        }
        
        const locationClass = review.office === 'danang' ? 'loc-danang' : 'loc-hcmc';
        const locationLabel = review.office === 'danang' ? 'Da Nang' : 'HCMC';
        const photoSrc = review.photo_url || '';
        const rot = getRotationFromUrl(photoSrc);
        const rotClass = rot > 0 ? `rot-${rot}` : '';
        const rotStyle = rot > 0 ? `style="transform: rotate(${rot}deg);"` : '';

        const imgTag = photoSrc 
            ? `<img src="${escapeHTML(photoSrc)}" alt="Challenge Photo" class="review-img ${rotClass}" ${rotStyle} loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231e293b%22 width=%22200%22 height=%22200%22/><text fill=%22%2394a3b8%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>No Image</text></svg>'">`
            : `<div class="review-img-placeholder"><i data-lucide="image-off"></i><span>No Image</span></div>`;

        const rankTextHTML = review.rank ? `<span class="player-rank-text">Rank #${review.rank}</span>` : '';

        const cleanReason = (review.reviewer_note || review.ai_reason || 'Photo does not match the challenge requirement.')
            .replace(/\s*\[phase1_ms:\d+\]/g, '')
            .trim();

        let statusTagHTML = '';
        if (review.status === 'approved') {
            statusTagHTML = `<span class="img-status-tag-approved">APPROVED</span>`;
        } else if (review.status === 'rejected') {
            statusTagHTML = `<span class="img-status-tag-rejected">REJECTED</span>`;
        }

        return `
            <div class="review-card ${review.status}">
                <div class="review-img-container ${review.status === 'rejected' ? 'img-rejected' : ''}" onclick="openPhotoPreview('${escapeHTML(photoSrc)}', '${escapeHTML(review.challenge_text)}')" title="Click to view full image">
                    ${imgTag}
                    ${photoSrc ? `<button type="button" class="img-quick-rot-btn" onclick="event.stopPropagation(); quickRotateReviewCard(this)" title="Rotate image 90°"><i data-lucide="rotate-cw"></i></button>` : ''}
                    <div class="img-zoom-hint"><i data-lucide="maximize-2"></i></div>
                    <span class="img-time-badge">${timeAgo(review.reviewed_at || review.created_at)}</span>
                    ${statusTagHTML}
                </div>
                <div class="review-content">
                    <div class="review-meta">
                        <div class="player-rank-group">
                            <span class="player-name">${escapeHTML(review.player_name)}</span>
                            ${rankTextHTML}
                        </div>
                        <span class="location-badge ${locationClass}">${locationLabel}</span>
                    </div>
                    <div class="review-challenge-box">
                        <span class="challenge-label">Challenge:</span>
                        <span class="review-challenge">${escapeHTML(review.challenge_text)}</span>
                    </div>
                    ${review.status === 'rejected' ? `
                        <div class="reject-reason-box">
                            <div class="reject-reason-header"><span>Rejection Reason:</span></div>
                            <div class="reject-reason-text">${escapeHTML(cleanReason)}</div>
                        </div>
                    ` : (review.ai_reason ? `
                        <div class="ai-reason-box">
                            <div class="ai-reason-header"><strong>AI Verdict:</strong></div>
                            <div class="ai-reason-text">${escapeHTML(review.ai_reason)}</div>
                        </div>
                    ` : '')}
                    ${review.status === 'approved' ? `
                        <div class="reviewer-note-box">
                            <div class="reviewer-note-content">
                                <span class="note-text">${escapeHTML(review.reviewer_note || 'Approved by AI ✓')}</span>
                            </div>
                            <button type="button" class="btn-note-reject" onclick="event.stopPropagation(); rejectReview(${review.id})" title="Overturn approval and Reject">
                                <i data-lucide="x"></i> <span>Reject</span>
                            </button>
                        </div>
                    ` : ''}
                    ${actionHTML}
                </div>
            </div>
        `;
    }).join('');

    // Handle Mobile Show More button
    if (showMoreContainer) {
        if (isMobile && reviews.length > MOBILE_REVIEW_LIMIT) {
            showMoreContainer.classList.remove('hidden');
            if (isMobileReviewsExpanded) {
                showMoreContainer.innerHTML = `
                    <button type="button" id="btnShowMore" class="btn-show-more">
                        <i data-lucide="chevron-up"></i> <span>Show Less</span>
                    </button>
                `;
            } else {
                const remaining = reviews.length - MOBILE_REVIEW_LIMIT;
                showMoreContainer.innerHTML = `
                    <button type="button" id="btnShowMore" class="btn-show-more">
                        <i data-lucide="chevron-down"></i> <span>Show More (${remaining} more)</span>
                    </button>
                `;
            }
            const btn = document.getElementById('btnShowMore');
            if (btn) {
                btn.onclick = () => {
                    isMobileReviewsExpanded = !isMobileReviewsExpanded;
                    lastRenderedReviewsJson = '';
                    renderReviews(currentAllReviews);
                };
            }
        } else {
            showMoreContainer.classList.add('hidden');
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

async function approveReview(reviewId) {
    await submitReviewAction(reviewId, 'approve');
}

let pendingRejectReviewId = null;

function openRejectModal(reviewId) {
    pendingRejectReviewId = reviewId;
    const rejectModal = document.getElementById('rejectModal');
    const input = document.getElementById('rejectReasonInput');
    if (input) {
        input.value = 'Photo does not match challenge requirement.';
    }
    if (rejectModal) {
        rejectModal.classList.remove('hidden');
        setTimeout(() => {
            if (input) {
                input.focus();
                input.select();
            }
        }, 60);
        if (window.lucide) lucide.createIcons();
    }
}

function closeRejectModal() {
    pendingRejectReviewId = null;
    const rejectModal = document.getElementById('rejectModal');
    if (rejectModal) {
        rejectModal.classList.add('hidden');
    }
}

function setRejectReason(reason) {
    const input = document.getElementById('rejectReasonInput');
    if (input) {
        input.value = reason;
        input.focus();
    }
}

async function confirmRejection() {
    if (!pendingRejectReviewId) return;
    const input = document.getElementById('rejectReasonInput');
    const reason = (input && input.value.trim()) || 'Photo does not match challenge requirement.';
    const reviewId = pendingRejectReviewId;
    closeRejectModal();
    await submitReviewAction(reviewId, 'reject', reason);
}

function rejectReview(reviewId) {
    openRejectModal(reviewId);
}

async function submitReviewAction(reviewId, action, note = '') {
    try {
        const response = await fetch(`${API_BASE}/review-action`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ review_id: reviewId, action, note })
        });
        
        if (response.ok) {
            showToast(`${action === 'approve' ? 'Approved' : 'Rejected'} successfully!`, 'success');
            lastRenderedReviewsJson = ''; // Reset diff cache to force immediate UI update
            fetchReviews();
            fetchDashboardStats();
        } else {
            const data = await response.json();
            showToast(data.message || `Failed to ${action}`, 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
        console.error(err);
    }
}

// ─── PHOTO ORIENTATION & MODAL FUNCTIONS ───
const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalChallenge = document.getElementById('modalChallengeText');

function getRotationFromUrl(url) {
    if (!url || typeof url !== 'string') return 0;
    const match = url.match(/[#?&]rot=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}
window.getRotationFromUrl = getRotationFromUrl;

function quickRotateReviewCard(btn) {
    const container = btn.closest('.review-img-container');
    if (!container) return;
    const img = container.querySelector('.review-img');
    if (!img) return;
    let currentRot = parseInt(img.getAttribute('data-manual-rot') || getRotationFromUrl(img.src) || 0, 10);
    currentRot = (currentRot + 90) % 360;
    img.setAttribute('data-manual-rot', currentRot);
    img.className = 'review-img' + (currentRot > 0 ? ` rot-${currentRot}` : '');
    img.style.transform = currentRot > 0 ? `rotate(${currentRot}deg)` : '';
}
window.quickRotateReviewCard = quickRotateReviewCard;

function rotateModalPhoto() {
    if (!modalImage) return;
    let currentRot = parseInt(modalImage.getAttribute('data-rot') || 0, 10);
    currentRot = (currentRot + 90) % 360;
    modalImage.setAttribute('data-rot', currentRot);
    modalImage.className = currentRot > 0 ? `rot-${currentRot}` : '';
    modalImage.style.transform = currentRot > 0 ? `rotate(${currentRot}deg)` : '';
}
window.rotateModalPhoto = rotateModalPhoto;

function openPhotoPreview(url, challenge) {
    const rot = getRotationFromUrl(url);
    modalImage.setAttribute('data-rot', rot);
    modalImage.className = rot > 0 ? `rot-${rot}` : '';
    modalImage.style.transform = rot > 0 ? `rotate(${rot}deg)` : '';
    modalImage.src = url;
    modalChallenge.textContent = challenge;
    modal.classList.remove('hidden');
    if (window.lucide) {
        lucide.createIcons();
    }
}

window.approveReview = approveReview;
window.rejectReview = rejectReview;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.setRejectReason = setRejectReason;
window.confirmRejection = confirmRejection;
window.openPhotoPreview = openPhotoPreview;
window.closePhotoPreview = closePhotoPreview;

function closePhotoPreview() {
    modal.classList.add('hidden');
    modalImage.src = '';
    modalImage.className = '';
    modalImage.style.transform = '';
    modalImage.removeAttribute('data-rot');
}

// Event Listeners
function bindEvents() {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        login(passwordInput.value);
    });
    
    logoutBtn.addEventListener('click', logout);
    document.getElementById('closeModalBtn')?.addEventListener('click', closePhotoPreview);
    
    // Admin Leaderboard Accordion Toggle
    const adminLbToggleBtn = document.getElementById('adminLbToggleBtn');
    const adminLbContent = document.getElementById('adminLbContent');
    if (adminLbToggleBtn && adminLbContent) {
        adminLbToggleBtn.addEventListener('click', () => {
            const isCollapsed = adminLbContent.classList.toggle('collapsed');
            adminLbToggleBtn.classList.toggle('active', !isCollapsed);
            adminLbToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
        });
    }

    // Admin Leaderboard Location Tabs
    const adminLbTabs = document.getElementById('adminLbTabs');
    if (adminLbTabs) {
        adminLbTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.lb-filter-tab');
            if (!tab) return;
            adminLbTabs.querySelectorAll('.lb-filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            adminLbLocation = tab.dataset.lbLocation || 'all';
            renderLeaderboard();
            fetchAdminLeaderboard(adminLbLocation);
        });
    }

    // Status Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentReviewFilter = e.target.dataset.filter;
            isMobileReviewsExpanded = false;
            lastRenderedReviewsJson = '';
            fetchReviews();
        });
    });
    
    // Expandable Photo Review Player Name Search
    const headerSearchExpand = document.getElementById('headerSearchExpand');
    const btnSearchToggle = document.getElementById('btnSearchToggle');
    const btnCloseExpand = document.getElementById('btnCloseExpand');
    const playerFilterInput = document.getElementById('playerFilterInput');

    function closeAndResetPlayerSearch() {
        if (!headerSearchExpand) return;
        headerSearchExpand.classList.remove('open');
        if (playerFilterInput) {
            playerFilterInput.value = '';
        }
        if (currentPlayerSearchQuery !== '') {
            currentPlayerSearchQuery = '';
            lastRenderedReviewsJson = '';
            renderReviews(currentAllReviews);
        }
    }

    if (btnSearchToggle && headerSearchExpand) {
        btnSearchToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (headerSearchExpand.classList.contains('open')) {
                closeAndResetPlayerSearch();
            } else {
                headerSearchExpand.classList.add('open');
                if (playerFilterInput) {
                    playerFilterInput.focus();
                }
            }
        });
    }

    if (btnCloseExpand) {
        btnCloseExpand.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAndResetPlayerSearch();
        });
    }

    if (playerFilterInput) {
        playerFilterInput.addEventListener('input', (e) => {
            currentPlayerSearchQuery = e.target.value;
            isMobileReviewsExpanded = false;
            renderReviews(currentAllReviews);
        });
    }

    // Close expandable search on outside click
    document.addEventListener('click', (e) => {
        if (headerSearchExpand && headerSearchExpand.classList.contains('open')) {
            if (!headerSearchExpand.contains(e.target)) {
                closeAndResetPlayerSearch();
            }
        }
    });

    // Location Filter
    document.getElementById('locationFilter').addEventListener('change', (e) => {
        currentLocationFilter = e.target.value;
        isMobileReviewsExpanded = false;
        lastRenderedReviewsJson = '';
        fetchReviews();
    });

    // Window resize handler for mobile responsive limit
    window.addEventListener('resize', () => {
        if (currentAllReviews && currentAllReviews.length > 0) {
            renderReviews(currentAllReviews);
        }
    });
    
    // Close modal on outside click
    modal.querySelector('.modal-overlay').addEventListener('click', closePhotoPreview);

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const photoModal = document.getElementById('photoModal');
            const rejectModal = document.getElementById('rejectModal');
            const winnerModal = document.getElementById('winnerShowcaseModal');

            if (headerSearchExpand && headerSearchExpand.classList.contains('open')) {
                closeAndResetPlayerSearch();
            } else if (photoModal && !photoModal.classList.contains('hidden')) {
                closePhotoPreview();
            } else if (rejectModal && !rejectModal.classList.contains('hidden')) {
                closeRejectModal();
            } else if (winnerModal && !winnerModal.classList.contains('hidden')) {
                closeWinnerShowcaseAdmin();
            } else if (gameCtrlModal && !gameCtrlModal.classList.contains('hidden')) {
                closeGameCtrlModal();
            }
        }
    });

    // Ctrl+Enter / Cmd+Enter to confirm rejection
    const rejectTextarea = document.getElementById('rejectReasonInput');
    if (rejectTextarea) {
        rejectTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                confirmRejection();
            }
        });
    }

    // Game Controller buttons — trigger custom themed confirmation modal
    if (btnCtrlStart) {
        btnCtrlStart.addEventListener('click', () => {
            openGameCtrlModal('start');
        });
    }

    if (btnCtrlPause) {
        btnCtrlPause.addEventListener('click', () => {
            openGameCtrlModal('pause');
        });
    }

    if (btnCtrlFinish) {
        btnCtrlFinish.addEventListener('click', () => {
            openGameCtrlModal('finish');
        });
    }

    if (btnCtrlWaiting) {
        btnCtrlWaiting.addEventListener('click', () => {
            openGameCtrlModal('waiting');
        });
    }
}

// Auto Refresh (Every 2 seconds)
function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(() => {
        fetchDashboardStats();
        fetchReviews();
        fetchGameControlState();
    }, 2000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Utilities
function formatTime(ms) {
    if (ms == null) return '00:00.00';
    const date = new Date(ms);
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const milliseconds = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " years ago";
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hours ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " mins ago";
    return Math.floor(seconds) + " secs ago";
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

let toastTimeout;
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.classList.remove('hidden');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}

/* ═══════════════════════════════════════════════════════
   ADMIN WINNER SHOWCASE MODAL (Top 1 Board Preview)
   ═══════════════════════════════════════════════════════ */
const BINGO_LINE_NAMES = {
    'row-0': 'Top Row',
    'row-1': 'Middle Row',
    'row-2': 'Bottom Row',
    'col-0': 'Left Column',
    'col-1': 'Center Column',
    'col-2': 'Right Column',
    'diag-main': 'Main Diagonal',
    'diag-anti': 'Anti Diagonal'
};

const CATEGORY_ICONS = {
    'Beer': 'beer',
    'Food': 'utensils',
    'Outfit': 'shirt',
    'Fun & Games': 'party-popper',
    'People': 'users',
    'Social': 'users',
    'Team Building': 'handshake',
    'Marketing': 'camera',
    'Atmosphere': 'sparkles'
};

function closeWinnerShowcaseAdmin() {
    const modal = document.getElementById('winnerShowcaseModal');
    if (modal) modal.classList.add('hidden');
}

async function openWinnerShowcaseAdmin(location) {
    const modal = document.getElementById('winnerShowcaseModal');
    const nameEl = document.getElementById('adminWinnerPlayerName');
    const locBadge = document.getElementById('adminWinnerLocationBadge');
    const timeBadge = document.getElementById('adminWinnerTimeBadge');
    const lineBadge = document.getElementById('adminWinnerLineBadge');
    const boardEl = document.getElementById('adminWinnerMiniBoard');

    if (!modal) return;
    modal.classList.remove('hidden');

    if (nameEl) nameEl.textContent = 'Loading Champion...';
    if (boardEl) boardEl.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:var(--text-muted);">Loading winner board...</div>';

    try {
        const targetLoc = location || adminLbLocation || 'all';
        const res = await fetch(`/api/game/winner?location=${targetLoc}`);
        if (!res.ok) throw new Error('Failed to load winner');
        const data = await res.json();
        if (!data.success || !data.winner) {
            if (nameEl) nameEl.textContent = 'No Champion Yet';
            if (boardEl) boardEl.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:var(--gold); font-weight:700;">No champions yet for this filter.</div>';
            return;
        }

        const winner = data.winner;
        const winnerHasSnapshot = (winner.challenges && winner.challenges.length === 9);
        const rawChallenges = winnerHasSnapshot ? winner.challenges : Array.from({length: 9}, (_, idx) => ({ id: `w_${idx}`, category: 'Social', icon: 'camera', challenge: `Challenge #${idx+1}` }));
        const completedCells = (winner.completed_cells || []).map(Number);
        const cellPhotos = winner.cell_photos || {};

        let winningLineKey = winner.bingo_line;
        if (!winningLineKey) {
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
            for (const l of lines) {
                if (l.indices.every(idx => completedCells.includes(idx))) {
                    winningLineKey = l.name;
                    break;
                }
            }
            if (!winningLineKey) winningLineKey = 'row-0';
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

        if (nameEl) nameEl.textContent = winner.player_name || 'Champion';
        if (locBadge) {
            locBadge.textContent = winner.location === 'danang' ? 'Da Nang' : (winner.location === 'hcmc' ? 'HCMC' : 'All Offices');
            locBadge.className = `location-badge ${winner.location === 'danang' ? 'loc-danang' : 'loc-hcmc'}`;
        }
        if (timeBadge) timeBadge.innerHTML = `<i data-lucide="timer"></i> ${formatTime(winner.elapsed_ms || 0)}`;
        if (lineBadge) lineBadge.innerHTML = `<i data-lucide="award"></i> ${BINGO_LINE_NAMES[winningLineKey] || winningLineKey || 'BINGO Line'}`;

        if (boardEl) {
            boardEl.innerHTML = '';
            for (let idx = 0; idx < 9; idx++) {
                const isWinningCell = winningIndices.includes(idx);
                const ch = rawChallenges[idx] || { id: `w_${idx}`, category: 'Social', icon: 'camera', challenge: `Challenge #${idx+1}` };
                const photoUrl = cellPhotos[idx] || cellPhotos[String(idx)] || null;
                const catIcon = CATEGORY_ICONS[ch.category] || 'camera';

                const cellEl = document.createElement('div');
                cellEl.className = `winner-mini-cell ${isWinningCell ? 'winner-winning-cell' : ''}`;

                if (isWinningCell) {
                    if (photoUrl) {
                        cellEl.style.backgroundImage = `linear-gradient(rgba(11, 19, 43, 0.25), rgba(11, 19, 43, 0.65)), url('${photoUrl}')`;
                    }
                    cellEl.innerHTML = `
                        <div class="winner-cell-overlay"></div>
                        <div class="winner-cell-cat-icon"><i data-lucide="${catIcon}"></i></div>
                        <div class="winner-cell-check"><i data-lucide="check"></i></div>
                        <p class="winner-cell-text">${escapeHTML(ch.challenge)}</p>
                    `;
                    if (photoUrl) {
                        cellEl.title = `Click to zoom photo for ${ch.challenge}`;
                        cellEl.addEventListener('click', (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openPhotoPreview(photoUrl, `${winner.player_name} — ${ch.challenge}`);
                        });
                    }
                } else {
                    cellEl.innerHTML = `
                        <div class="winner-cell-overlay"></div>
                        <p class="winner-cell-text">${escapeHTML(ch.challenge)}</p>
                    `;
                }
                boardEl.appendChild(cellEl);
            }
        }

        if (window.lucide) {
            lucide.createIcons();
        }
    } catch (err) {
        console.error('Failed to load winner showcase:', err);
        if (nameEl) nameEl.textContent = 'Error Loading Winner';
        if (boardEl) boardEl.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 2rem; color:#ef4444;">Failed to load winner board.</div>';
    }
}

// ═══════════════════════════════════════════════════════
// GAME REMOTE CONTROLLER FUNCTIONS
// ═══════════════════════════════════════════════════════

async function fetchGameControlState() {
    if (!isAuthenticated()) return;
    try {
        const response = await fetch(`${GAME_API_BASE}/check-reviews?_t=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.game_state) {
                currentGameControlState = data.game_state;
                updateGameControlUI(data.game_state);
            }
        }
    } catch (err) {
        console.error('Failed to fetch game control state:', err);
    }
}

async function setGameControlState(action) {
    if (!isAuthenticated()) return;
    try {
        // Optimistic UI disabling while waiting
        if (btnCtrlStart) btnCtrlStart.disabled = true;
        if (btnCtrlPause) btnCtrlPause.disabled = true;
        if (btnCtrlFinish) btnCtrlFinish.disabled = true;
        if (btnCtrlWaiting) btnCtrlWaiting.disabled = true;

        const response = await fetch(`${API_BASE}/review-action`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action })
        });

        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }

        const data = await response.json();
        if (response.ok && data.success) {
            currentGameControlState = data.state;
            updateGameControlUI(data.state);
            showToast(data.message || `Game status updated to: ${data.state}`, 'success');
            if (data.was_reset) {
                // Immediately refresh stats and review queue to show clean 0s
                fetchDashboardStats();
                fetchReviews();
            }
        } else {
            showToast(data.error || 'Failed to update game control state', 'error');
            updateGameControlUI(currentGameControlState);
        }
    } catch (err) {
        console.error('Failed to set game control state:', err);
        showToast('Connection error updating game control state', 'error');
        updateGameControlUI(currentGameControlState);
    }
}

function updateGameControlUI(state) {
    if (!ctrlStatusDot || !ctrlStatusText) return;

    // Reset classes
    ctrlStatusDot.className = 'ctrl-status-dot';

    switch (state) {
        case 'waiting':
            ctrlStatusDot.classList.add('dot-waiting');
            ctrlStatusText.textContent = 'Waiting';
            ctrlStatusText.style.color = '#eab308';
            if (btnCtrlStart) {
                btnCtrlStart.disabled = false;
                btnCtrlStart.innerHTML = '<i data-lucide="play"></i> <span>Start Game</span>';
            }
            if (btnCtrlPause) btnCtrlPause.disabled = true;
            if (btnCtrlFinish) btnCtrlFinish.disabled = true;
            if (btnCtrlWaiting) btnCtrlWaiting.disabled = true;
            if (gameCtrlHint) gameCtrlHint.textContent = '● Game is waiting to start. Players see "Game hasn\'t started yet".';
            break;

        case 'paused':
            ctrlStatusDot.classList.add('dot-paused');
            ctrlStatusText.textContent = 'Paused';
            ctrlStatusText.style.color = '#f97316';
            if (btnCtrlStart) {
                btnCtrlStart.disabled = false;
                btnCtrlStart.innerHTML = '<i data-lucide="play"></i> <span>Resume Game</span>';
            }
            if (btnCtrlPause) btnCtrlPause.disabled = true;
            if (btnCtrlFinish) btnCtrlFinish.disabled = false;
            if (btnCtrlWaiting) btnCtrlWaiting.disabled = false;
            if (gameCtrlHint) gameCtrlHint.textContent = '● Game is paused. Player screens are frozen with pause notification.';
            break;

        case 'finished':
            ctrlStatusDot.classList.add('dot-finished');
            ctrlStatusText.textContent = 'Finished';
            ctrlStatusText.style.color = '#ef4444';
            if (btnCtrlStart) {
                btnCtrlStart.disabled = false;
                btnCtrlStart.innerHTML = '<i data-lucide="rotate-ccw"></i> <span>Restart Game</span>';
            }
            if (btnCtrlPause) btnCtrlPause.disabled = true;
            if (btnCtrlFinish) btnCtrlFinish.disabled = true;
            if (btnCtrlWaiting) btnCtrlWaiting.disabled = false;
            if (gameCtrlHint) gameCtrlHint.textContent = '● Game has concluded! Players see "Thank you for joining!".';
            break;

        case 'active':
        default:
            ctrlStatusDot.classList.add('dot-active');
            ctrlStatusText.textContent = 'Active';
            ctrlStatusText.style.color = '#22c55e';
            if (btnCtrlStart) {
                btnCtrlStart.disabled = true;
                btnCtrlStart.innerHTML = '<i data-lucide="play"></i> <span>Start Game</span>';
            }
            if (btnCtrlPause) btnCtrlPause.disabled = false;
            if (btnCtrlFinish) btnCtrlFinish.disabled = false;
            if (btnCtrlWaiting) btnCtrlWaiting.disabled = false;
            if (gameCtrlHint) gameCtrlHint.textContent = '● Game is live! Players can connect and play freely.';
            break;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ═══════════════════════════════════════════════════════
// GAME CONTROLLER CUSTOM CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════

function openGameCtrlModal(action) {
    if (!gameCtrlModal) return;
    pendingGameCtrlAction = action;

    // Reset card dynamic border classes
    if (ctrlConfirmModalCard) {
        ctrlConfirmModalCard.classList.remove('border-pause', 'border-start', 'border-finish', 'border-waiting');
    }
    if (ctrlModalIconBadge) {
        ctrlModalIconBadge.className = 'ctrl-modal-icon-badge';
    }
    if (confirmGameCtrlBtn) {
        confirmGameCtrlBtn.className = 'btn-modal-confirm-action';
    }

    if (action === 'pause') {
        if (ctrlConfirmModalCard) ctrlConfirmModalCard.classList.add('border-pause');
        if (ctrlModalIconBadge) {
            ctrlModalIconBadge.classList.add('theme-pause');
            ctrlModalIconBadge.innerHTML = '<i data-lucide="pause"></i>';
        }
        if (ctrlModalTitle) ctrlModalTitle.textContent = 'Pause the Game?';
        if (ctrlModalSubtitle) ctrlModalSubtitle.textContent = 'Temporary Organizer Halt';
        if (ctrlModalDesc) ctrlModalDesc.textContent = 'All player screens will be temporarily frozen with a pause notification. Player timers are stopped safely without penalty and will resume when unpaused.';
        if (confirmGameCtrlBtn) {
            confirmGameCtrlBtn.classList.add('btn-ctrl-confirm-pause');
            confirmGameCtrlBtn.innerHTML = '<i data-lucide="pause"></i> <span>Yes, Pause Game</span>';
        }
    } else if (action === 'start') {
        const isResuming = (currentGameControlState === 'paused');
        const isRestarting = (currentGameControlState === 'finished');
        if (ctrlConfirmModalCard) ctrlConfirmModalCard.classList.add('border-start');
        if (ctrlModalIconBadge) {
            ctrlModalIconBadge.classList.add('theme-start');
            ctrlModalIconBadge.innerHTML = isRestarting ? '<i data-lucide="rotate-ccw"></i>' : '<i data-lucide="play"></i>';
        }
        if (ctrlModalTitle) {
            ctrlModalTitle.textContent = isRestarting ? 'Restart the Game from Beginning?' : (isResuming ? 'Resume the Game?' : 'Start the Game?');
        }
        if (ctrlModalSubtitle) {
            ctrlModalSubtitle.textContent = isRestarting ? 'Fresh Round & Complete Data Reset' : (isResuming ? 'Resume Active Gameplay' : 'Live Game Activation');
        }
        if (ctrlModalDesc) {
            ctrlModalDesc.textContent = isRestarting
                ? 'Restarting after Finish will reset all player scores, photos, and review queue, starting a brand new game round. All player screens will return to the start screen. Are you sure?'
                : (isResuming
                    ? 'All player screens will be unfrozen immediately and their game timers will resume.'
                    : 'All player devices will be allowed to click Start Game and begin playing their BINGO challenges.');
        }
        if (confirmGameCtrlBtn) {
            confirmGameCtrlBtn.classList.add('btn-ctrl-confirm-start');
            confirmGameCtrlBtn.innerHTML = `<i data-lucide="${isRestarting ? 'rotate-ccw' : 'play'}"></i> <span>${isRestarting ? 'Yes, Reset & Restart Game' : (isResuming ? 'Yes, Resume Game' : 'Yes, Start Game')}</span>`;
        }
    } else if (action === 'finish') {
        if (ctrlConfirmModalCard) ctrlConfirmModalCard.classList.add('border-finish');
        if (ctrlModalIconBadge) {
            ctrlModalIconBadge.classList.add('theme-finish');
            ctrlModalIconBadge.innerHTML = '<i data-lucide="square"></i>';
        }
        if (ctrlModalTitle) ctrlModalTitle.textContent = 'Finish the Game?';
        if (ctrlModalSubtitle) ctrlModalSubtitle.textContent = 'Official Event Conclusion';
        if (ctrlModalDesc) ctrlModalDesc.textContent = 'This will conclude the game for all players and display the final celebration screen. All player scores and verified photos remain safely preserved in the leaderboard.';
        if (confirmGameCtrlBtn) {
            confirmGameCtrlBtn.classList.add('btn-ctrl-confirm-finish');
            confirmGameCtrlBtn.innerHTML = '<i data-lucide="square"></i> <span>Yes, Finish Game</span>';
        }
    } else if (action === 'waiting') {
        const isRestarting = (currentGameControlState === 'finished');
        if (ctrlConfirmModalCard) ctrlConfirmModalCard.classList.add('border-waiting');
        if (ctrlModalIconBadge) {
            ctrlModalIconBadge.classList.add('theme-waiting');
            ctrlModalIconBadge.innerHTML = '<i data-lucide="rotate-ccw"></i>';
        }
        if (ctrlModalTitle) ctrlModalTitle.textContent = isRestarting ? 'Reset & Set Game to Waiting?' : 'Set Game to Waiting?';
        if (ctrlModalSubtitle) ctrlModalSubtitle.textContent = isRestarting ? 'Fresh Round Setup & Data Reset' : 'Pre-Event Configuration';
        if (ctrlModalDesc) ctrlModalDesc.textContent = isRestarting
            ? 'This will reset all player scores, photos, and review queue, setting the game to waiting for the next round. Players cannot start until you click Start Game.'
            : 'Players can load the welcome page to review rules, but cannot start playing until you click Start Game.';
        if (confirmGameCtrlBtn) {
            confirmGameCtrlBtn.classList.add('btn-ctrl-confirm-waiting');
            confirmGameCtrlBtn.innerHTML = '<i data-lucide="rotate-ccw"></i> <span>Set to Waiting</span>';
        }
    }

    if (window.lucide) lucide.createIcons();
    gameCtrlModal.classList.remove('hidden');
}

function closeGameCtrlModal() {
    if (!gameCtrlModal) return;
    gameCtrlModal.classList.add('hidden');
    pendingGameCtrlAction = null;
}

function confirmGameControlAction() {
    if (!pendingGameCtrlAction) return;
    const actionToExecute = pendingGameCtrlAction;
    closeGameCtrlModal();
    setGameControlState(actionToExecute);
}


