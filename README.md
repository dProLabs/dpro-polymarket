# dpro-polymarket

An agent skill for **Polymarket** prediction market trading and data.

One skill surface covering market search, YES/NO price quotes, order books, account management, and trading — built for AI agent environments like **Claude Code**, **OpenClaw**, **Codex**, and **OpenCode**.

---

## Get Started

### Quick Install

```bash
# Claude Code
git clone <repo-url> .claude/skills/dpro-pm
cd .claude/skills/dpro-pm && npm install
```

Then add to your agent config:

```markdown
Skills: .claude/skills/dpro-pm/SKILL.md
```

### Local Development

```bash
git clone <repo-url>
cd dpro-polymarket
npm install
```

---

## What It Can Do

- **Market search** — find prediction markets by keyword, browse trending by volume
- **Price quotes** — YES/NO prices, liquidity, volume, token IDs for any market
- **Order books** — full depth for any outcome token
- **Account management** — encrypted multi-account storage with AES-256
- **Portfolio** — positions, open orders, USDC balance, trade history
- **Trading** — buy/sell YES/NO shares with limit or market orders (GTC/GTD/FOK/FAK)
- **Flexible invocation** — canonical commands, slash-style input, or natural language
- **Programmatic API** — `runPolymarketSkill(...)` entry point for automation

---

## Usage Examples

```text
dpro-pm search bitcoin 2025
dpro-pm quote will-iran-strike-israel-on-march-6
dpro-pm book <token-id>
dpro-pm trending
dpro-pm event us-presidential-election-2024

dpro-pm account add 0xYourPrivateKey myaccount --password <pwd>
dpro-pm balance
dpro-pm positions
dpro-pm orders

dpro-pm buy will-trump-win yes 50 0.65
dpro-pm sell will-trump-win yes 20
dpro-pm cancel <orderId>
dpro-pm cancel-all
```

### Programmatic

```js
import { runPolymarketSkill } from './scripts/entry.mjs';

const result = await runPolymarketSkill('dpro-pm search bitcoin', {});
console.log(result);

// With password for trading
const trade = await runPolymarketSkill(
  'dpro-pm buy will-btc-hit-100k yes 10 0.65',
  { password: 'your-password' }
);
console.log(trade);
```

---

## Account Setup

Polymarket uses a two-layer auth system:
1. **L1** — EIP-712 private key signing → derives API credentials
2. **L2** — HMAC-SHA256 API key signing → authenticates trading requests

The skill handles both automatically. You only need to provide your private key once:

```bash
# Export private key from polymarket.com/settings
dpro-pm account add 0xYourPrivateKey myaccount --password <password>

# Verify connection
dpro-pm balance

# Place a trade (API credentials derived automatically on first trade)
dpro-pm buy will-trump-tariffs-exceed-10-percent yes 10 0.55
```

**Signature types:**
- Default: `2` (GNOSIS_SAFE) — for standard Polymarket.com accounts
- Use `--sig-type 0` (EOA) for raw MetaMask wallets

---

## Reference Docs

| Document | Description |
|----------|-------------|
| [`SKILL.md`](SKILL.md) | Routing, execution policy, and safety rules |
| [`references/markets.md`](references/markets.md) | Gamma API, market structure, token IDs |
| [`references/trading.md`](references/trading.md) | Order types, signing, tick sizes |
| [`references/auth.md`](references/auth.md) | L1/L2 auth, credential lifecycle, signature types |
| [`examples.md`](examples.md) | Task-oriented workflow cookbook |

---

## Safety

- Trading commands always show a summary before submitting (handled by the skill's safety policy)
- Private keys are AES-256-GCM encrypted at rest — never stored in plain text
- API credentials are derived from private keys and cached separately
- Password can be passed via `--password`, `runtimeContext.password`, or `DPRO_PM_PASSWORD` env var

---

## Project Structure

```text
references/               # API and auth reference docs
scripts/
├── entry.mjs             # Single entry point: runPolymarketSkill()
├── parser.mjs            # Input parsing (command + natural language)
├── router.mjs            # AST → command handler dispatch
├── format.mjs            # Structured result → text output
├── config.mjs            # Config file management
├── store.mjs             # Encrypted account + credential storage
├── clients/
│   ├── clob-client.mjs   # CLOB API (orderbook, trading) via @polymarket/clob-client
│   └── gamma-client.mjs  # Gamma/Data API (markets, positions, history)
├── commands/
│   ├── market.mjs        # search, quote, book, trending, event
│   ├── account.mjs       # account management, balance, positions, orders, history
│   └── trade.mjs         # buy, sell, cancel, cancel-all
└── utils/
    ├── crypto.mjs        # AES-256-GCM encryption
    └── numbers.mjs       # Number formatting helpers
```

---

## API Endpoints Used

| API | Base URL | Purpose |
|-----|----------|---------|
| CLOB | `https://clob.polymarket.com` | Orderbook + trading (L2 auth for trades) |
| Gamma | `https://gamma-api.polymarket.com` | Markets, events, search (no auth) |
| Data | `https://data-api.polymarket.com` | Positions, trade history (no auth) |

## Contract Addresses (Polygon)

| Contract | Address |
|----------|---------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |

---

## License

MIT
