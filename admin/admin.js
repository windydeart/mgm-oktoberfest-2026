// Constants
const API_BASE = '/api/admin';
const GAME_API_BASE = '/api/game';

// State
let adminToken = sessionStorage.getItem('admin_token') || null;
let currentReviewFilter = 'pending';
let currentLocationFilter = 'all';
let refreshInterval = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');

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
            renderLeaderboard(data.leaderboard);
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

function renderLeaderboard(entries) {
    const tbody = document.getElementById('leaderboardBody');
    if (!entries || entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = entries.map((entry, index) => `
        <tr>
            <td>${entry.rank || index + 1}</td>
            <td style="color:var(--gold)">${escapeHTML(entry.player_name)}</td>
            <td><span class="location-badge">${entry.location === 'danang' ? 'Da Nang' : 'HCMC'}</span></td>
            <td>${formatTime(entry.elapsed_ms)}</td>
        </tr>
    `).join('');
}

// Review Functions
let lastRenderedReviewsJson = '';

async function fetchReviews() {
    if (!isAuthenticated()) return;
    try {
        const queryParams = new URLSearchParams({
            status: currentReviewFilter,
            location: currentLocationFilter
        });
        
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

function renderReviews(reviews) {
    const grid = document.getElementById('reviewGrid');
    const emptyMsg = document.getElementById('emptyReviewMsg');
    
    if (reviews.length === 0) {
        grid.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        lastRenderedReviewsJson = '[]';
        return;
    }
    
    // Prevent DOM thrashing and image flickering if reviews data hasn't changed
    const reviewsJson = JSON.stringify(reviews);
    if (reviewsJson === lastRenderedReviewsJson) {
        return;
    }
    lastRenderedReviewsJson = reviewsJson;
    
    emptyMsg.classList.add('hidden');
    
    grid.innerHTML = reviews.map(review => {
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
        } else {
            const statusClass = review.status === 'approved' ? 'status-approved' : 'status-rejected';
            const statusIcon = review.status === 'approved' ? 'check-circle-2' : 'x-circle';
            const statusText = review.status === 'approved' ? 'Approved' : 'Rejected';
            actionHTML = `
                <div class="review-status-bar ${statusClass}">
                    <i data-lucide="${statusIcon}"></i>
                    <span>${statusText}</span>
                </div>
            `;
        }
        
        const locationClass = review.office === 'danang' ? 'loc-danang' : 'loc-hcmc';
        const locationLabel = review.office === 'danang' ? 'Da Nang' : 'HCMC';
        const photoSrc = review.photo_url || '';
        const imgTag = photoSrc 
            ? `<img src="${escapeHTML(photoSrc)}" alt="Challenge Photo" class="review-img" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231e293b%22 width=%22200%22 height=%22200%22/><text fill=%22%2394a3b8%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>No Image</text></svg>'">`
            : `<div class="review-img-placeholder"><i data-lucide="image-off"></i><span>No Image</span></div>`;

        let rankBadgeHTML = '';
        if (review.rank === 1) {
            const timeStr = review.elapsed_ms ? ` · ${formatTime(review.elapsed_ms)}` : '';
            rankBadgeHTML = `<span class="player-rank-badge rank-top1" title="Top 1 Contender"><i data-lucide="trophy"></i> Rank #1${timeStr}</span>`;
        } else if (review.rank === 2) {
            const timeStr = review.elapsed_ms ? ` · ${formatTime(review.elapsed_ms)}` : '';
            rankBadgeHTML = `<span class="player-rank-badge rank-top2" title="Rank 2 Contender"><i data-lucide="medal"></i> Rank #2${timeStr}</span>`;
        } else if (review.rank === 3) {
            const timeStr = review.elapsed_ms ? ` · ${formatTime(review.elapsed_ms)}` : '';
            rankBadgeHTML = `<span class="player-rank-badge rank-top3" title="Rank 3 Contender"><i data-lucide="medal"></i> Rank #3${timeStr}</span>`;
        } else if (review.rank && review.rank <= 10) {
            const timeStr = review.elapsed_ms ? ` · ${formatTime(review.elapsed_ms)}` : '';
            rankBadgeHTML = `<span class="player-rank-badge rank-top10"><i data-lucide="award"></i> Rank #${review.rank}${timeStr}</span>`;
        } else {
            rankBadgeHTML = `<span class="player-rank-badge rank-unranked"><i data-lucide="gamepad-2"></i> In Progress</span>`;
        }

        return `
            <div class="review-card ${review.status}">
                <div class="review-img-container" onclick="openPhotoPreview('${escapeHTML(photoSrc)}', '${escapeHTML(review.challenge_text)}')" title="Click to view full image">
                    ${imgTag}
                    <div class="img-zoom-hint"><i data-lucide="maximize-2"></i></div>
                    <span class="img-time-badge">${timeAgo(review.created_at)}</span>
                </div>
                <div class="review-content">
                    <div class="review-meta">
                        <div class="player-rank-group">
                            <span class="player-name">${escapeHTML(review.player_name)}</span>
                            ${rankBadgeHTML}
                        </div>
                        <span class="location-badge ${locationClass}">${locationLabel}</span>
                    </div>
                    <div class="review-challenge-box">
                        <span class="challenge-label">Challenge:</span>
                        <span class="review-challenge">${escapeHTML(review.challenge_text)}</span>
                    </div>
                    ${review.ai_reason ? `
                        <div class="ai-reason-box">
                            <div class="ai-reason-header"><i data-lucide="sparkles"></i> <strong>AI Verdict:</strong></div>
                            <div class="ai-reason-text">${escapeHTML(review.ai_reason)}</div>
                        </div>
                    ` : ''}
                    ${review.reviewer_note && review.status !== 'pending' ? `
                        <div class="reviewer-note-box">
                            <span class="note-label">Organizer Note:</span>
                            <span class="note-text">${escapeHTML(review.reviewer_note)}</span>
                        </div>
                    ` : ''}
                    ${actionHTML}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) {
        lucide.createIcons();
    }
}

async function approveReview(reviewId) {
    await submitReviewAction(reviewId, 'approve');
}

async function rejectReview(reviewId) {
    await submitReviewAction(reviewId, 'reject', 'Photo does not match the challenge requirement.');
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

// Modal Functions
const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalChallenge = document.getElementById('modalChallengeText');

function openPhotoPreview(url, challenge) {
    modalImage.src = url;
    modalChallenge.textContent = challenge;
    modal.classList.remove('hidden');
}

window.approveReview = approveReview;
window.rejectReview = rejectReview;
window.openPhotoPreview = openPhotoPreview;
window.closePhotoPreview = closePhotoPreview;

function closePhotoPreview() {
    modal.classList.add('hidden');
    modalImage.src = '';
}

// Event Listeners
function bindEvents() {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        login(passwordInput.value);
    });
    
    logoutBtn.addEventListener('click', logout);
    
    document.getElementById('closeModalBtn').addEventListener('click', closePhotoPreview);
    
    // Status Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentReviewFilter = e.target.dataset.filter;
            lastRenderedReviewsJson = '';
            fetchReviews();
        });
    });
    
    // Location Filter
    document.getElementById('locationFilter').addEventListener('change', (e) => {
        currentLocationFilter = e.target.value;
        lastRenderedReviewsJson = '';
        fetchReviews();
    });
    
    // Close modal on outside click
    modal.querySelector('.modal-overlay').addEventListener('click', closePhotoPreview);
}

// Auto Refresh (Every 2 seconds)
function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(() => {
        fetchDashboardStats();
        fetchReviews();
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
