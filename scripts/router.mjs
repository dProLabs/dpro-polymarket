import { unknownCommand } from './errors.mjs';

const handlers = {
  market: null,
  account: null,
  trade: null,
};

export function registerHandlers({ market, account, trade }) {
  if (market) handlers.market = market;
  if (account) handlers.account = account;
  if (trade) handlers.trade = trade;
}

const HELP_TEXT = [
  'dpro-polymarket — Polymarket prediction market skill',
  '',
  'Market data (no auth):',
  '  dpro-pm search <query>          Search markets',
  '  dpro-pm quote <slug>            YES/NO prices',
  '  dpro-pm book <token-id>         Order book',
  '  dpro-pm trending                Trending by volume',
  '  dpro-pm event <slug>            Event with all markets',
  '',
  'Account:',
  '  dpro-pm account add <key> [alias] --password <pwd>',
  '  dpro-pm account ls              List accounts',
  '  dpro-pm balance                 USDC balance',
  '  dpro-pm positions               Open positions',
  '  dpro-pm orders                  Open orders',
  '  dpro-pm history                 Trade history',
  '',
  'Trading:',
  '  dpro-pm buy <slug> yes <amount> [<price>]',
  '  dpro-pm sell <slug> no <amount> [<price>]',
  '  dpro-pm cancel <orderId>        Cancel order',
  '  dpro-pm cancel-all              Cancel all orders',
].join('\n');

export async function routeCommand(parsed, ctx) {
  const { domain, action } = parsed;

  if (domain === 'help') {
    return { ok: true, type: 'help', data: { message: HELP_TEXT } };
  }

  const handler = handlers[domain];
  if (!handler) {
    throw unknownCommand(`No handler registered for domain: ${domain}`);
  }

  // Try exact action name first
  if (typeof handler[action] === 'function') {
    return handler[action](parsed, ctx);
  }

  // Try kebab-to-camelCase: "cancel-all" → "cancelAll", "add-readonly" → "addReadonly"
  const camel = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (typeof handler[camel] === 'function') {
    return handler[camel](parsed, ctx);
  }

  throw unknownCommand(`Unknown action "${action}" in domain "${domain}"`);
}
