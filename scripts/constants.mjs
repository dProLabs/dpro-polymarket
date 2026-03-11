// Polymarket API endpoints
export const CLOB_URL = 'https://clob.polymarket.com';
export const GAMMA_URL = 'https://gamma-api.polymarket.com';
export const DATA_URL = 'https://data-api.polymarket.com';

// Polygon chain ID
export const CHAIN_ID = 137;

// Signature types
export const SIG_TYPE_EOA = 0;
export const SIG_TYPE_POLY_PROXY = 1;
export const SIG_TYPE_GNOSIS_SAFE = 2; // default for Polymarket.com accounts

// Contract addresses on Polygon
export const CONTRACT_USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const CONTRACT_CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
export const CONTRACT_CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
export const CONTRACT_NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
export const CONTRACT_NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

// Defaults
export const DEFAULT_BOOK_LEVELS = 10;
export const DEFAULT_HISTORY_LIMIT = 20;
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_TIMEOUT_MS = 15_000;

// Config paths
export const CONFIG_DIR = '.config/dpro-pm';
export const CONFIG_FILE = 'config.json';
export const KEYS_FILE = 'keys.enc';
export const CREDS_FILE = 'creds.enc';
export const PASSWORD_CACHE_FILE = 'password-session.json';
export const DEFAULT_PASSWORD_CACHE_TTL_SEC = 6 * 60 * 60; // 6 hours
