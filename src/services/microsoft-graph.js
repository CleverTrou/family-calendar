/**
 * Microsoft Graph API helper.
 *
 * Handles OAuth2 token refresh and authenticated requests to Graph API.
 * No external dependencies — uses built-in fetch() (Node 18+).
 *
 * Tokens are stored in the credential store alongside calendar data.
 * Access tokens expire after ~1 hour; this module automatically refreshes
 * them using the stored refresh token.
 */

import { getAccount, setAccount } from './credential-store.js';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Buffer: refresh 5 minutes before actual expiry
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get a valid access token for Microsoft Graph API.
 * Automatically refreshes if expired or about to expire.
 */
async function getAccessToken(accountKey) {
  const account = getAccount(accountKey);
  if (!account) throw new Error('Microsoft account not found');

  const { clientId, clientSecret, refreshToken, accessToken, tokenExpiresAt } = account;

  // Check if current token is still valid
  if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt - EXPIRY_BUFFER_MS) {
    return accessToken;
  }

  // Refresh the token
  console.log('[Microsoft] Refreshing access token...');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'Calendars.Read Tasks.Read User.Read offline_access',
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.error_description || err.error || resp.statusText;
    throw new Error(`Token refresh failed: ${msg}`);
  }

  const tokens = await resp.json();

  // Store updated tokens
  setAccount(accountKey, {
    accessToken: tokens.access_token,
    tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    // Microsoft may rotate the refresh token
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
  });

  return tokens.access_token;
}

/**
 * Make an authenticated GET request to Microsoft Graph API.
 * Automatically refreshes the access token if needed.
 *
 * @param {string} accountKey - Credential store key (e.g., 'microsoft:default')
 * @param {string} path - Graph API path (e.g., '/me/calendars')
 * @param {Record<string, string>} [params] - Query parameters
 * @returns {Promise<object>} Parsed JSON response
 */
export async function graphGet(accountKey, path, params = {}) {
  const token = await getAccessToken(accountKey);

  const url = new URL(GRAPH_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph API ${resp.status}: ${resp.statusText}`);
  }

  return resp.json();
}

/**
 * Paginate through all pages of a Graph API collection.
 * Graph returns @odata.nextLink when there are more results.
 *
 * @param {string} accountKey - Credential store key
 * @param {string} path - Graph API path
 * @param {Record<string, string>} [params] - Query parameters
 * @returns {Promise<object[]>} All items across all pages
 */
export async function graphGetAll(accountKey, path, params = {}) {
  const items = [];
  let data = await graphGet(accountKey, path, params);
  items.push(...(data.value || []));

  while (data['@odata.nextLink']) {
    const token = await getAccessToken(accountKey);
    const resp = await fetch(data['@odata.nextLink'], {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) break;
    data = await resp.json();
    items.push(...(data.value || []));
  }

  return items;
}
