import * as clobClient from '../clients/clob-client.mjs';
import * as gammaClient from '../clients/gamma-client.mjs';
import { findAccount, getPrivateKey } from '../store.mjs';
import { ensureCredentials } from './account.mjs';
import { inputError, privateKeyMissing, apiRejected } from '../errors.mjs';

const VALID_ORDER_TYPES = new Set(['GTC', 'GTD', 'FOK', 'FAK']);

/**
 * Resolve market slug → token IDs for YES/NO.
 */
async function resolveMarketTokens(slugOrId) {
  const market = await gammaClient.getMarket(slugOrId);
  if (!market) {
    throw inputError(`Market not found: "${slugOrId}". Use "dpro-pm search <keyword>" to find markets.`);
  }

  // Parse token IDs (Gamma API uses JSON-string clobTokenIds + outcomes)
  function parseJsonArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
  }

  let yesTokenId, noTokenId;

  if (Array.isArray(market.tokens) && market.tokens.length > 0 && market.tokens[0]?.token_id) {
    const yes = market.tokens.find(t => (t.outcome || '').toUpperCase() === 'YES') || market.tokens[0];
    const no = market.tokens.find(t => (t.outcome || '').toUpperCase() === 'NO') || market.tokens[1];
    yesTokenId = yes?.token_id || yes?.tokenId;
    noTokenId = no?.token_id || no?.tokenId;
  } else {
    const tokenIds = parseJsonArray(market.clobTokenIds);
    const outcomes = parseJsonArray(market.outcomes);
    const yesIdx = outcomes.findIndex(o => (String(o) || '').toLowerCase() === 'yes');
    const noIdx = outcomes.findIndex(o => (String(o) || '').toLowerCase() === 'no');
    yesTokenId = tokenIds[yesIdx >= 0 ? yesIdx : 0] || null;
    noTokenId = tokenIds[noIdx >= 0 ? noIdx : 1] || null;
  }

  return {
    market,
    yes: yesTokenId,
    no: noTokenId,
    negRisk: market.negRisk || false,
    tickSize: market.orderPriceMinTickSize || market.minimum_tick_size || market.minTickSize || '0.01',
  };
}

/**
 * Get the trading context: account, credentials, private key.
 */
async function getTradeContext(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw privateKeyMissing(`Account "${account.alias}" is read-only. Add an API account with: dpro-pm account add <privateKey>`);
  }
  const creds = await ensureCredentials(account);
  const privateKey = getPrivateKey(account.alias);
  return {
    privateKey,
    creds,
    funder: account.funder,
    sigType: account.sigType ?? 2,
    address: account.address,
    alias: account.alias,
  };
}

/**
 * Parse order result from CLOB API response.
 */
function parseOrderResult(response, meta) {
  const result = {
    ...meta,
    orderId: null,
    status: 'unknown',
    filled: null,
    avgPrice: null,
    error: null,
  };

  if (!response) return { ...result, status: 'unknown' };

  // Polymarket response format varies
  if (response.orderID || response.id) {
    result.orderId = response.orderID || response.id;
    result.status = response.status || 'submitted';
  }

  if (response.status === 'matched' || response.status === 'filled') {
    result.status = 'filled';
    result.filled = response.size_matched || response.size;
    result.avgPrice = response.price;
  } else if (response.status === 'live') {
    result.status = 'resting';
  } else if (response.status === 'delayed') {
    result.status = 'delayed';
  } else if (response.errorMsg || response.error) {
    result.status = 'error';
    result.error = response.errorMsg || response.error;
  }

  if (result.status === 'unknown' && result.orderId) {
    result.status = 'submitted';
  }

  return result;
}

async function buy(parsed, ctx) {
  return placeTrade('BUY', parsed, ctx);
}

async function sell(parsed, ctx) {
  return placeTrade('SELL', parsed, ctx);
}

