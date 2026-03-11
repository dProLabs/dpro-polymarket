/**
 * CLOB API client wrapping @polymarket/clob-client SDK.
 *
 * The SDK handles L1 (EIP-712) auth and L2 (HMAC) signing automatically.
 * We provide a thin wrapper that:
 * - Creates read clients for market data (no auth)
 * - Creates trading clients using stored credentials
 * - Derives API credentials from a private key (L1 auth)
 */

import { CLOB_URL, CHAIN_ID, DEFAULT_TIMEOUT_MS } from '../constants.mjs';
import { networkError, apiRejected, authError } from '../errors.mjs';

// Lazy-load the SDK to handle potential CJS/ESM differences
let _sdk = null;
async function getSDK() {
  if (_sdk) return _sdk;
  try {
    _sdk = await import('@polymarket/clob-client');
    return _sdk;
  } catch (err) {
    throw new Error(
      `@polymarket/clob-client not found. Run: npm install in the skill directory.\nError: ${err.message}`
    );
  }
}

let _ethers = null;
async function getEthers() {
  if (_ethers) return _ethers;
  try {
    _ethers = await import('ethers');
    return _ethers;
  } catch (err) {
    throw new Error(`ethers not found. Run: npm install in the skill directory.\nError: ${err.message}`);
  }
}

/**
 * Create a read-only CLOB client (no auth required).
 */
async function createReadClient() {
  const { ClobClient } = await getSDK();
  return new ClobClient(CLOB_URL, CHAIN_ID);
}

/**
 * Create a trading client with full L1+L2 auth.
 * @param {string} privateKey - hex private key
 * @param {object} creds - { apiKey, secret, passphrase }
 * @param {string} funder - proxy wallet address (from polymarket.com/settings)
 * @param {number} sigType - 0=EOA, 1=POLY_PROXY, 2=GNOSIS_SAFE (default)
 */
async function createTradingClient(privateKey, creds, funder, sigType = 2) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  const signer = new Wallet(privateKey);
  return new ClobClient(CLOB_URL, CHAIN_ID, signer, creds, sigType, funder);
}

/**
 * Derive or create API credentials from a private key (L1 auth).
 * Credentials are stable — same key always produces the same creds.
 */
export async function deriveCredentials(privateKey, funder, sigType = 2) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  try {
    const signer = new Wallet(privateKey);
    const client = new ClobClient(CLOB_URL, CHAIN_ID, signer, undefined, sigType, funder);
    const creds = await client.createOrDeriveApiKey();
    return creds; // { apiKey, secret, passphrase }
  } catch (err) {
    throw authError(`Failed to derive API credentials: ${err.message}`);
  }
}

// --- Market Data (no auth) ---

export async function getOrderBook(tokenId) {
  const client = await createReadClient();
  try {
    return await client.getOrderBook(tokenId);
  } catch (err) {
    throw networkError(`Failed to get order book for ${tokenId}: ${err.message}`);
  }
}

export async function getMidpoint(tokenId) {
  const client = await createReadClient();
  try {
    const result = await client.getMidpoint(tokenId);
    return result?.mid ?? result;
  } catch (err) {
    throw networkError(`Failed to get midpoint for ${tokenId}: ${err.message}`);
  }
}

export async function getSpread(tokenId) {
  const client = await createReadClient();
  try {
    return await client.getSpread(tokenId);
  } catch (err) {
    throw networkError(`Failed to get spread for ${tokenId}: ${err.message}`);
  }
}

export async function getLastTradePrice(tokenId) {
  const client = await createReadClient();
  try {
    const result = await client.getLastTradePrice(tokenId);
    return result?.price ?? result;
  } catch (err) {
    throw networkError(`Failed to get last trade price for ${tokenId}: ${err.message}`);
  }
}

export async function getPrice(tokenId, side) {
  const client = await createReadClient();
  try {
    const { Side } = await getSDK();
    const sdkSide = side.toUpperCase() === 'BUY' ? Side.BUY : Side.SELL;
    const result = await client.getPrice(tokenId, sdkSide);
    return result?.price ?? result;
  } catch (err) {
    throw networkError(`Failed to get price for ${tokenId}: ${err.message}`);
  }
}

// --- Trading (requires auth) ---

