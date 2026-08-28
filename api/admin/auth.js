const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mgm-okto-admin-2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'mgm-admin-jwt-secret-2026-okto';

function createAdminToken(data) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (data.exp && data.exp < Date.now()) return null; // Expired
    return data;
  } catch (e) {
    return null;
  }
}

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

module.exports = async (req, res) => {
  handleCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { password } = body || {};

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid password.' });
  }

  const token = createAdminToken({ role: 'admin', authenticated_at: Date.now() });

  return res.status(200).json({
    success: true,
    token,
    expires_in: 86400
  });
};

// Export helpers for use by other admin endpoints
module.exports.verifyAdminToken = verifyAdminToken;
module.exports.handleCors = handleCors;
