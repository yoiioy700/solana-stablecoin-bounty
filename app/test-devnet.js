const web3 = require("@solana/web3.js");
const fs = require("fs");

const PROGRAM_ID = "FSkkSmrThcLpU9Uybrn4xcpbQKswUJn7KvoUQBsLPExD";
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

// Instruction discriminators
const INITIALIZE_DISCRIMINATOR = Buffer.from([
  175, 238, 208, 100, 126, 101, 92, 182,
]);
const ADD_WHITELIST_DISCRIMINATOR = Buffer.from([
  126, 180, 243, 103, 26, 78, 112, 20,
]);
const ADD_BLACKLIST_DISCRIMINATOR = Buffer.from([
  218, 149, 124, 58, 186, 75, 96, 80,
]);
const EXECUTE_HOOK_DISCRIMINATOR = Buffer.from([
  140, 169, 145, 79, 117, 92, 168, 239,
]);

async function sendTransaction(instructions, signers) {
  const tx = new web3.Transaction().add(...instructions);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  tx.sign(...signers, wallet);
  const signature = await connection.sendRawTransaction(tx.serialize());

  console.log("TX:", signature);
  console.log(
    "Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet"
  );

  await connection.confirmTransaction(signature, "confirmed");
  console.log("✅ Confirmed");
  return signature;
}

async function testInitialize() {
  console.log("\n🧪 TEST 1: Initialize");
  console.log("Program:", PROGRAM_ID);
  console.log("Authority:", wallet.publicKey.toString());

  // Derive config PDA
  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config"), wallet.publicKey.toBuffer()],
    new web3.PublicKey(PROGRAM_ID)
  );
  console.log("Config PDA:", configPda.toString());

  // Build data: discriminator + fee_bps (u16 LE) + max_fee (u64 LE)
  const feeBps = Buffer.alloc(2); // 100 = 1%
  feeBps.writeUInt16LE(100, 0);

  const maxFee = Buffer.alloc(8); // 1000000000 = 1 SOL
  maxFee.writeBigUInt64LE(BigInt(1000000000), 0);

  const data = Buffer.concat([INITIALIZE_DISCRIMINATOR, feeBps, maxFee]);

  const ix = new web3.TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: new web3.PublicKey(PROGRAM_ID),
    data,
  });

  try {
    const tx = await sendTransaction([ix], []);
    return { success: true, tx, configPda: configPda.toString() };
  } catch (e) {
    if (e.toString().includes("already in use")) {
      console.log("⚠️ Already initialized");
      return { success: true, exists: true, configPda: configPda.toString() };
    }
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testAddWhitelist(configPda) {
  console.log("\n🧪 TEST 2: Add Whitelist");

  const testAddress = new web3.PublicKey("11111111111111111111111111111111");
  const [whitelistPda] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("whitelist"),
      wallet.publicKey.toBuffer(),
      testAddress.toBuffer(),
    ],
    new web3.PublicKey(PROGRAM_ID)
  );

  console.log("Whitelist PDA:", whitelistPda.toString());

  const addressBytes = testAddress.toBuffer();
  const data = Buffer.concat([ADD_WHITELIST_DISCRIMINATOR, addressBytes]);

  const ix = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: new web3.PublicKey(configPda),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: whitelistPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: new web3.PublicKey(PROGRAM_ID),
    data,
  });

  try {
    const tx = await sendTransaction([ix], []);
    return { success: true, tx, whitelistPda: whitelistPda.toString() };
  } catch (e) {
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function testAddBlacklist(configPda) {
  console.log("\n🧪 TEST 3: Add Blacklist");

  const badActor = new web3.PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );
  const [blacklistPda] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("blacklist"),
      wallet.publicKey.toBuffer(),
      badActor.toBuffer(),
    ],
    new web3.PublicKey(PROGRAM_ID)
  );

  console.log("Blacklist PDA:", blacklistPda.toString());
  console.log("Bad Actor:", badActor.toString());

  const addressBytes = badActor.toBuffer();
  const data = Buffer.concat([ADD_BLACKLIST_DISCRIMINATOR, addressBytes]);

  const ix = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: new web3.PublicKey(configPda),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: blacklistPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: new web3.PublicKey(PROGRAM_ID),
    data,
  });

  try {
    const tx = await sendTransaction([ix], []);
    return { success: true, tx, blacklistPda: blacklistPda.toString() };
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

  // Test 1: Initialize
  const init = await testInitialize();
  results.initialize = init;

  if (init.success) {
    // Test 2: Add Whitelist
    const wl = await testAddWhitelist(init.configPda);
    results.whitelist = wl;

    // Test 3: Add Blacklist
    const bl = await testAddBlacklist(init.configPda);
    results.blacklist = bl;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("TEST RESULTS");
  console.log("═══════════════════════════════════════════");
  console.log(JSON.stringify(results, null, 2));

  // Save results
  fs.writeFileSync(
    "/root/sss2-transfer-hook/sss2_hook/app/test-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\n✅ Results saved to test-results.json");
}

main().catch(console.error);