/**
 * Place a limit or market order.
 * @param {object} account - { privateKey, creds, funder, sigType }
 * @param {string} tokenId - outcome token ID
 * @param {string} side - 'BUY' or 'SELL'
 * @param {number} size - number of shares
 * @param {number|null} price - limit price (0-1), null for market order
 * @param {string} orderType - 'GTC', 'GTD', 'FOK', 'FAK'
 * @param {object} options - { tickSize, negRisk, expiration }
 */
export async function placeOrder(account, tokenId, side, size, price, orderType = 'GTC', options = {}) {
  const { ClobClient, Side: SideEnum, OrderType: OrderTypeEnum } = await getSDK();
  const { Wallet } = await getEthers();

  const signer = new Wallet(account.privateKey);
  const client = new ClobClient(
    CLOB_URL, CHAIN_ID, signer, account.creds, account.sigType ?? 2, account.funder
  );

  const sdkSide = side.toUpperCase() === 'BUY' ? SideEnum.BUY : SideEnum.SELL;
  const sdkOrderType = OrderTypeEnum[orderType.toUpperCase()] || OrderTypeEnum.GTC;

  // For market orders (no price), use FOK
  const isMarket = price == null;
  const effectiveOrderType = isMarket ? OrderTypeEnum.FOK : sdkOrderType;

  // For market FOK orders, get best price with slippage
  let effectivePrice = price;
  if (isMarket) {
    const bestPrice = await getPrice(tokenId, side);
    const slippage = side.toUpperCase() === 'BUY' ? 1.05 : 0.95;
    effectivePrice = Math.min(1, Math.max(0, Number(bestPrice) * slippage));
    // Round to 2 decimal places (standard tick size)
    effectivePrice = Math.round(effectivePrice * 100) / 100;
  }

  const orderArgs = {
    tokenID: tokenId,
    price: effectivePrice,
    size: Number(size),
    side: sdkSide,
  };

  if (orderType === 'GTD' && options.expiration) {
    orderArgs.expiration = options.expiration;
  }

  const orderOptions = {
    tickSize: options.tickSize || '0.01',
    negRisk: options.negRisk || false,
  };

  try {
    const result = await client.createAndPostOrder(orderArgs, orderOptions, effectiveOrderType);
    return { ...result, isMarket, effectivePrice };
  } catch (err) {
    throw apiRejected(`Order failed: ${err.message}`, { tokenId, side, size, price });
  }
}

/**
 * Cancel a specific order by ID.
 */
export async function cancelOrder(account, orderId) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  const signer = new Wallet(account.privateKey);
  const client = new ClobClient(
    CLOB_URL, CHAIN_ID, signer, account.creds, account.sigType ?? 2, account.funder
  );

  try {
    return await client.cancelOrder({ orderID: orderId });
  } catch (err) {
    throw apiRejected(`Cancel failed: ${err.message}`, { orderId });
  }
}

/**
 * Cancel all open orders, optionally for a specific market.
 */
export async function cancelAll(account, conditionId = null) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  const signer = new Wallet(account.privateKey);
  const client = new ClobClient(
    CLOB_URL, CHAIN_ID, signer, account.creds, account.sigType ?? 2, account.funder
  );

  try {
    const params = conditionId ? { market: conditionId } : {};
    return await client.cancelAll(params);
  } catch (err) {
    throw apiRejected(`Cancel all failed: ${err.message}`);
  }
}

/**
 * Get open orders for the account.
 */
export async function getOpenOrders(account, conditionId = null) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  const signer = new Wallet(account.privateKey);
  const client = new ClobClient(
    CLOB_URL, CHAIN_ID, signer, account.creds, account.sigType ?? 2, account.funder
  );

  try {
    const params = conditionId ? { market: conditionId } : {};
    const result = await client.getOrders(params);
    return Array.isArray(result) ? result : [];
  } catch (err) {
    throw networkError(`Failed to get orders: ${err.message}`);
  }
}

/**
 * Get USDC balance for the account.
 */
export async function getBalance(account) {
  const { ClobClient } = await getSDK();
  const { Wallet } = await getEthers();
  const signer = new Wallet(account.privateKey);
  const client = new ClobClient(
    CLOB_URL, CHAIN_ID, signer, account.creds, account.sigType ?? 2, account.funder
  );

  try {
    return await client.getBalance();
  } catch (err) {
    throw networkError(`Failed to get balance: ${err.message}`);
  }
}
