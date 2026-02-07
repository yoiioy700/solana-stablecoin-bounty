# SSS Token Demo

## Quick Demo (GIF Placeholder)

Below is a representation of the terminal demo. For a live recording, run:

```bash
bash scripts/demo.sh
```

## Screenshot Walkthrough

### 1. Initialize SSS-1 Stablecoin
```
$ sss-token init --preset sss-1 --name "Demo USD" --symbol DUSD
✓ Stablecoin initialized
  Mint: DemoToken1111...
  State: DemoState111111...
```

### 2. Grant Minter Role
```
$ sss-token roles grant-minter 7RDzYmYfq... --quota 1000000
✓ Minter role granted
  Quota: 1,000,000 tokens
```

### 3. Mint Tokens
```
$ sss-token mint 7RDzYmYfq... 500000
✓ Minted 500,000 tokens
  Signature: 5PSnerYeMja...
```

### 4. Enable SSS-2 Compliance
```
$ sss-token config --enable-transfer-hook
✓ SSS-2 features enabled
  Transfer Hook: Active
  Permanent Delegate: Configured
```

### 5. Blacklist Bad Actor
```
$ sss-token blacklist add BadActor... "Suspicious activity"
✓ Address blacklisted
  Reason: Suspicious activity
```

### 6. Emergency Pause & Seize
```
$ sss-token pause
✓ All operations paused

$ sss-token seize BadActor... --to Treasury...
✓ Assets seized
  Recovered: 50,000 tokens
```

## Full Demo Script

See `scripts/demo.sh` for the complete demonstration script.
