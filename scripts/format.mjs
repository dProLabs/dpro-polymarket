import { SkillError } from './errors.mjs';
import { fmtProb, fmtUsd, fmtPrice, fmtNum, fmtCompact } from './utils/numbers.mjs';

// --- Table rendering ---

function padRight(s, w) { return String(s).padEnd(w); }
function padLeft(s, w) { return String(s).padStart(w); }

export function renderTable(headers, rows, alignRight = []) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const lines = [];
  lines.push(headers.map((h, i) => padRight(h, widths[i])).join('  '));
  lines.push(widths.map(w => '─'.repeat(w)).join('──'));
  for (const row of rows) {
    lines.push(row.map((cell, i) => {
      const s = String(cell ?? '');
      return alignRight.includes(i) ? padLeft(s, widths[i]) : padRight(s, widths[i]);
    }).join('  '));
  }
  return lines.join('\n');
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch { return String(d); }
}

function fmtDatetime(d) {
  if (!d) return '—';
  try {
    return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
  } catch { return String(d); }
}

function truncate(s, max = 55) {
  const str = String(s || '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// --- Result formatters ---

const formatters = {
  help: (d) => d.message,

  search: (d) => {
    if (!d.markets.length) return `No markets found for "${d.query}".`;
    const headers = ['Question', 'YES', 'NO', 'Vol24h', 'Ends'];
    const rows = d.markets.map(m => [
      truncate(m.question, 50),
      m.yesPrice != null ? fmtProb(m.yesPrice) : '—',
      m.noPrice != null ? fmtProb(m.noPrice) : '—',
      m.volume24h != null ? fmtCompact(m.volume24h) : '—',
      fmtDate(m.endDate),
    ]);
    return `Search: "${d.query}" (${d.markets.length} results)\n\n` + renderTable(headers, rows, [1, 2, 3]);
  },

  quote: (d) => {
    const lines = [truncate(d.question, 80)];
    lines.push('');
    if (d.yesPrice != null) lines.push(`YES: ${fmtProb(d.yesPrice)}  (${fmtPrice(d.yesPrice)})`);
    if (d.noPrice != null) lines.push(`NO:  ${fmtProb(d.noPrice)}  (${fmtPrice(d.noPrice)})`);
    lines.push('');
    if (d.volume24h != null) lines.push(`Volume 24h: ${fmtUsd(d.volume24h)}`);
    if (d.liquidity != null) lines.push(`Liquidity:  ${fmtUsd(d.liquidity)}`);
    if (d.endDate) lines.push(`Ends: ${fmtDate(d.endDate)}`);
    lines.push('');
    lines.push(`Slug: ${d.slug || '—'}`);
    if (d.yesTokenId) lines.push(`YES token: ${d.yesTokenId}`);
    if (d.noTokenId) lines.push(`NO  token: ${d.noTokenId}`);
    return lines.join('\n');
  },

  book: (d) => {
    const lines = [`Order Book — Token ${d.tokenId.slice(0, 12)}... (Top ${d.levels})`];
    lines.push('');
    if (d.asks.length) {
      lines.push('Asks (offers to sell)');
      for (const a of [...d.asks].reverse()) {
        const price = a.price ?? a.px;
        const size = a.size ?? a.sz;
        lines.push(`  ${fmtProb(price)}  ×  ${fmtNum(size, 2)} shares`);
      }
    }
    lines.push('');
    if (d.bids.length) {
      lines.push('Bids (offers to buy)');
      for (const b of d.bids) {
        const price = b.price ?? b.px;
        const size = b.size ?? b.sz;
        lines.push(`  ${fmtProb(price)}  ×  ${fmtNum(size, 2)} shares`);
      }
    }
    if (d.spread != null) lines.push(`\nSpread: ${fmtPrice(d.spread)}`);
    return lines.join('\n');
  },

  trending: (d) => {
    if (!d.markets.length) return 'No trending markets found.';
    const headers = ['Question', 'YES', 'NO', 'Vol24h', 'Ends'];
    const rows = d.markets.map(m => [
      truncate(m.question, 48),
      m.yesPrice != null ? fmtProb(m.yesPrice) : '—',
      m.noPrice != null ? fmtProb(m.noPrice) : '—',
      m.volume24h != null ? fmtCompact(m.volume24h) : '—',
      fmtDate(m.endDate),
    ]);
    return `Trending Markets (${d.markets.length})\n\n` + renderTable(headers, rows, [1, 2, 3]);
  },

  event: (d) => {
    const lines = [d.title || 'Event'];
    if (d.description) lines.push(truncate(d.description, 200));
    lines.push('');
    if (!d.markets.length) {
      lines.push('No markets in this event.');
    } else {
      const headers = ['Market', 'YES', 'NO', 'Vol24h', 'Ends'];
      const rows = d.markets.map(m => [
        truncate(m.question, 45),
        m.yesPrice != null ? fmtProb(m.yesPrice) : '—',
        m.noPrice != null ? fmtProb(m.noPrice) : '—',
        m.volume24h != null ? fmtCompact(m.volume24h) : '—',
        fmtDate(m.endDate),
      ]);
      lines.push(renderTable(headers, rows, [1, 2, 3]));
    }
    return lines.join('\n');
  },

  'account-ls': (d) => {
    if (!d.accounts.length) {
      return [
        'No accounts configured.',
        '',
        'To add an account:',
        '  dpro-pm account add <0x-private-key> [alias] --password <password>',
        '',
        'Get your private key at: polymarket.com/settings',
      ].join('\n');
    }
    const headers = ['Alias', 'Address', 'Mode', 'SigType', 'HasKey', 'Default'];
    const rows = d.accounts.map(a => [
      a.alias,
      a.address ? (a.address.slice(0, 8) + '...' + a.address.slice(-4)) : '—',
      a.mode,
      a.sigType ?? '—',
      a.hasKey !== false ? '✓' : '—',
      a.isDefault ? '*' : '',
    ]);
    return `Accounts (${d.accounts.length})\n\n` + renderTable(headers, rows);
  },

  'account-added': (d) => {
    const lines = [`Account "${d.alias}" added.`];
    lines.push(`Address:  ${d.address}`);
    lines.push(`Mode:     ${d.mode}`);
    lines.push(`SigType:  ${d.sigType} (${d.sigType === 2 ? 'GNOSIS_SAFE — default for Polymarket.com' : d.sigType === 1 ? 'POLY_PROXY' : 'EOA'})`);
    if (d.note) lines.push(`Note: ${d.note}`);
    return lines.join('\n');
  },

  'account-removed': (d) => `Account "${d.alias}" removed.`,

  'account-default-set': (d) => `Default account set to "${d.alias}".`,

  'account-show': (d) => {
    const lines = [`Account: ${d.alias}${d.isDefault ? ' (default)' : ''}`];
    lines.push(`Address:  ${d.address}`);
    lines.push(`Funder:   ${d.funder || d.address}`);
    lines.push(`Mode:     ${d.mode}`);
    lines.push(`SigType:  ${d.sigType}`);
    lines.push(`Has key:  ${d.hasKey ? 'yes' : 'no'}`);
    lines.push(`Has creds: ${d.hasCreds ? 'yes (API credentials cached)' : 'no (will derive on first trade)'}`);
    return lines.join('\n');
  },

  balance: (d) => {
    const bal = d.balance;
    if (bal == null) return 'Balance unavailable.';
    const amount = typeof bal === 'object' ? (bal.balance || bal.amount || bal.value) : bal;
    return `Balance: ${fmtUsd(amount)} USDC.e\nAddress: ${d.address} (${d.alias})`;
  },

  positions: (d) => {
    if (!d.positions.length) return `No open positions for ${d.alias} (${d.address}).`;
    const headers = ['Market', 'Outcome', 'Shares', 'Avg $', 'Cur $', 'P&L'];
    const rows = d.positions.map(p => [
      truncate(p.market, 35),
      p.outcome || '—',
      fmtNum(p.size, 2),
      p.avgPrice != null ? fmtProb(p.avgPrice) : '—',
      p.currentPrice != null ? fmtProb(p.currentPrice) : '—',
      p.pnl != null ? fmtUsd(p.pnl) : '—',
    ]);
    return `Positions: ${d.alias}\n\n` + renderTable(headers, rows, [2, 3, 4, 5]);
  },

  orders: (d) => {
    if (!d.orders.length) return `No open orders for ${d.alias}.`;
    const headers = ['OrderID', 'Market/Token', 'Side', 'Size', 'Filled', 'Price', 'Status'];
    const rows = d.orders.map(o => [
      String(o.orderId || '—').slice(0, 12),
      String(o.market || o.tokenId || '—').slice(0, 20),
      o.side || '—',
      fmtNum(o.size, 2),
      fmtNum(o.filled || 0, 2),
      o.price != null ? fmtProb(o.price) : '—',
      o.status || '—',
    ]);
    return `Open Orders: ${d.alias} (${d.orders.length})\n\n` + renderTable(headers, rows, [3, 4, 5]);
  },

  history: (d) => {
    if (!d.trades.length) return `No trade history for ${d.alias}.`;
    const headers = ['Time', 'Market', 'Outcome', 'Side', 'Shares', 'Price', 'USD'];
    const rows = d.trades.map(t => [
      fmtDatetime(t.timestamp),
      truncate(t.market, 30),
      t.outcome || '—',
      t.side || '—',
      fmtNum(t.size, 2),
      t.price != null ? fmtProb(t.price) : '—',
      t.usdAmount != null ? fmtUsd(t.usdAmount) : '—',
    ]);
    return `Trade History: ${d.alias}\n\n` + renderTable(headers, rows, [4, 5, 6]);
  },

  order_result: (d) => {
    const lines = [];
    if (d.status === 'filled' || d.status === 'matched') {
      lines.push(`✓ Order filled!`);
    } else if (d.status === 'resting' || d.status === 'live') {
      lines.push(`Order resting on book.`);
    } else if (d.status === 'delayed') {
      lines.push(`Order delayed (pending matching).`);
    } else if (d.status === 'error') {
      lines.push(`✗ Order failed: ${d.error}`);
    } else {
      lines.push(`Order submitted (status: ${d.status}).`);
    }
    lines.push('');
    lines.push(`Market:  ${d.market}`);
    lines.push(`Outcome: ${d.outcome}`);
    lines.push(`Side:    ${d.side}  |  Type: ${d.orderType}`);
    lines.push(`Amount:  ${fmtNum(d.amount, 2)} shares`);
    if (d.price) lines.push(`Price:   ${fmtProb(d.price)}`);
    if (d.orderId) lines.push(`Order ID: ${d.orderId}`);
    return lines.join('\n');
  },

  cancel_result: (d) =>
    d.cancelled
      ? `✓ Order ${d.orderId} cancelled.`
      : `✗ Cancel failed for ${d.orderId}: ${d.error || 'unknown error'}`,

  'cancel-all_result': (d) =>
    d.count === 0 ? 'No open orders to cancel.' : `✓ Cancelled ${d.count} order(s).`,
};

// --- Main format function ---

export function formatResult(result, mode = 'text') {
  if (!result) return 'No result.';

  if (result instanceof SkillError || result instanceof Error) {
    return `Error [${result.code || 'UNKNOWN'}]: ${result.message}`;
  }

  if (mode === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (!result.ok) {
    const msg = result.error || result.data?.message || 'Unknown error';
    return `Error: ${msg}`;
  }

  const formatter = formatters[result.type];
  if (formatter) {
    let output = formatter(result.data);
    if (result.warnings?.length) {
      output += '\n\nWarnings:\n' + result.warnings.map(w => `  ⚠ ${w}`).join('\n');
    }
    return output;
  }

  return JSON.stringify(result.data, null, 2);
}
