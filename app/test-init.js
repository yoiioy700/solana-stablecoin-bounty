const anchor = require("@coral-xyz/anchor");
const web3 = require("@solana/web3.js");
const fs = require("fs");

const PROGRAM_ID = "FSkkSmrThcLpU9Uybrn4xcpbQKswUJn7KvoUQBsLPExD";
const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

// Load wallet
const keypairData = JSON.parse(
  fs.readFileSync("/root/.config/solana/id.json", "utf-8")
);
const wallet = web3.Keypair.fromSecretKey(Uint8Array.from(keypairData));

const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(wallet),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

// Minimal IDL for instructions
const IDL = {
  version: "0.1.0",
  name: "sss2_hook",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "config", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "transferFeeBasisPoints", type: "u16" },
        { name: "maxTransferFee", type: "u64" },
      ],
    },
  ],
  accounts: {
    transferHookConfig: {
      fields: [
        { name: "authority", type: "publicKey" },
        { name: "transferFeeBasisPoints", type: "u16" },
        { name: "maxTransferFee", type: "u64" },
      ],
    },
  },
};

async function testInitialize() {
  console.log("🧪 TEST: Initialize SSS-2 Transfer Hook");
  console.log("Program ID:", PROGRAM_ID);
  console.log("Authority:", wallet.publicKey.toString());

  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  // Derive config PDA
  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config"), wallet.publicKey.toBuffer()],
    new web3.PublicKey(PROGRAM_ID)
  );

  console.log("Config PDA:", configPda.toString());

  try {
    const tx = await program.methods
      .initialize(100, new anchor.BN(1000000000)) // 1% fee, 1 SOL max
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
    if (e.toString().includes("already in use")) {
      console.log("⚠️ Already initialized, using existing config");
      return {
        success: true,
        tx: null,
        configPda: configPda.toString(),
        exists: true,
      };
    }
    console.error("❌ Error:", e.message);
    return { success: false, error: e.message };
  }
}

testInitialize().then(console.log).catch(console.error);
