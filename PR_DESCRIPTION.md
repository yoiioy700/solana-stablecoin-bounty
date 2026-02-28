# Solana Stablecoin Standard — Complete SSS-1 / SSS-2 / SSS-3 Framework

## What's in this PR?

Hey team! This PR introduces the production-ready stablecoin framework I've been building for the Solana Stablecoin Standard (SSS) bounty. It implements the core Token-2022 extensions to support:

- **SSS-1 (Minimal)** — RBAC-styled stablecoin with per-minter quotas, supply caps, and circuit breakers.
- **SSS-2 (Compliant)** — Transfer Hook–driven compliance layer with blacklists/whitelists and permanent delegates.
- **SSS-3 (Private)** — Confidential transfer–ready preset with Auditor role on top of Token-2022.

Everything is packed in: the on-chain Anchor programs, a strongly-typed TypeScript SDK, a full-featured CLI for operators, an admin TUI, an admin frontend, and a Docker-ready REST backend.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Applications (CLI / Frontend / Backend / TUI)          │
├─────────────────────────────────────────────────────────┤
│  TypeScript SDK (@stbr/sss-token)                       │
│  - SolanaStablecoin class  - PrivacyModule              │
│  - SSS1/SSS2/SSS3 presets  - PDA helpers                │
├──────────────────────┬──────────────────────────────────┤
│  sss-token (SSS-1/2) │  sss-transfer-hook (SSS-2)      │
│  Anchor 0.30.1       │  Anchor 0.30.1                  │
│  Token-2022          │  TransferHook interface         │
└──────────────────────┴──────────────────────────────────┘
```

## Deliverables

### On-Chain Programs (Anchor 0.30.1 / Token-2022)

**`sss-token`** — Core stablecoin program (SSS-1, SSS-2, and SSS-3 presets)

Instructions:
- `initialize` — create stablecoin with preset (SSS-1: minimal, SSS-2: hook + delegate, SSS-3: confidential-capable mint)
- `mint` / `burn` — token lifecycle with role enforcement
- `freeze_account` / `thaw_account` — account-level control
- `set_paused` — emergency circuit breaker
- `update_roles` — role-based access control (master, minter, burner, pauser, freezer, seizer)
- `update_minter_quota` — per-minter mint quota enforcement
- `batch_mint` — mint to multiple recipients in one transaction via `remaining_accounts`
- `transfer_authority` — atomic admin transfer
- `update_features` — configure supply cap + epoch quota
- `create_proposal` / `approve_proposal` / `execute_proposal` — multisig governance

On-chain state (`StablecoinState`):
- `authority`, `mint`, `name`, `symbol`, `decimals`
- `total_supply`, `is_paused`, `features`, `supply_cap`
- `epoch_quota`, `current_epoch_minted`, `current_epoch_start`

**`sss-transfer-hook`** — Compliance transfer hook (SSS-2)

Instructions:
- `initialize_hook` — setup hook with fee config and compliance settings
- `transfer_hook` — enforce blacklist / whitelist on every transfer
- `add_blacklist` / `remove_blacklist` — address-level blocking
- `add_whitelist` / `remove_whitelist` — allowlist management
- `batch_blacklist` — bulk blacklist operation
- `seize_tokens` — confiscate and redirect tokens (via permanent delegate)
- `update_hook_config` — update fee rates and compliance rules

### TypeScript SDK (`@stbr/sss-token`)

```typescript
import { SolanaStablecoin, SSS1_PRESET, SSS2_PRESET, SSS3_PRESET, quickStart } from '@stbr/sss-token';

// Quick start helpers
const { initSSS1, initSSS2, mint, burn } = quickStart(connection, wallet);
const sss1 = await initSSS1('My USD', 'MUSD');

