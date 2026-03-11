# Market Data Reference

## Gamma API

Base URL: `https://gamma-api.polymarket.com`

### Search Markets

```
GET /markets?_c=question&s=<query>&limit=20&active=true
```

Query params:
- `_c=question` — search in question field
- `s=<query>` — search text
- `active=true|false` — filter active/closed markets
- `closed=true|false` — filter closed markets
- `limit=N` — result count (default 100)
- `offset=N` — pagination offset
- `order=volume24hr|liquidity|createdAt` — sort field
- `ascending=true|false` — sort direction

### Get Market by Condition ID or Slug

```
GET /markets/<condition_id>           — by condition ID (0x...)
GET /markets?slug=<market-slug>       — by slug
```

### Market Object Structure

```json
{
  "id": "...",
  "question": "Will Bitcoin hit $100k before 2025?",
  "conditionId": "0x1234...",
  "slug": "will-bitcoin-hit-100k",
  "resolutionSource": "Coinbase",
  "endDate": "2024-12-31T00:00:00Z",
  "liquidity": 250000,
  "volume": 1800000,
  "volume24hr": 45000,
  "active": true,
  "closed": false,
  "negRisk": false,
  "minimum_tick_size": "0.01",
  "tokens": [
    { "token_id": "12345...", "outcome": "YES" },
    { "token_id": "67890...", "outcome": "NO" }
  ],
  "outcomePrices": ["0.65", "0.35"],
  "rewards": { "maxSpread": "0.05", "eventStartDate": "..." }
}
```

### Get Events

```
GET /events?slug=<event-slug>
GET /events?active=true&limit=20
```

Events contain multiple markets (e.g., "2024 US Election" has markets for each candidate).

```json
{
  "id": "...",
  "title": "2024 US Presidential Election",
  "slug": "us-presidential-election-2024",
  "description": "...",
  "markets": [ ... array of market objects ... ]
}
```

### Get Trending Markets

```
GET /markets?active=true&closed=false&limit=20&order=volume24hr&ascending=false
```

## Data API

Base URL: `https://data-api.polymarket.com`

### Trade History

```
GET /activity?user=<address>&limit=20
```

Response:
```json
[
  {
    "id": "...",
    "timestamp": "2024-01-15T10:30:00Z",
    "conditionId": "0x...",
    "side": "BUY",
    "outcome": "YES",
    "size": 10.5,
    "price": 0.65,
    "usdcSize": 6.825,
    "transactionHash": "0x..."
  }
]
```

### Positions

```
GET /positions?user=<address>
```

Response:
```json
[
  {
    "conditionId": "0x...",
    "outcome": "YES",
    "size": 50.0,
    "avgPrice": 0.62,
    "currentValue": 32.50,
    "initialValue": 31.00,
    "cashBalance": 1.50
  }
]
```

## CLOB API — Market Data (No Auth)

Base URL: `https://clob.polymarket.com`

### Order Book

```
GET /order-book?token_id=<token_id>
```

Response:
```json
{
  "market": "0x...",
  "asset_id": "12345...",
  "hash": "...",
  "bids": [{ "price": "0.64", "size": "100.5" }, ...],
  "asks": [{ "price": "0.66", "size": "75.0" }, ...]
}
```

### Midpoint

```
GET /midpoint?token_id=<token_id>
```

### Spread

```
GET /spread?token_id=<token_id>
```

### Best Price (Best Bid/Ask)

```
GET /price?token_id=<token_id>&side=buy|sell
```

### Last Trade Price

```
GET /last-trade-price?token_id=<token_id>
```

## Market Identifiers

- **Slug**: `will-bitcoin-hit-100k` — human-readable, used in URLs
- **Condition ID**: `0x1234abcd...` — 32-byte hex, unique per market
- **Token ID**: Large integer string like `"71321045679252212594626385532706912750332728571942532289631379312455583992563"` — unique per outcome

For buy/sell orders, you need the **token ID** of the specific outcome (YES or NO).
Use `dpro-pm quote <slug>` to get token IDs.

## Negative Risk Markets

Some markets use the **Negative Risk** mechanism for multi-outcome events.
- `negRisk: true` on the market object
- Uses different CTF Exchange contract: `0xC5d563A36AE78145C45a50134d48A1215220f80a`
- Token behavior: holding NO on all outcomes of a neg risk event = holding USDC
- The SDK handles this automatically via the `negRisk` option flag

## Tick Sizes

Common tick sizes:
- `0.01` — most markets (1 cent increments)
- `0.001` — some high-liquidity markets

Prices outside tick boundaries will be rejected. The `minimum_tick_size` field on the market object tells you the correct tick.