async function placeTrade(side, parsed) {
  const slugOrId = parsed.target;
  if (!slugOrId) {
    throw inputError(`Usage: dpro-pm ${side.toLowerCase()} <market-slug> yes|no <amount> [<price>]\nExample: dpro-pm buy will-bitcoin-hit-100k yes 10 0.65`);
  }

  const restArgs = parsed.args?.rest || [];
  const outcomeArg = restArgs[0]?.toLowerCase();
  const amount = restArgs[1];
  const price = restArgs[2] || null;

  if (!outcomeArg || !['yes', 'no'].includes(outcomeArg)) {
    throw inputError(`Outcome must be "yes" or "no". Got: ${outcomeArg || '(none)'}`);
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw inputError(`Amount must be a positive number. Got: ${amount || '(none)'}`);
  }
  if (price !== null && (isNaN(Number(price)) || Number(price) < 0 || Number(price) > 1)) {
    throw inputError(`Price must be between 0 and 1 (representing $0 to $1 per share). Got: ${price}`);
  }

  const orderTypeFlag = (parsed.flags?.type || '').toUpperCase();
  const orderType = VALID_ORDER_TYPES.has(orderTypeFlag) ? orderTypeFlag
    : (price !== null ? 'GTC' : 'FOK');

  const expiration = parsed.flags?.expires ? Number(parsed.flags.expires) : null;

  // Resolve market → token IDs
  const { market, yes: yesTokenId, no: noTokenId, negRisk, tickSize } = await resolveMarketTokens(slugOrId);
  const tokenId = outcomeArg === 'yes' ? yesTokenId : noTokenId;

  if (!tokenId) {
    throw inputError(`Could not find ${outcomeArg.toUpperCase()} token ID for market "${slugOrId}". Market may not have CLOB support.`);
  }

  // Get trading context
  const tradeCtx = await getTradeContext(parsed);

  // For market orders (no price), fetch current best price for display
  let displayPrice = price ? Number(price) : null;
  if (!displayPrice) {
    try {
      displayPrice = Number(await clobClient.getMidpoint(tokenId)) || 0;
    } catch { displayPrice = 0; }
  }

  const estimatedCost = Number(amount) * (displayPrice || 0);

  // Present trade summary for confirmation
  const summary = [
    `Market: ${market.question || market.title}`,
    `Outcome: ${outcomeArg.toUpperCase()}`,
    `Side: ${side}`,
    `Amount: ${amount} shares`,
    `Price: ${price ? `$${Number(price).toFixed(2)} (limit)` : `~$${displayPrice.toFixed(2)} (market)`}`,
    `Estimated cost: ~$${estimatedCost.toFixed(2)}`,
    `Order type: ${orderType}`,
  ].join('\n');

  // The ctx here is the runtimeContext from the skill entry
  // We don't have direct user confirmation here — the SKILL.md safety policy
  // requires Claude to confirm with user before calling this command.
  // Claude should show the summary and ask "Confirm?" before calling buy/sell.

  const response = await clobClient.placeOrder(
    tradeCtx,
    tokenId,
    side,
    Number(amount),
    price ? Number(price) : null,
    orderType,
    { tickSize, negRisk, expiration },
  );

  const data = parseOrderResult(response, {
    market: market.question || market.title,
    outcome: outcomeArg.toUpperCase(),
    side,
    amount: Number(amount),
    price: price ? Number(price) : response.effectivePrice,
    orderType,
    tokenId,
  });

  return { ok: true, type: 'order_result', data };
}

async function cancel(parsed) {
  const orderId = parsed.target;
  if (!orderId) throw inputError('Usage: dpro-pm cancel <orderId>');

  const tradeCtx = await getTradeContext(parsed);
  const result = await clobClient.cancelOrder(tradeCtx, orderId);

  const success = result?.status === 'success' || result?.orderID === orderId;
  return {
    ok: true,
    type: 'cancel_result',
    data: { orderId, cancelled: !!success, error: success ? null : JSON.stringify(result) },
  };
}

async function cancelAll(parsed) {
  const conditionId = parsed.target || null; // optional market filter
  const tradeCtx = await getTradeContext(parsed);

  // Get current open orders count for reporting
  const openOrders = await clobClient.getOpenOrders(tradeCtx, conditionId);
  const count = openOrders.length;

  if (count === 0) {
    return { ok: true, type: 'cancel-all_result', data: { count: 0 } };
  }

  await clobClient.cancelAll(tradeCtx, conditionId);

  return { ok: true, type: 'cancel-all_result', data: { count } };
}

export default { buy, sell, cancel, cancelAll };