// Full SDK
const sdk = new SolanaStablecoin(connection, wallet);
await sdk.initialize({ name: 'MUSD', symbol: 'MUSD', decimals: 6, ...SSS2_PRESET });
await sdk.mint(stablecoinPDA, recipientATA, 1_000_000);
await sdk.compliance.blacklistAdd(address);
await sdk.getTotalSupply(stablecoinPDA);
```

Features:
- SSS-1, SSS-2, SSS-3 preset configurations
- Full token lifecycle: mint, burn, freeze, thaw, pause, unpause
- Role management and quota enforcement
- Compliance: blacklist, whitelist, seize
- Confidential transfer helpers (SSS-3 via `PrivacyModule`)
- Authority transfer
- All PDA derivation helpers
- Typed error hierarchy

### Admin CLI

```bash
npx ts-node cli/src/index.ts status
npx ts-node cli/src/index.ts init --preset sss-2
npx ts-node cli/src/index.ts blacklist add <address>
npx ts-node cli/src/index.ts pause
npx ts-node cli/src/index.ts config --network devnet
```

Commands: `init`, `mint`, `burn`, `freeze`, `thaw`, `pause`, `unpause`, `blacklist add/remove`, `whitelist`, `seize`, `status`, `config`

### Backend (Express)

- REST API for all stablecoin operations
- API key authentication
- Rate limiting
- Compliance screening endpoints
- Audit trail with pagination
- WebSocket event subscriptions
- Docker-ready (PostgreSQL + Redis stack)

### Admin Tools

- **Admin TUI (Ink)** — terminal dashboard for real-time monitoring and operations.
- **Admin Frontend (Next.js)** — browser-based panel for managing roles, minting, blacklists, and status.

## Test Coverage

There are **40+ tests** validating the core logic end-to-end:

- **SSS-1 (26 tests)** — initialization, mint quotas, role enforcement, freeze/thaw states, supply cap math.
- **SSS-2 (15+ tests)** — transfer hook lifecycle, blacklist blocking, permanent delegate seizures, hook config updates, whitelist bypass scenarios.
- **SSS-3 / Privacy & Fuzz** — confidential transfer helpers and fuzz-style scenarios for stress testing.

Commands:

```bash
# Full suite
anchor test

# Individual suites
npx ts-mocha -p ./tsconfig.json tests/sss-1.test.ts --timeout 120000
npx ts-mocha -p ./tsconfig.json tests/sss-2.test.ts --timeout 120000
npx ts-mocha -p ./tsconfig.json tests/fuzz.test.ts --timeout 300000
```

## Quick Start

```bash
git clone https://github.com/yoiioy700/solana-stablecoin-bounty
cd solana-stablecoin-bounty
npm install

# Build programs (requires Rust + Anchor 0.30.1)
anchor build

# Run all tests
anchor test

# CLI
npx ts-node cli/src/index.ts --help

# Backend
cd backend && npm install && npm start
```

## Devnet Deployment

Programs are deployed to devnet and wired into the toolchain:

| Program           | ID                                          |
|-------------------|---------------------------------------------|
| `sss_token`       | `8JpbyYEJXLeWoPJcLsHWg64bDtwFZXhPoubVJPeH11aH` |
| `sss_transfer_hook` | `By3BWwxkz7uFMRw1bD63VUnVMysMh79A3A6D58cHaXmB` |

See `deployments/devnet.json` and `docs/DEPLOYMENT.md` for full deployment proof (transactions, slots, and sample lifecycle runs).

## Known Limitations

1. **SSS-3 confidential transfers**: `PrivacyModule` currently provides `deposit` and `applyPending` helpers. Full ZK proof generation is expected to be provided by an off-chain proof service.

## Bounty Alignment Checklist

I've made sure to hit every single requirement for the bounty:
- **Presets**: SSS-1 (Minimal), SSS-2 (Compliant), and SSS-3 (Private) are implemented on Token-2022.
- **Compliance Rules**: Transfer Hook, Permanent Delegate, Blacklists/Whitelists, and Role-Based Access Control are all working on-chain.
- **Economics**: Supply caps, epoch mint quotas, and batch minting are enforced.
- **Ecosystem**: You're getting an Admin CLI, a TypeScript SDK, a REST API Backend, a TUI, and an Admin Frontend panel.
- **Quality**: 40+ tests, GitHub Actions CI configured, devnet deployment proof, and full documentation across the board.

Let me know what you think! I'm especially excited about how the SSS-3 module (Confidential Transfers) and operator tooling came together.
