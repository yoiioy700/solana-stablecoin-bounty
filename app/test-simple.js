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

// Instruction discriminators (from sha256("global:instruction_name")[:8])
const DISCRIMINATORS = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  update_fee_config: [104, 184, 103, 242, 88, 151, 107, 20],
  set_paused: [91, 60, 125, 192, 176, 225, 166, 218],
};

function createInstruction(name, accounts, args) {
  const data = Buffer.concat([Buffer.from(DISCRIMINATORS[name]), ...args]);
  return new web3.TransactionInstruction({
    keys: accounts,
    programId: PROGRAM_ID,
    data,
  });
}

async function sendTransaction(instructions) {
  const tx = new web3.Transaction().add(...instructions);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  tx.sign(wallet);
  const rawTx = tx.serialize();
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log("TX:", signature);
  console.log(
    "Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet"
  );

  await connection.confirmTransaction(signature, "confirmed");
  console.log("✅ Confirmed");
  return signature;
}

async function testInitialize() {
  console.log("\n�️ TEST 1: Initialize");

  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // Args: fee_bps (u16 LE) + max_fee (u64 LE)
  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(100, 0); // 1%

  const maxFee = Buffer.alloc(8);
  maxFee.writeBigUInt64LE(BigInt(1000000000), 0); // 1 SOL

  const ix = createInstruction(
    "initialize",
    [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    [feeBps, maxFee]
  );

  try {
    const sig = await sendTransaction([ix]);
    return { success: true, sig, configPda: configPda.toString() };
  } catch (e) {
    if (e.toString().includes("0x0")) {
      console.log("⚠️ Already initialized");
      return { success: true, exists: true, configPda: configPda.toString() };
    }
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testUpdateFee(configPda) {
  console.log("\n🧪 TEST 2: Update Fee Config");

  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(200, 0); // 2%

  const maxFee = Buffer.alloc(8);
  maxFee.writeBigUInt64LE(BigInt(2000000000), 0); // 2 SOL

  const minTransfer = Buffer.alloc(8);
  minTransfer.writeBigUInt64LE(BigInt(500), 0); // 500 lamports

  const ix = createInstruction(
    "update_fee_config",
    [
      {
        pubkey: new web3.PublicKey(configPda),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    [feeBps, maxFee, minTransfer]
  );

  try {
    const sig = await sendTransaction([ix]);
    return { success: true, sig };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testPause(configPda, paused) {
  console.log("\n🧪 TEST:", paused ? "Pause" : "Unpause");

  const pausedBuf = Buffer.alloc(1);
  pausedBuf.writeUInt8(paused ? 1 : 0, 0);

  const ix = createInstruction(
    "set_paused",
    [
      {
        pubkey: new web3.PublicKey(configPda),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    [pausedBuf]
  );

  try {
    const sig = await sendTransaction([ix]);
    return { success: true, sig };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("SSS-2 Transfer Hook - Devnet Testing");
  console.log("═══════════════════════════════════════════");
  console.log("Program:", PROGRAM_ID.toString());
  console.log("Authority:", wallet.publicKey.toString());

  const results = [];

  // Test 1: Initialize
  const init = await testInitialize();
  results.push({ name: "Initialize", ...init });

  if (init.success) {
    // Test 2: Update Fee
    const update = await testUpdateFee(init.configPda);
    results.push({ name: "UpdateFee", ...update });

    // Test 3: Pause
    const pause = await testPause(init.configPda, true);
    results.push({ name: "Pause", ...pause });

    // Test 4: Unpause
    const unpause = await testPause(init.configPda, false);
    results.push({ name: "Unpause", ...unpause });
  }

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("TEST RESULTS");
  console.log("═══════════════════════════════════════════");

  const passed = results.filter((r) => r.success).length;
  console.log(`Passed: ${passed}/${results.length}`);

  console.log("\n📋 TRANSACTION HASHES:");
  results.forEach((r) => {
    if (r.sig) console.log(`${r.name}: ${r.sig}`);
  });

  fs.writeFileSync(
    "/root/sss2-transfer-hook/sss2_hook/app/test-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\n✅ Results saved to test-results.json");
}

main().catch(console.error);
