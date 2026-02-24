---
description: Deploy Solana stablecoin programs to devnet
---
// turbo-all

1. Check prerequisites:
```bash
solana --version && anchor --version && solana config get
```

2. Configure Solana CLI for devnet:
```bash
solana config set --url devnet
```

3. Check wallet balance (airdrop if needed):
```bash
solana balance
```

4. Airdrop SOL if balance is low:
```bash
solana airdrop 2
```

5. Build both programs:
```bash
cd C:\Users\muham\.gemini\antigravity\scratch\solana-stablecoin-bounty && anchor build
```

6. Get program keypair public keys and update declare_id if needed:
```bash
solana-keygen pubkey target/deploy/sss_token-keypair.json && solana-keygen pubkey target/deploy/sss_transfer_hook-keypair.json
```

7. Deploy programs to devnet:
```bash
cd C:\Users\muham\.gemini\antigravity\scratch\solana-stablecoin-bounty && anchor deploy --provider.cluster devnet
```

8. Verify deployment:
```bash
solana program show <PROGRAM_ID>
```
