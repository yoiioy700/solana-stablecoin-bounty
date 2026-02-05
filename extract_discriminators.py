#!/usr/bin/env python3
"""
Extract instruction discriminators from SSS-2 hook program
Using sha256("global:<instruction_name>")[:8]
"""
import hashlib

def get_discriminator(name):
    """Get Anchor 8-byte discriminator for instruction"""
    full_name = f"global:{name}"
    return list(hashlib.sha256(full_name.encode()).digest()[:8])

instructions = [
    "initialize",
    "executeTransferHook",
    "updateFeeConfig",
    "addWhitelist",
    "removeWhitelist",
    "addBlacklist",
    "removeBlacklist",
    "setPermanentDelegate",
    "setBlacklistEnabled",
    "setPaused",
    "closeConfig"
]

print("SSS-2 Hook Instruction Discriminators:")
print("=" * 50)
for ix in instructions:
    disc = get_discriminator(ix)
    print(f"{ix:25s}: {disc}")
