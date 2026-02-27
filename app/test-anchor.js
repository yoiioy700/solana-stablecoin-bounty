const anchor = require("@coral-xyz/anchor");
const web3 = require("@solana/web3.js");
const fs = require("fs");

const PROGRAM_ID = new web3.PublicKey(
  "FSkkSmrThcLpU9Uybrn4xcpbQKswUJn7KvoUQBsLPExD"
);
const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

// Load wallet
const wallet = web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync("/root/.config/solana/id.json", "utf-8"))
  )
);

const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(wallet),
  {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  }
);

// Manual IDL with correct structure
const IDL = {
  version: "0.1.0",
  name: "sss2_hook",
  address: PROGRAM_ID.toString(),
  metadata: { address: PROGRAM_ID.toString() },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 238, 208, 100, 126, 101, 92, 182],
      accounts: [
        { name: "config", writable: true, signer: false },
        { name: "authority", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "transferFeeBasisPoints", type: "u16" },
        { name: "maxTransferFee", type: "u64" },
      ],
    },
    {
      name: "updateFeeConfig",
      discriminator: [45, 49, 77, 130, 115, 11, 207, 30],
      accounts: [
        { name: "config", writable: true },
        { name: "authority", signer: true },
      ],
      args: [
        { name: "transferFeeBasisPoints", type: "u16" },
        { name: "maxTransferFee", type: "u64" },
        { name: "minTransferAmount", type: "u64" },
      ],
    },
    {
      name: "setPaused",
      discriminator: [0, 213, 148, 193, 112, 117, 163, 213],
      accounts: [
        { name: "config", writable: true },
        { name: "authority", signer: true },
      ],
      args: [{ name: "paused", type: "bool" }],
    },
  ],
  accounts: [
    {
      name: "TransferHookConfig",
      discriminator: [155, 183, 32, 238, 143, 244, 198, 221],
    },
  ],
  types: [
    {
      name: "TransferHookConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "transferFeeBasisPoints", type: "u16" },
          { name: "maxTransferFee", type: "u64" },
          { name: "minTransferAmount", type: "u64" },
          { name: "totalFeesCollected", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "isPaused", type: "bool" },
          { name: "permanentDelegate", type: { option: "pubkey" } },
          { name: "blacklistEnabled", type: "bool" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "FeeTooHigh", msg: "Fee amount too high (max 10%)" },
    { code: 6001, name: "InvalidAuthority", msg: "Invalid authority" },
    { code: 6002, name: "AmountTooLow", msg: "Transfer amount too low" },
    { code: 6003, name: "ContractPaused", msg: "Contract is paused" },
    { code: 6004, name: "AddressBlacklisted", msg: "Address is blacklisted" },
  ],
};

const program = new anchor.Program(IDL, PROGRAM_ID, provider);

async function testInitialize() {
  console.log("\n🧪 TEST 1: Initialize");
  console.log("Program:", PROGRAM_ID.toString());
  console.log("Authority:", wallet.publicKey.toString());

  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log("Config PDA:", configPda.toString());

  try {
    const tx = await program.methods
      .initialize(100, new anchor.BN(1000000000))
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Initialize TX:", tx);
    console.log(
      "Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet"
    );
    return { success: true, tx, configPda: configPda.toString() };
  } catch (e) {
    const msg = e.toString();
    if (msg.includes("custom program error: 0x0")) {
      console.log("⚠️ Already initialized (AccountAlreadyInitialized)");
      return { success: true, exists: true, configPda: configPda.toString() };
    }
    console.error("❌ Error:", e.message);
    console.error(e);
    return { success: false, error: e.message };
  }
}

async function testUpdateFee(configPda) {
  console.log("\n🧪 TEST 2: Update Fee Config");

  try {
    const tx = await program.methods
      .updateFeeConfig(200, new anchor.BN(2000000000), new anchor.BN(500))
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Update Fee TX:", tx);
    console.log(
      "Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet"
    );
    return { success: true, tx };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testTogglePause(configPda) {
  console.log("\n🧪 TEST 3: Toggle Pause");

  try {
    const tx = await program.methods
      .setPaused(true)
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Pause TX:", tx);
    console.log(
      "Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet"
    );

    const tx2 = await program.methods
      .setPaused(false)
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Unpause TX:", tx2);
    console.log(
      "Explorer: https://explorer.solana.com/tx/" + tx2 + "?cluster=devnet"
    );

    return { success: true, pauseTx: tx, unpauseTx: tx2 };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testFetchConfig(configPda) {
  console.log("\n🧪 TEST 4: Fetch Config");

  try {
    const config = await program.account.transferHookConfig.fetch(configPda);
    console.log("✅ Config fetched:");
    console.log("  Authority:", config.authority.toString());
    console.log("  Fee Basis Points:", config.transferFeeBasisPoints);
    console.log("  Max Fee:", config.maxTransferFee.toString());
    console.log("  Min Transfer:", config.minTransferAmount.toString());
    console.log("  Is Paused:", config.isPaused);
    console.log("  Blacklist Enabled:", config.blacklistEnabled);
    console.log(
      "  Permanent Delegate:",
      config.permanentDelegate?.toString() || "None"
    );
    return { success: true, config };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("SSS-2 Transfer Hook - Devnet Testing");
  console.log("═══════════════════════════════════════════");

  const results = {};

  const init = await testInitialize();
  results.initialize = init;

  if (init.success) {
    const configPda = new web3.PublicKey(init.configPda);

    results.updateFee = await testUpdateFee(configPda);
    results.togglePause = await testTogglePause(configPda);
    results.fetchConfig = await testFetchConfig(configPda);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("TEST RESULTS");
  console.log("═══════════════════════════════════════════");

  const passed = Object.values(results).filter((r) => r.success).length;
  const total = Object.keys(results).length;
  console.log(`Passed: ${passed}/${total}`);

  console.log("\n📋 TRANSACTION HASHES:");
  if (results.initialize?.tx) console.log("Initialize:", results.initialize.tx);
  if (results.updateFee?.tx) console.log("UpdateFee:", results.updateFee.tx);
  if (results.togglePause?.pauseTx)
    console.log("Pause:", results.togglePause.pauseTx);
  if (results.togglePause?.unpauseTx)
    console.log("Unpause:", results.togglePause.unpauseTx);

  fs.writeFileSync(
    "/root/sss2-transfer-hook/sss2_hook/app/test-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\n✅ Results saved to test-results.json");

  return results;
}

main()
  .then((r) => {
    console.log("\n✅ All tests complete!");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ Test failed:", e);
    process.exit(1);
  });
