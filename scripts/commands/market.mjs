import * as gammaClient from '../clients/gamma-client.mjs';
import * as clobClient from '../clients/clob-client.mjs';
import { inputError, marketNotFound } from '../errors.mjs';
import { DEFAULT_BOOK_LEVELS, DEFAULT_SEARCH_LIMIT } from '../constants.mjs';

/**
 * Parse outcomePrices — Gamma API returns it as a JSON string "[\"0.65\", \"0.35\"]"
 */
function parseOutcomePrices(raw) {
  if (!raw) return [null, null];
  if (Array.isArray(raw)) return raw.map(Number);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : [null, null];
  } catch {
    return [null, null];
  }
}

/**
 * Resolve a market slug/conditionId to full market data with token IDs.
 * Markets have: condition_id, question, tokens (array with token_id, outcome)
 */
async function resolveMarket(slugOrId) {
  const market = await gammaClient.getMarket(slugOrId);
  if (!market) {
    throw marketNotFound(slugOrId, 'Try "dpro-pm search <keyword>" to find markets.');
  }
  return market;
}

/**
 * Parse a JSON-string array field from Gamma API.
 * e.g. "[\"token1\", \"token2\"]" → ["token1", "token2"]
 */
function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Get the YES and NO token IDs from a market.
 * Gamma API: clobTokenIds = JSON string of token IDs, outcomes = JSON string of labels.
 * SDK format: tokens = array of { token_id, outcome }.
 */
function extractTokens(market) {
  // SDK format: market.tokens array
  if (Array.isArray(market.tokens) && market.tokens.length > 0 && market.tokens[0]?.token_id) {
    const tokens = market.tokens;
    const yes = tokens.find(t => (t.outcome || '').toUpperCase() === 'YES') || tokens[0];
    const no = tokens.find(t => (t.outcome || '').toUpperCase() === 'NO') || tokens[1];
    return {
      yes: yes?.token_id || yes?.tokenId,
      no: no?.token_id || no?.tokenId,
    };
  }

  // Gamma API format: clobTokenIds JSON string + outcomes JSON string
  const tokenIds = parseJsonArray(market.clobTokenIds);
  const outcomes = parseJsonArray(market.outcomes);

  // Map outcomes to token IDs by position
  const yesIdx = outcomes.findIndex(o => (String(o) || '').toLowerCase() === 'yes');
  const noIdx = outcomes.findIndex(o => (String(o) || '').toLowerCase() === 'no');

  return {
    yes: tokenIds[yesIdx >= 0 ? yesIdx : 0] || null,
    no: tokenIds[noIdx >= 0 ? noIdx : 1] || null,
  };
}

async function search(parsed) {
  const query = parsed.target || (parsed.args?.rest || []).join(' ');
  if (!query) throw inputError('Usage: dpro-pm search <query>\nExample: dpro-pm search "bitcoin price"');

  const limit = Number(parsed.flags?.limit) || DEFAULT_SEARCH_LIMIT;
  const active = !parsed.flags?.all;

  const markets = await gammaClient.searchMarkets(query, { limit, active });

  return {
    ok: true,
    type: 'search',
    data: {
      query,
      markets: markets.map(m => {
        const [yesP, noP] = parseOutcomePrices(m.outcomePrices);
        return {
          question: m.question || m.title,
          slug: m.slug || m.marketSlug,
          conditionId: m.condition_id || m.conditionId,
          yesPrice: yesP || null,
          noPrice: noP || null,
          volume24h: m.volume24hr != null ? Number(m.volume24hr) : (m.volume ? Number(m.volume) : null),
          endDate: m.endDate || m.end_date_iso,
          active: m.active,
          closed: m.closed,
        };
      }),
    },
  };
}

