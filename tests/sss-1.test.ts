import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
import { SssTransferHook } from "../target/types/sss_transfer_hook";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("SSS Token - SSS-1 (Minimal Stablecoin)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.SssToken as Program<SssToken>;
  
  let stablecoinPDA: PublicKey;
  let mintPDA: PublicKey;
  let masterRolePDA: PublicKey;
  let minterRolePDA: PublicKey;
  let burnerRolePDA: PublicKey;
  let recipientTokenAccount: PublicKey;
  
  const name = "Test USD";
  const symbol = "TUSD";
  const decimals = 6;
  
  before(async () => {
    // Derive PDAs
    [stablecoinPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    
    [mintPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), stablecoinPDA.toBuffer()],
      program.programId
    );
    
    [masterRolePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), provider.wallet.publicKey.toBuffer(), mintPDA.toBuffer()],
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
          mint: mintPDA,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
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
    
    it("Should fail if already initialized", async () => {
      try {
        await program.methods
          .initialize(name, symbol, decimals, false, false)
          .accounts({
            authority: provider.wallet.publicKey,
            stablecoinState: stablecoinPDA,
            masterRole: masterRolePDA,
            mint: mintPDA,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
        assert.ok(e.toString().includes("AlreadyInitialized"));
      }
    });
  });
  
  describe("Mint (SSS-1)", () => {
    it("Should mint tokens as master role", async () => {
      const amount = new anchor.BN(1000000); // 1 token with 6 decimals
      
      // Create recipient token account
      recipientTokenAccount = await anchor.utils.token.associatedAddress({
        mint: mintPDA,
        owner: provider.wallet.publicKey,
      });
      
      const tx = await program.methods
        .mint(amount)
        .accounts({
          minter: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          minterRole: masterRolePDA,
          mint: mintPDA,
          recipientAccount: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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
      
      const tx = await program.methods
        .burn(amount)
        .accounts({
          burner: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          burnerRole: masterRolePDA,
          mint: mintPDA,
          tokenAccount: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
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
      try {
        await program.methods
          .mint(new anchor.BN(1000))
          .accounts({
            minter: provider.wallet.publicKey,
            stablecoinState: stablecoinPDA,
            minterRole: masterRolePDA,
            mint: mintPDA,
            recipientAccount: recipientTokenAccount,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
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
    let minterInfoPDA: PublicKey;
    
    before(async () => {
      newMinter = anchor.web3.Keypair.generate().publicKey;
      
      [newMinterRolePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), newMinter.toBuffer(), mintPDA.toBuffer()],
        program.programId
      );
      
      [minterInfoPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("minter"), newMinter.toBuffer(), mintPDA.toBuffer()],
        program.programId
      );
    });
    
    it("Should assign minter role to new address", async () => {
      // First create the role account
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
          minterInfo: minterInfoPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      const info = await program.account.minterInfo.fetch(minterInfoPDA);
      assert.equal(info.quota.toNumber(), 10000000);
    });
  });
});
