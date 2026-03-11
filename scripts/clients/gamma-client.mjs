import { GAMMA_URL, DATA_URL, DEFAULT_SEARCH_LIMIT, DEFAULT_TIMEOUT_MS } from '../constants.mjs';
import { networkError } from '../errors.mjs';

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    throw networkError(`Network error fetching ${url}: ${err.message}`);
  }
  if (!res.ok) {
    throw networkError(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

/**
 * Search markets by keyword.
 * Returns array of market objects from the Gamma API.
 */
export async function searchMarkets(query, { limit = DEFAULT_SEARCH_LIMIT, active = true } = {}) {
  const params = new URLSearchParams({ _c: 'question', s: query, limit: String(limit) });
  if (active) params.set('active', 'true');
  const url = `${GAMMA_URL}/markets?${params}`;
  const data = await fetchJson(url);
  // Gamma returns array directly or { data: [...] }
  return Array.isArray(data) ? data : (data?.data || data?.markets || []);
}

/**
 * Get a market by condition ID or slug.
 */
export async function getMarket(conditionIdOrSlug) {
  // Try by condition ID first (0x prefix or exact match)
  if (conditionIdOrSlug.startsWith('0x')) {
    try {
      const url = `${GAMMA_URL}/markets/${conditionIdOrSlug}`;
      const data = await fetchJson(url);
      if (data && !data.error) return data;
    } catch { /* fall through */ }
  }

  // Try by slug
  const params = new URLSearchParams({ slug: conditionIdOrSlug });
  const url = `${GAMMA_URL}/markets?${params}`;
  const data = await fetchJson(url);
  const results = Array.isArray(data) ? data : (data?.data || data?.markets || []);
  if (results.length > 0) return results[0];

  // Try searching by question text
  const searchResults = await searchMarkets(conditionIdOrSlug, { limit: 5 });
  if (searchResults.length > 0) return searchResults[0];

  return null;
}

/**
 * Get an event by slug.
 */
export async function getEvent(slug) {
  const params = new URLSearchParams({ slug });
  const url = `${GAMMA_URL}/events?${params}`;
  const data = await fetchJson(url);
  const results = Array.isArray(data) ? data : (data?.data || data?.events || []);
  return results[0] || null;
}

/**
 * Get trending markets by volume.
 */
export async function getTrendingMarkets({ limit = 20 } = {}) {
  const params = new URLSearchParams({
    active: 'true',
    closed: 'false',
    limit: String(limit),
    order: 'volume24hr',
    ascending: 'false',
  });
  const url = `${GAMMA_URL}/markets?${params}`;
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : (data?.data || data?.markets || []);
}

/**
 * Get trade history for an address.
 */
export async function getTradeHistory(address, { limit = 20 } = {}) {
  const params = new URLSearchParams({ user: address, limit: String(limit) });
  const url = `${DATA_URL}/activity?${params}`;
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : (data?.data || data?.activity || []);
}

/**
 * Get positions for an address.
 */
export async function getPositions(address) {
  const params = new URLSearchParams({ user: address });
  const url = `${DATA_URL}/positions?${params}`;
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : (data?.data || data?.positions || []);
}
