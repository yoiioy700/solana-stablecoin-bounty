# Solana Stablecoin Standard — SSS-1 & SSS-2 Implementation

## Summary

Production-ready stablecoin framework for Solana Token-2022 covering SSS-1 (minimal) and SSS-2 (compliant with transfer hook) presets. Comprehensive on-chain programs, TypeScript SDK, CLI, REST backend, and full test coverage.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Applications (CLI / Frontend / Backend)                │
├─────────────────────────────────────────────────────────┤
│  TypeScript SDK (@ssb/sss-sdk)                          │
│  - SolanaStablecoin class  - PrivacyModule              │
│  - SSS1/SSS2/SSS3 presets  - PDA helpers                │
├──────────────────────┬──────────────────────────────────┤
│  sss-token (SSS-1)   │  sss-transfer-hook (SSS-2)      │
│  Anchor 0.30.1       │  Anchor 0.30.1                  │
│  Token-2022          │  TransferHook interface          │
└──────────────────────┴──────────────────────────────────┘
```

## Deliverables

### On-Chain Programs (Anchor 0.30.1 / Token-2022)

**`sss-token`** — Core stablecoin program (SSS-1 & SSS-2)

Instructions:
- `initialize` — create stablecoin with preset (SSS-1: minimal, SSS-2: hook + delegate)
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

### TypeScript SDK

```typescript
import { SolanaStablecoin, SSS1_PRESET, SSS2_PRESET, quickStart } from '@ssb/sss-sdk';

// Quick start
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
- Confidential transfer helpers (SSS-3 via PrivacyModule)
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
- Docker-ready

### Test Coverage

SSS-1 (26 tests):
- Initialize + double-init prevention
- Mint with quota tracking
- Burn and supply reduction
- Freeze / thaw account
- Pause / unpause + mint blocking when paused
- Supply cap enforcement
- Role grant + quota management
- Authority transfer
- Batch mint to multiple recipients

SSS-2 (15+ tests):
- Initialize with transfer hook + permanent delegate
- Hook configuration
- Blacklist enforcement on transfers
- Token seizure
- Config updates
- Whitelist bypass

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

## Known Limitations

1. SSS-3 confidential transfers: `PrivacyModule` provides `deposit` and `applyPending` helpers. Full ZK proof generation requires an off-chain proof service.
2. Devnet deployment: programs not yet deployed to devnet (deployment workflow configured in CI).

## Bounty Alignment

| Requirement | Status |
|---|---|
| SSS-1 Minimal preset | ✅ |
| SSS-2 Compliant preset | ✅ |
| Transfer Hook (Token-2022) | ✅ |
| Permanent Delegate | ✅ |
| Role-based access control | ✅ |
| Blacklist / Whitelist | ✅ |
| Supply cap + epoch quota | ✅ |
| Batch mint | ✅ |
| Multisig governance | ✅ |
| TypeScript SDK | ✅ |
| Admin CLI | ✅ |
| Backend API | ✅ |
| Frontend / Demo | ✅ |
| Tests | ✅ 40+ tests |
| CI/CD | ✅ GitHub Actions |
| Documentation | ✅ |
