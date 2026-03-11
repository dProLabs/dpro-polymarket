import { inputError, unknownCommand } from './errors.mjs';

// --- Prefix stripping ---

function stripPrefix(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('/dpro-pm ') || trimmed.startsWith('/dpro-pm\t')) return trimmed.slice(9).trim();
  if (trimmed === '/dpro-pm') return '';
  if (trimmed.startsWith('dpro-pm ') || trimmed.startsWith('dpro-pm\t')) return trimmed.slice(8).trim();
  if (trimmed === 'dpro-pm') return '';
  return null;
}

// --- Tokenizer ---

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === ' ' || input[i] === '\t') { i++; continue; }
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      tokens.push(input.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < input.length && input[j] !== ' ' && input[j] !== '\t') j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

// --- Flag extraction ---

function extractFlags(tokens) {
  const args = [];
  const flags = {};
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        flags[key] = tokens[i + 1];
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      args.push(t);
      i++;
    }
  }
  return { args, flags };
}

// --- Command routing tables ---

const MARKET_ACTIONS = new Set(['search', 'quote', 'book', 'trending', 'event']);
const ACCOUNT_ACTIONS = new Set([
  'ls', 'add', 'add-readonly', 'remove', 'show', 'set-default',
  'balance', 'positions', 'orders', 'history',
]);
const ACCOUNT_SHORTCUTS = new Set(['balance', 'positions', 'orders', 'history']);
const TRADE_ACTIONS = new Set(['buy', 'sell', 'cancel', 'cancel-all']);

// --- Structured command parsing ---

function parseStructured(tokens, flags, raw) {
  if (tokens.length === 0) {
    return { domain: 'help', action: 'help', target: null, args: {}, flags, raw };
  }

  const first = tokens[0].toLowerCase();

  // Help
  if (first === 'help' || first === 'h') {
    return { domain: 'help', action: 'help', target: null, args: {}, flags, raw };
  }

  // Market data commands
  if (MARKET_ACTIONS.has(first)) {
    return {
      domain: 'market',
      action: first,
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Account command: "account <action> ..."
  if (first === 'account') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !ACCOUNT_ACTIONS.has(action)) {
      throw unknownCommand(
        `Unknown account action: ${action || '(none)'}. Available: ${[...ACCOUNT_ACTIONS].join(', ')}`
      );
    }
    return {
      domain: 'account',
      action,
      target: tokens[2] || null,
      args: { rest: tokens.slice(3) },
      flags,
      raw,
    };
  }

  // Account shortcuts: "balance", "positions", "orders", "history"
  if (ACCOUNT_SHORTCUTS.has(first)) {
    return {
      domain: 'account',
      action: first,
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Trade commands: "buy <slug> yes|no <amount> [<price>]"
  if (first === 'buy' || first === 'sell') {
    return {
      domain: 'trade',
      action: first,
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Cancel commands
  if (first === 'cancel') {
    // "cancel-all" or "cancel <orderId>"
    const next = tokens[1]?.toLowerCase();
    if (next === 'all') {
      return { domain: 'trade', action: 'cancel-all', target: tokens[2] || null, args: {}, flags, raw };
    }
    return { domain: 'trade', action: 'cancel', target: tokens[1] || null, args: {}, flags, raw };
  }

  if (first === 'cancel-all') {
    return { domain: 'trade', action: 'cancel-all', target: tokens[1] || null, args: {}, flags, raw };
  }

  throw unknownCommand(
    `Unknown command: "${first}". Try: search, quote, book, trending, event, buy, sell, cancel, account, balance, positions, orders, history`
  );
}

// --- Natural language fallback ---

const NL_PATTERNS = [
  // Market search
  { pattern: /(?:search|find|look for|show me)\s+(.+)/i, domain: 'market', action: 'search', targetGroup: 1 },
  { pattern: /(?:polymarket|prediction market|market)\s+(.+)/i, domain: 'market', action: 'search', targetGroup: 1 },

  // Quote (only when given a specific slug-like target, otherwise search)
  { pattern: /(?:price|odds|probability|chance|quote)\s+(?:of\s+)?(.+)/i, domain: 'market', action: 'search', targetGroup: 1 },
  { pattern: /(.+)\s+(?:price|odds|probability|chance)/i, domain: 'market', action: 'search', targetGroup: 1 },

  // Trending
  { pattern: /(?:trending|popular|hot|top markets|most traded)/i, domain: 'market', action: 'trending', targetGroup: null },

  // Account shortcuts
  { pattern: /(?:my balance|check balance|usdc balance)/i, domain: 'account', action: 'balance', targetGroup: null },
  { pattern: /(?:my positions|open positions|current positions)/i, domain: 'account', action: 'positions', targetGroup: null },
  { pattern: /(?:my orders|open orders|pending orders)/i, domain: 'account', action: 'orders', targetGroup: null },
  { pattern: /(?:trade history|my trades|recent trades)/i, domain: 'account', action: 'history', targetGroup: null },
];

function parseNaturalLanguage(raw) {
  for (const { pattern, domain, action, targetGroup } of NL_PATTERNS) {
    const m = raw.match(pattern);
    if (m) {
      const target = targetGroup !== null ? (m[targetGroup] || '').trim() : null;
      return { domain, action, target, args: {}, flags: {}, raw };
    }
  }
  return null;
}

// --- Public API ---

export function parseInput(rawInput) {
  const raw = rawInput.trim();
  if (!raw) throw inputError('Empty input');

  // Try prefix-based parsing
  const stripped = stripPrefix(raw);
  if (stripped !== null) {
    const tokens = tokenize(stripped);
    const { args, flags } = extractFlags(tokens);
    return parseStructured(args, flags, raw);
  }

  // Try natural language
  const nlResult = parseNaturalLanguage(raw);
  if (nlResult) return nlResult;

  throw unknownCommand(
    `Could not parse: "${raw}". Try "dpro-pm search bitcoin" or "dpro-pm help".`
  );
}
