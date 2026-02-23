import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

// Token-2022 program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

describe("SSS Token - SSS-1 (Minimal Stablecoin)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;

  // Using a generated mint keypair — PDAs derive from mint.key()
  const mintKeypair = Keypair.generate();

  let stablecoinPDA: PublicKey;
  let masterRolePDA: PublicKey;
  let minterInfoPDA: PublicKey;
  let recipientTokenAccount: PublicKey;

  const name = "Test USD";
  const symbol = "TUSD";
  const decimals = 6;

  before(async () => {
    // Derive PDAs using mint.key() as seeds (matching on-chain program)
    [stablecoinPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );

    [masterRolePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), provider.wallet.publicKey.toBuffer(), mintKeypair.publicKey.toBuffer()],
      program.programId
    );

    [minterInfoPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), provider.wallet.publicKey.toBuffer(), mintKeypair.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Initialize (SSS-1)", () => {
    it("Should initialize a new SSS-1 stablecoin", async () => {
      const tx = await program.methods
        .initialize(name, symbol, decimals, false, false) // SSS-1: no transfer hook, no permanent delegate
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          masterRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();

      console.log("SSS-1 Initialize tx:", tx);

      // Verify state
      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.name, name);
      assert.equal(state.symbol, symbol);
      assert.equal(state.decimals, decimals);
      assert.equal(state.features, 0); // SSS-1: no features enabled
      assert.equal(state.isPaused, false);
    });
  });

  describe("Mint (SSS-1)", () => {
    it("Should mint tokens as master role", async () => {
      const amount = new anchor.BN(1000000); // 1 token with 6 decimals

      // Get mint authority PDA
      const [mintAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority"), stablecoinPDA.toBuffer()],
        program.programId
      );

      // Create recipient token account (ATA for Token-2022)
      recipientTokenAccount = await anchor.utils.token.associatedAddress({
        mint: mintKeypair.publicKey,
        owner: provider.wallet.publicKey,
      });

      const tx = await program.methods
        .mint(amount)
        .accounts({
          minter: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          minterRole: masterRolePDA,
          minterInfo: minterInfoPDA,
          mint: mintKeypair.publicKey,
          recipientAccount: recipientTokenAccount,
          mintAuthority: mintAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Mint tx:", tx);

      // Verify supply
      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.totalSupply.toNumber(), 1000000);
    });

    it("Should update epoch quota after mint", async () => {
      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.currentEpochMinted.toNumber(), 1000000);
    });
  });

  describe("Burn (SSS-1)", () => {
    it("Should burn tokens as owner", async () => {
      const amount = new anchor.BN(500000); // Burn 0.5 token

      // Get burn authority PDA
      const [burnAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("burn_authority"), stablecoinPDA.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .burn(amount)
        .accounts({
          burner: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          burnerRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenAccount: recipientTokenAccount,
          burnAuthority: burnAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Burn tx:", tx);

      // Verify supply
      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.totalSupply.toNumber(), 500000);
    });
  });

  describe("Pause/Unpause (SSS-1)", () => {
    it("Should pause the contract", async () => {
      const tx = await program.methods
        .setPaused(true)
        .accounts({
          pauser: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          pauserRole: masterRolePDA,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.isPaused, true);
    });

    it("Should reject mint when paused", async () => {
      const [mintAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority"), stablecoinPDA.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .mint(new anchor.BN(1000))
          .accounts({
            minter: provider.wallet.publicKey,
            stablecoinState: stablecoinPDA,
            minterRole: masterRolePDA,
            minterInfo: minterInfoPDA,
            mint: mintKeypair.publicKey,
            recipientAccount: recipientTokenAccount,
            mintAuthority: mintAuthority,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e: any) {
        assert.ok(e.toString().includes("ContractPaused"));
      }
    });

    it("Should unpause the contract", async () => {
      await program.methods
        .setPaused(false)
        .accounts({
          pauser: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          pauserRole: masterRolePDA,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.isPaused, false);
    });
  });

  describe("Role Management (SSS-1)", () => {
    let newMinter: PublicKey;
    let newMinterRolePDA: PublicKey;
    let newMinterInfoPDA: PublicKey;

    before(async () => {
      newMinter = Keypair.generate().publicKey;

      [newMinterRolePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), newMinter.toBuffer(), mintKeypair.publicKey.toBuffer()],
        program.programId
      );

      [newMinterInfoPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("minter"), newMinter.toBuffer(), mintKeypair.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Should assign minter role to new address", async () => {
      await program.methods
        .updateRoles(2) // ROLE_MINTER = 2
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          authorityRole: masterRolePDA,
          target: newMinter,
          targetRole: newMinterRolePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.roleAccount.fetch(newMinterRolePDA);
      assert.equal(role.roles, 2);
    });

    it("Should set minter quota", async () => {
      const quota = new anchor.BN(10000000); // 10 tokens

      await program.methods
        .updateMinterQuota(quota)
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          authorityRole: masterRolePDA,
          minter: newMinter,
          minterInfo: newMinterInfoPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const info = await program.account.minterInfo.fetch(newMinterInfoPDA);
      assert.equal(info.quota.toNumber(), 10000000);
    });
  });

  describe("Supply Cap (SSS-1)", () => {
    it("Should set supply cap", async () => {
      const cap = new anchor.BN(100000000); // 100 tokens max

      await program.methods
        .updateSupplyCap(cap)
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          authorityRole: masterRolePDA,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.supplyCap.toNumber(), 100000000);
    });
  });

  describe("Authority Transfer (SSS-1)", () => {
    it("Should transfer authority", async () => {
      const newAuthority = Keypair.generate().publicKey;

      await program.methods
        .transferAuthority()
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          newAuthority: newAuthority,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.deepEqual(state.authority, newAuthority);
    });
  });
});
