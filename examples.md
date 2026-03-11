# dpro-polymarket Examples

Task-oriented workflow examples for common Polymarket use cases.

This file is a **cookbook**, not a full command reference.

Use the other docs for their intended purposes:

- `README.md` for installation, runtime model, and high-level usage
- `SKILL.md` for routing, execution policy, and safety rules
- `references/markets.md` for Gamma API and market structure
- `references/trading.md` for order types and signing
- `references/auth.md` for authentication details

---

## How to use this file

Follow these examples when you already know the task you want to complete.

Typical pattern:

1. search or identify the market
2. get the YES/NO prices with `quote`
3. check the order book depth if needed
4. confirm account balance
5. place the trade and verify

---

## Setup workflow

Goal: add an account and verify the runtime is ready.

### 1. Export private key from Polymarket

Go to `polymarket.com/settings` → "Export Private Key"

### 2. Add the account

```bash
dpro-pm account add 0xYourPrivateKey myaccount --password <password>
```

### 3. Verify account is configured

```bash
dpro-pm account ls
dpro-pm account show
```

### 4. Verify connection and balance

```bash
dpro-pm balance
```

### 5. Verify runtime invocation

```bash
node --input-type=module -e "
  import { runPolymarketSkill } from './scripts/entry.mjs';
  console.log(await runPolymarketSkill('dpro-pm balance', { password: '***' }));
"
```

Expected outcome:
- account list shows your alias and address
- balance returns your USDC.e amount
- no auth errors

---

## Market discovery workflow

Goal: find relevant markets and understand pricing.

### 1. Search by keyword

```bash
dpro-pm search "federal reserve rate"
dpro-pm search "bitcoin 2025"
dpro-pm search trump tariffs
```

### 2. Browse trending markets

```bash
dpro-pm trending
dpro-pm trending --limit 30
```

### 3. Get full event with all sub-markets

```bash
dpro-pm event us-presidential-election-winner-2024
dpro-pm event iran-strikes-israel-on
```

### 4. Get detailed quote for a specific market

```bash
dpro-pm quote will-the-fed-cut-rates-in-march-2026
dpro-pm quote will-trump-tariffs-exceed-10-percent
```

Expected outcome:
- search returns markets ranked by relevance
- quote shows YES/NO prices, volume, liquidity, and token IDs

---

## Order book workflow

Goal: understand market depth before trading.

### 1. Get token IDs from quote

```bash
dpro-pm quote will-iran-strike-israel-on-march-6
# Output includes: YES token: <token-id>, NO token: <token-id>
```

### 2. Check order book depth

```bash
dpro-pm book <yes-token-id>
dpro-pm book <no-token-id>
dpro-pm book <token-id> --levels 20
```

Expected outcome:
- bids show buyers (offers to buy at price)
- asks show sellers (offers to sell at price)
- spread = best ask - best bid
- thin books (few levels) mean higher slippage for large orders

---

## Limit order workflow

Goal: buy YES/NO shares at a specific price and confirm the fill.

### 1. Find the market

```bash
dpro-pm search "fed rate cut march"
```

### 2. Get current prices

```bash
dpro-pm quote will-the-fed-cut-rates-in-march-2026
# YES: 12.5% ($0.1250)
# NO:  87.5% ($0.8750)
```

### 3. Check order book

```bash
dpro-pm book <yes-token-id> --levels 5
```

### 4. Place a limit buy order

```bash
# Buy 100 YES shares at $0.12 (GTC — rests on book)
dpro-pm buy will-the-fed-cut-rates-in-march-2026 yes 100 0.12

# Buy 50 NO shares at $0.87 (limit)
dpro-pm buy will-the-fed-cut-rates-in-march-2026 no 50 0.87
```

### 5. Verify the order

```bash
dpro-pm orders
```

### 6. Cancel if needed

```bash
dpro-pm cancel <orderId>
```

