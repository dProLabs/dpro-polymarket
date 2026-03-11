import {
  listAccounts, findAccount, addAccount, removeAccount, setDefaultAccount,
  storePrivateKey, getPrivateKey, hasPrivateKey, getApiCreds, storeApiCreds,
} from '../store.mjs';
import { deriveCredentials } from '../clients/clob-client.mjs';
import * as gammaClient from '../clients/gamma-client.mjs';
import { inputError } from '../errors.mjs';
import { DEFAULT_HISTORY_LIMIT } from '../constants.mjs';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;

function normalizePrivateKey(raw) {
  const s = String(raw || '').trim();
  if (PRIVATE_KEY_RE.test(s)) {
    return s.startsWith('0x') ? s : `0x${s}`;
  }
  throw inputError('Invalid private key format. Expected 64 hex chars, optionally 0x-prefixed.');
}

async function ls() {
  const accounts = listAccounts();
  return { ok: true, type: 'account-ls', data: { accounts } };
}

async function add(parsed) {
  const privateKey = normalizePrivateKey(parsed.target);
  const alias = parsed.args?.rest?.[0] || 'default';
  const sigType = Number(parsed.flags?.['sig-type']) || 2;
  const funder = parsed.flags?.funder || null;

  // Derive address from private key
  let address;
  try {
    const { Wallet } = await import('ethers');
    const wallet = new Wallet(privateKey);
    address = wallet.address;
  } catch (err) {
    throw inputError(`Invalid private key: ${err.message}`);
  }

  // Store the account metadata
  const account = addAccount(address, alias, 'api', sigType, funder || address);

  // Encrypt and store private key
  storePrivateKey(alias, privateKey);

  return {
    ok: true,
    type: 'account-added',
    data: {
      alias,
      address,
      mode: 'api',
      sigType,
      funder: account.funder,
      note: 'Private key encrypted and stored. API credentials will be derived on first trade.',
    },
  };
}

async function addReadonly(parsed) {
  const address = parsed.target;
  if (!address || !ETH_ADDRESS_RE.test(address)) {
    throw inputError('Usage: dpro-pm account add-readonly <0x-address> [alias]');
  }
  const alias = parsed.args?.rest?.[0] || address.slice(0, 8);
  const account = addAccount(address, alias, 'readonly', 0, address);

  return {
    ok: true,
    type: 'account-added',
    data: { alias, address, mode: 'readonly' },
  };
}

async function remove(parsed) {
  const alias = parsed.target;
  if (!alias) throw inputError('Usage: dpro-pm account remove <alias>');
  const account = removeAccount(alias);
  return { ok: true, type: 'account-removed', data: { alias: account.alias } };
}

async function show(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  const hasCreds = !!getApiCreds(account.alias);
  const hasKey = hasPrivateKey(account.alias);

  return {
    ok: true,
    type: 'account-show',
    data: {
      alias: account.alias,
      address: account.address,
      funder: account.funder,
      mode: account.mode,
      sigType: account.sigType,
      isDefault: account.isDefault,
      hasKey,
      hasCreds,
    },
  };
}

async function setDefault(parsed) {
  const alias = parsed.target;
  if (!alias) throw inputError('Usage: dpro-pm account set-default <alias>');
  const account = setDefaultAccount(alias);
  return { ok: true, type: 'account-default-set', data: { alias: account.alias } };
}

/**
 * Ensure API credentials are available for trading.
 * Derives them from the private key if not yet cached.
 */
export async function ensureCredentials(account) {
  let creds = getApiCreds(account.alias);
  if (creds) return creds;

  // Need to derive API credentials (L1 auth)
  const privateKey = getPrivateKey(account.alias);
  creds = await deriveCredentials(privateKey, account.funder, account.sigType ?? 2);
  storeApiCreds(account.alias, creds);
  return creds;
}

async function balance(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw inputError(`Account "${account.alias}" is read-only. Cannot fetch balance without API key.`);
  }

  const creds = await ensureCredentials(account);
  const privateKey = getPrivateKey(account.alias);

  const { getBalance } = await import('../clients/clob-client.mjs');
  const result = await getBalance({
    privateKey,
    creds,
    funder: account.funder,
    sigType: account.sigType ?? 2,
  });

  return {
    ok: true,
    type: 'balance',
    data: {
      address: account.address,
      alias: account.alias,
      balance: result?.balance ?? result,
    },
  };
}

async function positions(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  const positionData = await gammaClient.getPositions(account.address);

  return {
    ok: true,
    type: 'positions',
    data: {
      address: account.address,
      alias: account.alias,
      positions: positionData.map(p => ({
        market: p.market?.question || p.title || p.conditionId,
        conditionId: p.conditionId || p.market?.conditionId,
        outcome: p.outcome,
        size: p.size || p.shares,
        avgPrice: p.avgPrice || p.averagePrice,
        currentPrice: p.currentValue,
        pnl: p.cashBalance || p.unrealizedPnl,
        initial: p.initialValue,
      })),
    },
  };
}

async function orders(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw inputError(`Account "${account.alias}" is read-only. Cannot fetch orders without API key.`);
  }

  const creds = await ensureCredentials(account);
  const privateKey = getPrivateKey(account.alias);
  const conditionId = parsed.target || null;

  const { getOpenOrders } = await import('../clients/clob-client.mjs');
  const openOrders = await getOpenOrders(
    { privateKey, creds, funder: account.funder, sigType: account.sigType ?? 2 },
    conditionId
  );

  return {
    ok: true,
    type: 'orders',
    data: {
      address: account.address,
      alias: account.alias,
      orders: openOrders.map(o => ({
        orderId: o.id || o.orderID,
        market: o.market || o.conditionId,
        tokenId: o.asset_id || o.tokenId,
        side: o.side,
        size: o.original_size || o.size,
        filled: o.size_matched || o.filled,
        price: o.price,
        status: o.status,
        created: o.created_at || o.timestamp,
      })),
    },
  };
}

async function history(parsed) {
  const account = findAccount(parsed.flags?.account || null);
  const limit = Number(parsed.flags?.limit) || DEFAULT_HISTORY_LIMIT;

  const trades = await gammaClient.getTradeHistory(account.address, { limit });

  return {
    ok: true,
    type: 'history',
    data: {
      address: account.address,
      alias: account.alias,
      trades: trades.map(t => ({
        market: t.market?.question || t.title || t.conditionId,
        outcome: t.outcome,
        side: t.side,
        size: t.size || t.shares,
        price: t.price,
        usdAmount: t.usdcSize || t.amount,
        timestamp: t.timestamp || t.created_at,
        txHash: t.transactionHash,
      })),
    },
  };
}

export default { ls, add, addReadonly, remove, show, setDefault, balance, positions, orders, history };