async function quote(parsed) {
  const slugOrId = parsed.target;
  if (!slugOrId) throw inputError('Usage: dpro-pm quote <market-slug>\nExample: dpro-pm quote will-bitcoin-hit-100k');

  const market = await resolveMarket(slugOrId);
  const { yes: yesTokenId, no: noTokenId } = extractTokens(market);

  // Fetch YES and NO midpoints in parallel
  const [yesMid, noMid] = await Promise.allSettled([
    yesTokenId ? clobClient.getMidpoint(yesTokenId) : Promise.resolve(null),
    noTokenId ? clobClient.getMidpoint(noTokenId) : Promise.resolve(null),
  ]);

  const [outYes, outNo] = parseOutcomePrices(market.outcomePrices);
  const yesPrice = yesMid.status === 'fulfilled' ? yesMid.value : outYes;
  const noPrice = noMid.status === 'fulfilled' ? noMid.value : outNo;

  return {
    ok: true,
    type: 'quote',
    data: {
      question: market.question || market.title,
      slug: market.slug || market.marketSlug,
      conditionId: market.condition_id || market.conditionId,
      yesPrice: yesPrice != null ? Number(yesPrice) : null,
      noPrice: noPrice != null ? Number(noPrice) : null,
      yesTokenId,
      noTokenId,
      volume24h: market.volume24hr || market.volume,
      liquidity: market.liquidity,
      endDate: market.endDate || market.end_date_iso,
      active: market.active,
      closed: market.closed,
      description: market.description,
    },
  };
}

async function book(parsed) {
  const tokenId = parsed.target;
  if (!tokenId) throw inputError('Usage: dpro-pm book <token-id>\nUse "dpro-pm quote <slug>" to get token IDs.');

  const levels = Number(parsed.flags?.levels) || DEFAULT_BOOK_LEVELS;
  const book = await clobClient.getOrderBook(tokenId);

  if (!book) throw marketNotFound(tokenId);

  const bids = (book.bids || []).slice(0, levels);
  const asks = (book.asks || []).slice(0, levels);

  let spread = null;
  if (bids.length && asks.length) {
    spread = Number(asks[0].price) - Number(bids[0].price);
  }

  return {
    ok: true,
    type: 'book',
    data: { tokenId, levels, bids, asks, spread },
  };
}

async function trending(parsed) {
  const limit = Number(parsed.flags?.limit) || 20;
  const markets = await gammaClient.getTrendingMarkets({ limit });

  return {
    ok: true,
    type: 'trending',
    data: {
      markets: markets.map(m => {
        const [yesP, noP] = parseOutcomePrices(m.outcomePrices);
        return {
          question: m.question || m.title,
          slug: m.slug || m.marketSlug,
          yesPrice: yesP || null,
          noPrice: noP || null,
          volume24h: m.volume24hr != null ? Number(m.volume24hr) : (m.volume ? Number(m.volume) : null),
          liquidity: m.liquidity ? Number(m.liquidity) : null,
          endDate: m.endDate || m.end_date_iso,
        };
      }),
    },
  };
}

async function event(parsed) {
  const slug = parsed.target;
  if (!slug) throw inputError('Usage: dpro-pm event <slug>\nExample: dpro-pm event us-presidential-election-winner-2024');

  const eventData = await gammaClient.getEvent(slug);
  if (!eventData) throw marketNotFound(slug, 'Event not found. Try "dpro-pm search <keyword>".');

  const markets = (eventData.markets || []).map(m => {
    const [yesP, noP] = parseOutcomePrices(m.outcomePrices);
    return {
      question: m.question || m.title,
      slug: m.slug || m.marketSlug,
      conditionId: m.condition_id || m.conditionId,
      yesPrice: yesP || null,
      noPrice: noP || null,
      volume24h: m.volume24hr != null ? Number(m.volume24hr) : (m.volume ? Number(m.volume) : null),
      closed: m.closed,
      endDate: m.endDate || m.end_date_iso,
    };
  });

  return {
    ok: true,
    type: 'event',
    data: {
      title: eventData.title || eventData.name,
      slug: eventData.slug,
      description: eventData.description,
      markets,
    },
  };
}

export default { search, quote, book, trending, event };