Expected outcome:
- order appears in open orders with status "live" (resting)
- order fills when counterparty crosses the spread
- filled orders visible in `dpro-pm history`

---

## Market order workflow

Goal: buy or sell at the best available price immediately.

### 1. Get current mid price

```bash
dpro-pm quote will-trump-tariffs-exceed-10-percent
# YES: 73.2%  NO: 26.8%
```

### 2. Place market order (no price = FOK at best price ±5% slippage)

```bash
# Buy $50 worth of YES shares at market
dpro-pm buy will-trump-tariffs-exceed-10-percent yes 68 --type fok

# Sell 50 YES shares at market
dpro-pm sell will-trump-tariffs-exceed-10-percent yes 50
```

### 3. Verify fill

```bash
dpro-pm history --limit 5
dpro-pm positions
```

Expected outcome:
- market order fills immediately or cancels (FOK = all-or-nothing)
- position appears in `dpro-pm positions`
- trade visible in `dpro-pm history`

---

## Portfolio management workflow

Goal: review current exposure and manage positions.

### 1. Check balance

```bash
dpro-pm balance
```

### 2. Review open positions

```bash
dpro-pm positions
```

### 3. Review open orders

```bash
dpro-pm orders
```

### 4. Review recent trades

```bash
dpro-pm history
dpro-pm history --limit 50
```

### 5. Cancel all open orders

```bash
# Cancel all orders
dpro-pm cancel-all

# Cancel orders for a specific market
dpro-pm cancel-all <condition-id>
```

Expected outcome:
- positions show each market with shares, avg price, current price, and P&L
- orders show open limit orders with size, price, and fill status
- history shows all trades in reverse chronological order

---

## Sell/exit workflow

Goal: sell an existing position.

### 1. Find your position

```bash
dpro-pm positions
# Shows: Market, Outcome, Shares, AvgPrice, CurrentPrice, P&L
```

### 2. Get current market price

```bash
dpro-pm quote <market-slug>
```

### 3. Sell at limit price

```bash
# Sell 50 YES shares at $0.72 limit
dpro-pm sell will-trump-tariffs-exceed-10-percent yes 50 0.72
```

### 4. Or sell at market

```bash
# Sell immediately at best price
dpro-pm sell will-trump-tariffs-exceed-10-percent yes 50
```

Expected outcome:
- if limit: order rests on book until a buyer crosses at $0.72 or better
- if market: fills immediately at best available bid

---

## Multi-account workflow

Goal: operate with multiple accounts safely.

### 1. Add multiple accounts

```bash
dpro-pm account add 0xKey1 trading --password <pwd1>
dpro-pm account add 0xKey2 monitoring --password <pwd2>
```

### 2. Set default account

```bash
dpro-pm account set-default trading
```

### 3. Query a specific account

```bash
dpro-pm balance --account monitoring
dpro-pm positions --account trading
dpro-pm orders --account trading
```

### 4. Trade with explicit account

```bash
dpro-pm buy will-btc-hit-100k yes 20 0.65 --account trading --password <pwd>
```

Recommended practice:
- use explicit `--account <alias>` for trading when multiple accounts exist
- use `--password` flag or `DPRO_PM_PASSWORD` env var (not inline for security)

---

## Natural-language to canonical command

Goal: understand how user intent maps into commands.

```
"show me bitcoin prediction markets"
→ dpro-pm search bitcoin

"what's the probability of a Fed rate cut?"
→ dpro-pm search "fed rate cut"

"get the order book for the YES token"
→ dpro-pm book <token-id>

"what are the trending prediction markets?"
→ dpro-pm trending

"buy 50 YES shares on the Bitcoin market at 65 cents"
→ dpro-pm buy <bitcoin-slug> yes 50 0.65

"sell my NO shares at market price"
→ dpro-pm sell <market-slug> no <shares>

"cancel all my open orders"
→ dpro-pm cancel-all

"show my portfolio"
→ dpro-pm positions
→ dpro-pm orders
→ dpro-pm balance
```
