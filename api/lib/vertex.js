const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const crypto = require('crypto');

/**
 * Cache for Google OAuth2 access token to avoid signing JWT on every call.
 * Tokens are valid for 60 minutes; we cache for 50 minutes.
 */
let cachedToken = null;
let tokenExpiresAt = 0;

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Load Google Cloud Service Account credentials from:
 * 1. Environment variable GCP_SERVICE_ACCOUNT_KEY (JSON string or base64 encoded JSON)
 * 2. Local fallback JSON file in api/ directory
 */
function getVertexCredentials() {
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.GCP_SERVICE_ACCOUNT_KEY.trim();
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      }
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (e) {
      console.warn('Failed to parse GCP_SERVICE_ACCOUNT_KEY from environment:', e.message);
    }
  }

  // Fallback to local service account key file
  const localPaths = [
    join(process.cwd(), 'api', 'gen-lang-client-0983914563-d15a149d75b0.json'),
    join(__dirname, '..', 'gen-lang-client-0983914563-d15a149d75b0.json'),
    join(__dirname, 'gen-lang-client-0983914563-d15a149d75b0.json')
  ];

  for (const p of localPaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.warn(`Failed to read service account key at ${p}:`, e.message);
      }
    }
  }

  return null;
}

/**
 * Obtain a Google OAuth2 Access Token using RS256 JWT assertion.
 * Reuses cached token if still valid.
 */
async function getVertexAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && Date.now() < (tokenExpiresAt - 300000)) {
    return cachedToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  };

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const unsigned = `${encHeader}.${encPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const sig = base64url(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${sig}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google OAuth2 Token error (${tokenRes.status}): ${errBody.slice(0, 150)}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  tokenExpiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);

  return cachedToken;
}

/**
 * Call Gemini on Vertex AI with multi-region failover (Singapore first, then US).
 * Uses Singapore (asia-southeast1) for minimum latency to Vietnam.
 */
async function callVertexGemini({
  systemInstruction,
  contents,
  generationConfig = {},
  timeoutMs = 4000,
  models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  locations = ['asia-southeast1', 'us-central1']
}) {
  const sa = getVertexCredentials();
  if (!sa || !sa.client_email || !sa.private_key || !sa.project_id) {
    return { ok: false, error: 'Vertex AI credentials not configured' };
  }

  let accessToken;
  try {
    accessToken = await getVertexAccessToken(sa);
  } catch (err) {
    console.error('Failed to get Vertex access token:', err.message);
    return { ok: false, error: err.message };
  }

  const bodyPayload = {
    contents,
    generationConfig: {
      temperature: generationConfig.temperature ?? 0.1,
      maxOutputTokens: generationConfig.maxOutputTokens ?? 256,
      ...(generationConfig.topP !== undefined ? { topP: generationConfig.topP } : {}),
      ...(generationConfig.topK !== undefined ? { topK: generationConfig.topK } : {}),
      ...(generationConfig.responseMimeType ? { responseMimeType: generationConfig.responseMimeType } : {})
    },
    ...(systemInstruction ? {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      }
    } : {})
  };

  let lastError = null;

  for (const loc of locations) {
    for (const model of models) {
      const url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${loc}/publishers/google/models/${model}:generateContent`;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify(bodyPayload)
        });

        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return { ok: true, data, text, model, location: loc };
        }

        const errText = await res.text();
        console.warn(`Vertex AI (${loc}/${model}) HTTP ${res.status}:`, errText.slice(0, 150));
        lastError = `HTTP ${res.status}: ${errText.slice(0, 100)}`;
      } catch (callErr) {
        console.warn(`Vertex AI (${loc}/${model}) exception:`, callErr.message);
        lastError = callErr.message;
      }
    }
  }

  return { ok: false, error: lastError || 'All Vertex AI models/locations failed' };
}

module.exports = {
  getVertexCredentials,
  getVertexAccessToken,
  callVertexGemini
};
