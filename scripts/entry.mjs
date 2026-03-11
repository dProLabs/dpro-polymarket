import { parseInput } from './parser.mjs';
import { routeCommand, registerHandlers } from './router.mjs';
import { formatResult } from './format.mjs';
import { SkillError, ErrorCode } from './errors.mjs';
import { setWalletPassword, getWalletPassword } from './store.mjs';

let initialized = false;

async function ensureHandlers() {
  if (initialized) return;
  const [market, account, trade] = await Promise.all([
    import('./commands/market.mjs'),
    import('./commands/account.mjs'),
    import('./commands/trade.mjs'),
  ]);
  registerHandlers({
    market: market.default || market,
    account: account.default || account,
    trade: trade.default || trade,
  });
  initialized = true;
}

function resolvePassword(parsed, runtimeContext, env = process.env) {
  return (
    parsed?.flags?.password ||
    runtimeContext?.password ||
    env.DPRO_PM_PASSWORD ||
    null
  );
}

/**
 * Main skill entry point.
 *
 * @param {string} rawInput - The user's command string
 * @param {object} runtimeContext - Optional context: { password, network }
 * @returns {string} - Formatted result string
 */
export async function runPolymarketSkill(rawInput, runtimeContext = {}) {
  try {
    await ensureHandlers();

    const parsed = parseInput(rawInput);

    // Resolve password from flags > runtimeContext > env
    const password = resolvePassword(parsed, runtimeContext);
    if (password) {
      setWalletPassword(password);
      // Don't leak password in logs
      delete parsed.flags?.password;
    }

    const outputMode = parsed.flags?.json ? 'json' : 'text';
    const result = await routeCommand(parsed, runtimeContext);
    return formatResult(result, outputMode);
  } catch (err) {
    if (err instanceof SkillError) {
      return formatResult(err);
    }
    return `Unexpected error: ${err.message}`;
  }
}

export { setWalletPassword, getWalletPassword };
