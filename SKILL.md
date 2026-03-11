---
name: dpro-polymarket
description: Polymarket prediction market trading and data skill. Use this skill whenever the user wants to query, trade, or manage positions on Polymarket — including searching prediction markets, getting YES/NO prices, viewing order books, placing buy/sell orders, checking balances and positions, managing open orders, or setting up Polymarket accounts. Trigger for phrases like "polymarket", "prediction market", "buy yes", "buy no", "market odds", "dpro-pm", or any request involving Polymarket trading or data.
compatibility: Requires Node.js 18+, network access to Polymarket APIs (clob.polymarket.com, gamma-api.polymarket.com). Run `npm install` in the skill directory before first use.
---

# dpro-polymarket

Polymarket prediction market skill — query markets, manage accounts, and trade YES/NO shares.

## Quick Start

```
dpro-pm search <query>                         Search prediction markets
dpro-pm quote <slug>                           YES/NO prices for a market
dpro-pm book <token-id>                        Order book depth
dpro-pm trending                               Trending markets
dpro-pm event <slug>                           Event with all markets

dpro-pm account ls                             List configured accounts
dpro-pm account add <privateKey> [alias]       Add account (encrypts key)
dpro-pm account remove <alias>                 Remove account
dpro-pm account show                           Show default account
dpro-pm balance                                USDC.e balance
dpro-pm positions                              Open positions
dpro-pm orders                                 Open orders
dpro-pm history                                Trade history

dpro-pm buy <slug> yes <amount> [<price>]      Buy YES shares (limit or market)
dpro-pm buy <slug> no <amount> [<price>]       Buy NO shares
dpro-pm sell <slug> yes <amount> [<price>]     Sell YES shares
dpro-pm sell <slug> no <amount> [<price>]      Sell NO shares
dpro-pm cancel <orderId>                       Cancel an order
dpro-pm cancel-all [<conditionId>]             Cancel all open orders
```

## Entry Point

The skill is invoked via `scripts/entry.mjs` which exports `runPolymarketSkill(rawInput, runtimeContext)`.

```javascript
import { runPolymarketSkill } from './scripts/entry.mjs';
const result = await runPolymarketSkill('dpro-pm search bitcoin', {});
console.log(result);
```

## Command Reference

### Market Data (no auth required)

| Command | Description |
|---------|-------------|
| `search <query>` | Search markets by keyword |
| `quote <slug>` | YES/NO prices, volume, liquidity |
| `book <token-id>` | Full order book (top 10 levels) |
| `trending` | Trending markets by volume |
| `event <slug>` | Event info with all sub-markets |

### Account Management

| Command | Description |
|---------|-------------|
| `account add <privateKey> [alias]` | Add account (encrypts private key with password) |
| `account add-readonly <address> [alias]` | Add read-only account (no trading) |
| `account ls` | List all configured accounts |
| `account remove <alias>` | Remove account |
| `account show` | Show default account info |
| `account set-default <alias>` | Set default account |

### Account Queries (requires account)

| Command | Description |
|---------|-------------|
| `balance` | USDC.e balance |
| `positions` | Open positions with P&L |
| `orders` | Open orders |
| `history [--limit N]` | Recent trade history |

### Trading (requires API account)

| Command | Description |
|---------|-------------|
| `buy <slug> yes\|no <amount> [<price>]` | Buy outcome shares |
| `sell <slug> yes\|no <amount> [<price>]` | Sell outcome shares |
| `cancel <orderId>` | Cancel a specific order |
| `cancel-all [<conditionId>]` | Cancel all orders (optional: for one market) |

**Order types:**
- With `<price>`: limit GTC order (rests on book until filled or cancelled)
- Without `<price>`: market order (FOK — fill entirely or cancel)

**Flags:**
- `--type gtc|gtd|fok|fak` — override order type
- `--expires <timestamp>` — expiry for GTD orders (unix seconds)
- `--account <alias>` — use specific account (default: default account)
- `--password <pwd>` — account password (or set env DPRO_PM_PASSWORD)
- `--json` — output raw JSON

## Account Setup

Polymarket uses two-layer authentication:
1. **L1 (wallet)**: EIP-712 signature with your private key → derives API credentials
2. **L2 (HMAC)**: API key + secret + passphrase → signs trading requests

The `account add` command handles both:
- Encrypts the private key with your password
- On first trade, derives API credentials automatically and stores them

**Setup workflow:**
```
1. Get private key from Polymarket (polymarket.com/settings → export key)
2. dpro-pm account add <0x-private-key> myaccount --password <yourpassword>
3. dpro-pm balance   ← verifies connection
4. dpro-pm buy will-bitcoin-hit-100k yes 10 0.65
```

**Important:**
- Signature type 2 (GNOSIS_SAFE proxy) is used by default — correct for Polymarket.com accounts
- The funder address is the proxy wallet address visible at polymarket.com/settings
- If you exported your key via MetaMask (not Polymarket), use `--sig-type 0` (EOA)

## Market Identifiers

Polymarket markets can be referenced by:
- **Slug**: `will-bitcoin-hit-100k-in-2024` (human-readable, used in URLs)
- **Condition ID**: `0x1234...` (hex, unique per market)
- **Token ID**: long integer string (per outcome — YES and NO have different IDs)

For `quote`, `buy`, `sell`: use slug or condition ID (skill resolves to token IDs automatically)
For `book`: use token ID directly

## API Endpoints

| API | Base URL | Auth |
|-----|----------|------|
| CLOB | `https://clob.polymarket.com` | L2 for trades |
| Gamma | `https://gamma-api.polymarket.com` | None |
| Data | `https://data-api.polymarket.com` | None |

## Contract Addresses (Polygon)

| Contract | Address |
|----------|---------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| CTF | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |

## Safety Policy

- **Read operations** (search, quote, book, trending): always safe, no confirmation needed
- **Account setup** (account add): confirm private key is being encrypted before storage
- **Trading** (buy/sell): always show order summary and require confirmation before submitting
  - Show: market name, outcome, amount, price (or estimated market price), estimated cost
  - Confirm explicitly before calling POST /orders
- **Cancel**: confirm before cancelling unless user says "just cancel"

## Reference Files

Load on demand:
- `references/markets.md` — Gamma API details, market/event structure, search params
- `references/trading.md` — Order types, signing, tick sizes, negative risk markets
- `references/auth.md` — L1/L2 auth details, credential lifecycle, signature types
