# Authentication Reference

## Overview

Polymarket uses two-layer auth:
1. **L1** (EIP-712 signature with private key) → creates/derives API credentials
2. **L2** (HMAC-SHA256 with API key) → authenticates trading requests

The `@polymarket/clob-client` SDK handles both layers automatically.

## L1 Authentication

Used to create or derive API credentials. Proves wallet ownership.

### EIP-712 Domain

```typescript
const domain = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137,  // Polygon
};

const types = {
  ClobAuth: [
    { name: "address", type: "address" },
    { name: "timestamp", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "message", type: "string" },
  ],
};
```

### L1 Required Headers

| Header | Value |
|--------|-------|
| `POLY_ADDRESS` | Polygon signer address |
| `POLY_SIGNATURE` | EIP-712 signature |
| `POLY_TIMESTAMP` | Current UNIX timestamp (string) |
| `POLY_NONCE` | Nonce (default: 0) |

### Endpoints

```
GET  https://clob.polymarket.com/auth/derive-api-key  — derive existing creds
POST https://clob.polymarket.com/auth/api-key         — create new creds
```

Response:
```json
{
  "apiKey": "uuid-string",
  "secret": "base64-encoded-secret",
  "passphrase": "human-readable-passphrase"
}
```

**Important:** Credentials are deterministic — the same private key + nonce always produce the same credentials. Use `createOrDeriveApiKey()` (which uses nonce=0) to get stable credentials.

## L2 Authentication

Used for all trading endpoints. HMAC-SHA256 signature of the request.

### HMAC Signature

```
signature = HMAC-SHA256(
  key = base64_decode(secret),
  message = timestamp + method + path + body
)
signature = base64_encode(signature)
```

### L2 Required Headers (all 5)

| Header | Value |
|--------|-------|
| `POLY_ADDRESS` | Polygon signer address |
| `POLY_SIGNATURE` | HMAC-SHA256 signature |
| `POLY_TIMESTAMP` | Current UNIX timestamp (string) |
| `POLY_API_KEY` | API key UUID |
| `POLY_PASSPHRASE` | API passphrase |

## SDK Usage

The SDK handles both L1 and L2 automatically:

```typescript
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers"; // v5

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;
const signer = new Wallet(process.env.PRIVATE_KEY);

// Step 1: L1 — derive stable API credentials
const tempClient = new ClobClient(HOST, CHAIN_ID, signer);
const apiCreds = await tempClient.createOrDeriveApiKey();
// Save apiCreds: { apiKey, secret, passphrase }

// Step 2: L2 trading client
const client = new ClobClient(
  HOST,
  CHAIN_ID,
  signer,
  apiCreds,
  2,              // signatureType: 2=GNOSIS_SAFE (default for Polymarket.com accounts)
  "FUNDER_ADDR"   // proxy wallet address from polymarket.com/settings
);

// Now ready to trade
const order = await client.createAndPostOrder({ ... });
```

## Proxy Wallet

Polymarket.com accounts use a **Gnosis Safe proxy wallet** (signature type 2):
- The proxy is auto-deployed on first login to polymarket.com
- Your "private key" from polymarket.com/settings is the **signer key** (not the proxy address)
- The **funder address** (proxy wallet) holds USDC.e and is visible at polymarket.com/settings
- When you export your key, it's the signing key — the proxy wallet is controlled by this key

For `dpro-pm account add`:
- `--sig-type 2` (default): Standard Polymarket.com account (Gnosis Safe proxy)
- `--sig-type 0`: Raw MetaMask EOA (funder = signer address)
- `--funder <address>`: Specify proxy wallet address explicitly

## Credential Storage

The dpro-pm skill stores credentials in `~/.config/dpro-pm/`:
- `keys.enc` — AES-256-GCM encrypted private keys (one per account)
- `creds.enc` — AES-256-GCM encrypted API credentials (apiKey/secret/passphrase)
- `config.json` — Account metadata (addresses, aliases, sigType) — not encrypted

Credentials are derived on first trade and cached in `creds.enc`. If you need to regenerate, delete `creds.enc`.

## Revoking Credentials

To revoke API credentials (e.g., if compromised):
```typescript
await client.revokeApiKey();
```
Then re-derive with `createOrDeriveApiKey()` using a new nonce.
