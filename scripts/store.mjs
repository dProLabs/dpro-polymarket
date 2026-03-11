import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig, getConfigDir } from './config.mjs';
import { encrypt, decrypt } from './utils/crypto.mjs';
import { accountNotFound, privateKeyMissing, inputError, authError } from './errors.mjs';
import { KEYS_FILE, CREDS_FILE } from './constants.mjs';

const keysPath = () => join(getConfigDir(), KEYS_FILE);
const credsPath = () => join(getConfigDir(), CREDS_FILE);

const KEYS_SCHEMA_VERSION = 1;
const CREDS_SCHEMA_VERSION = 1;

// In-memory password cache (session lifetime)
let walletPassword = null;

export function setWalletPassword(pwd) {
  walletPassword = pwd;
}

export function getWalletPassword() {
  return walletPassword;
}

// --- Keys file (private keys, encrypted) ---

function loadKeysFile() {
  const p = keysPath();
  if (!existsSync(p)) return { schemaVersion: KEYS_SCHEMA_VERSION, keys: {} };
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) return { schemaVersion: KEYS_SCHEMA_VERSION, keys: {} };
  if (!walletPassword) {
    throw privateKeyMissing('Password not set. Provide --password or runtimeContext.password, or set env DPRO_PM_PASSWORD.');
  }
  const json = decrypt(hex, walletPassword);
  return JSON.parse(json);
}

function saveKeysFile(data) {
  if (!walletPassword) {
    throw privateKeyMissing('Password not set. Provide --password or runtimeContext.password.');
  }
  const hex = encrypt(JSON.stringify(data), walletPassword);
  writeFileSync(keysPath(), hex, 'utf8');
}

// --- Creds file (API credentials, encrypted) ---

function loadCredsFile() {
  const p = credsPath();
  if (!existsSync(p)) return { schemaVersion: CREDS_SCHEMA_VERSION, creds: {} };
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) return { schemaVersion: CREDS_SCHEMA_VERSION, creds: {} };
  if (!walletPassword) {
    throw authError('Password not set. Provide --password or runtimeContext.password.');
  }
  const json = decrypt(hex, walletPassword);
  return JSON.parse(json);
}

function saveCredsFile(data) {
  if (!walletPassword) {
    throw authError('Password not set. Provide --password or runtimeContext.password.');
  }
  const hex = encrypt(JSON.stringify(data), walletPassword);
  writeFileSync(credsPath(), hex, 'utf8');
}

// --- Account CRUD ---

export function listAccounts() {
  const config = loadConfig();
  return config.accounts || [];
}

export function findAccount(aliasOrAddress) {
  const accounts = listAccounts();

  if (!aliasOrAddress) {
    const config = loadConfig();
    const def = config.defaultAccountAlias;
    if (def) {
      const found = accounts.find((a) => a.alias === def);
      if (found) return found;
    }
    if (accounts.length === 1) return accounts[0];
    if (accounts.length === 0) {
      throw inputError('No accounts configured. Run: dpro-pm account add <privateKey> [alias] --password <pwd>');
    }
    throw inputError(`Multiple accounts. Specify --account <alias>. Accounts: ${accounts.map(a => a.alias).join(', ')}`);
  }

  const lower = aliasOrAddress.toLowerCase();
  const byAlias = accounts.find((a) => a.alias.toLowerCase() === lower);
  if (byAlias) return byAlias;

  const byAddress = accounts.find((a) => a.address && a.address.toLowerCase() === lower);
  if (byAddress) return byAddress;

  throw accountNotFound(aliasOrAddress);
}

export function addAccount(address, alias, mode = 'api', sigType = 2, funder = null) {
  const config = loadConfig();
  if (!config.accounts) config.accounts = [];

  if (config.accounts.find((a) => a.alias === alias)) {
    throw inputError(`Account alias "${alias}" already exists.`);
  }

  const account = {
    alias,
    address,
    funder: funder || address,
    sigType,
    mode,
    isDefault: config.accounts.length === 0,
  };

  config.accounts.push(account);
  if (account.isDefault) config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

export function removeAccount(alias) {
  const config = loadConfig();
  const idx = (config.accounts || []).findIndex((a) => a.alias === alias);
  if (idx === -1) throw accountNotFound(alias);

  const removed = config.accounts.splice(idx, 1)[0];

  // Remove private key and creds
  try {
    const keys = loadKeysFile();
    if (keys.keys?.[alias]) {
      delete keys.keys[alias];
      saveKeysFile(keys);
    }
  } catch { /* ignore */ }

  try {
    const creds = loadCredsFile();
    if (creds.creds?.[alias]) {
      delete creds.creds[alias];
      saveCredsFile(creds);
    }
  } catch { /* ignore */ }

  if (config.defaultAccountAlias === alias) {
    config.defaultAccountAlias = config.accounts[0]?.alias || null;
  }
  saveConfig(config);
  return removed;
}

export function setDefaultAccount(alias) {
  const config = loadConfig();
  const account = (config.accounts || []).find((a) => a.alias === alias);
  if (!account) throw accountNotFound(alias);

  for (const a of config.accounts) a.isDefault = a.alias === alias;
  config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

// --- Private key storage ---

export function storePrivateKey(alias, privateKeyHex) {
  const keys = loadKeysFile();
  if (!keys.keys) keys.keys = {};
  keys.keys[alias] = privateKeyHex;
  saveKeysFile(keys);
}

export function getPrivateKey(alias) {
  const keys = loadKeysFile();
  const key = keys.keys?.[alias];
  if (!key) throw privateKeyMissing(`No private key for "${alias}". Add with: dpro-pm account add <privateKey> ${alias} --password <pwd>`);
  return key;
}

export function hasPrivateKey(alias) {
  try {
    const keys = loadKeysFile();
    return !!keys.keys?.[alias];
  } catch {
    return false;
  }
}

// --- API credentials storage ---

export function storeApiCreds(alias, creds) {
  const data = loadCredsFile();
  if (!data.creds) data.creds = {};
  data.creds[alias] = creds;
  saveCredsFile(data);
}

export function getApiCreds(alias) {
  const data = loadCredsFile();
  return data.creds?.[alias] || null;
}
