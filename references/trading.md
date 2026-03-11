# Trading Reference

## Order Types

| Type | Behavior | When to Use |
|------|----------|-------------|
| **GTC** | Good-Til-Cancelled. Rests on book until filled or cancelled. | Default for limit orders. |
| **GTD** | Good-Til-Date. Active until timestamp. Min = `now + 60 + N`. | Auto-expire before event resolution. |
| **FOK** | Fill-Or-Kill. Fills entirely immediately or cancelled. | Market orders (all-or-nothing). |
| **FAK** | Fill-And-Kill. Fills available immediately, rest cancelled. | Partial market orders. |

- Post-only: GTC/GTD only. Rejected if it would cross the spread (takes liquidity).

## Amount Semantics

- **BUY amount**: number of YES/NO shares to buy
- **SELL amount**: number of YES/NO shares to sell
- For FOK/FAK BUY: amount = USDC to spend (not shares)
- For FOK/FAK SELL: amount = number of shares to sell

## Price Range

Prices are in the range `[0.01, 0.99]` representing probability ($0.01–$0.99 per share).
- At resolution: YES wins → YES token worth $1.00, NO token worth $0.00
- Never order at exactly 0 or 1

## Order Signing

Orders require EIP-712 signing with the CTF Exchange contract. The `@polymarket/clob-client` SDK handles this automatically.

Order struct:
```
{
  salt: uint256,        // random nonce
  maker: address,       // user's proxy wallet (funder)
  signer: address,      // signing wallet
  taker: address,       // 0x0 (open order)
  tokenId: uint256,     // outcome token ID
  makerAmount: uint256, // amount of shares
  takerAmount: uint256, // amount of USDC (price × shares × 1e6)
  expiration: uint256,  // 0 for GTC, unix timestamp for GTD
  nonce: uint256,       // 0
  feeRateBps: uint256,  // builder fee
  side: uint8,          // 0=BUY, 1=SELL
  signatureType: uint8  // 0=EOA, 1=POLY_PROXY, 2=GNOSIS_SAFE
}
```

## Signature Types

| Type | Value | When to Use |
|------|-------|-------------|
| EOA | `0` | Standard MetaMask wallet. Funder = signer address. Needs POL for gas. |
| POLY_PROXY | `1` | Magic Link / Google login users who exported private key from Polymarket.com. |
| GNOSIS_SAFE | `2` | **Default**. Gnosis Safe proxy wallet (all Polymarket.com accounts). |

The **funder** address is different from the signing key for proxy accounts:
- EOA: funder = signer address
- Proxy: funder = proxy wallet address (visible at polymarket.com/settings)

## CLOB Trading API

Base URL: `https://clob.polymarket.com`

### Place Order (requires L2 auth)

```
POST /orders
Headers: POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_API_KEY, POLY_PASSPHRASE

Body:
{
  "order": {
    "salt": "...",
    "maker": "0x...",
    "signer": "0x...",
    "taker": "0x0000...",
    "tokenId": "12345...",
    "makerAmount": "10000000",
    "takerAmount": "6500000",
    "expiration": "0",
    "nonce": "0",
    "feeRateBps": "0",
    "side": "BUY",
    "signatureType": 2,
    "signature": "0x..."
  },
  "owner": "0x...",
  "orderType": "GTC"
}
```

Response:
```json
{
  "orderID": "0xabc...",
  "status": "live",
  "size_matched": "0",
  "price": "0.65",
  "asset_id": "12345..."
}
```

Status values: `"live"` (resting), `"matched"` (fully filled), `"delayed"`, `"error"`

### Cancel Order (requires L2 auth)

```
DELETE /orders/{orderID}
Headers: POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_API_KEY, POLY_PASSPHRASE
```

### Cancel All (requires L2 auth)

```
DELETE /orders
Body: { "market": "0x..." }  // optional market filter
```

### Get Open Orders (requires L2 auth)

```
GET /orders?market=<conditionId>
Headers: L2 auth headers
```

## Order Lifecycle

1. Order signed locally with private key (EIP-712)
2. POST to CLOB → returns `orderID` + initial status
3. Status transitions: `live` → `matched` (full fill) or `live` → cancelled
4. Fills visible in trade history at `data-api.polymarket.com/activity`

## Error Handling

Common errors from CLOB:
- `"insufficient balance"` — Not enough USDC.e in proxy wallet
- `"order size too small"` — Below minimum order size ($0.50 USDC approx)
- `"price out of tick size"` — Price doesn't align with tick size
- `"market not active"` — Market is closed or not yet open for trading
- `"token not tradeable"` — Token ID doesn't have CLOB support

## Gas

Polymarket uses gasless transactions via relayer (orders posted to CLOB don't need POL for gas).
Only on-chain actions (split, merge, redeem) require POL gas.
