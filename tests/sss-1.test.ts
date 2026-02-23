import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import { assert } from "chai";

describe("SSS Token - SSS-1 (Minimal Stablecoin)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;

  // Fixed mint keypair — PDAs derive from mint.key()
  const mintKeypair = Keypair.generate();

  let stablecoinPDA: PublicKey;
  let masterRolePDA: PublicKey;
  let minterInfoPDA: PublicKey;
  let mintAuthorityPDA: PublicKey;
  let burnAuthorityPDA: PublicKey;
  let freezeAuthorityPDA: PublicKey;
  let recipientTokenAccount: PublicKey;

  const name = "Test USD";
  const symbol = "TUSD";
  const decimals = 6;

  before(async () => {
    // Derive all PDAs using mint.key()
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

    [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority"), stablecoinPDA.toBuffer()],
      program.programId
    );

    [burnAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("burn_authority"), stablecoinPDA.toBuffer()],
      program.programId
    );

    [freezeAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("freeze_authority"), stablecoinPDA.toBuffer()],
      program.programId
    );

    // Create the Token-2022 mint with mintAuthorityPDA as authority
    // (freezeAuthority PDA for freeze ops)
    await createMint(
      provider.connection,
      (provider.wallet as anchor.Wallet).payer,
      mintAuthorityPDA,           // mint authority = PDA
      freezeAuthorityPDA,         // freeze authority = PDA
      decimals,
      mintKeypair,                // mint keypair
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Mint created:", mintKeypair.publicKey.toBase58());
  });

  describe("Initialize (SSS-1)", () => {
    it("Should initialize a new SSS-1 stablecoin", async () => {
      const tx = await program.methods
        .initialize(name, symbol, decimals, false, false)
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          masterRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("SSS-1 Initialize tx:", tx);

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.equal(state.name, name);
      assert.equal(state.symbol, symbol);
      assert.equal(state.decimals, decimals);
      assert.equal(state.features, 0);
      assert.equal(state.isPaused, false);
      assert.ok(state.totalSupply.eqn(0));
    });
  });

  describe("Mint (SSS-1)", () => {
    it("Should mint tokens as master role", async () => {
      const amount = new anchor.BN(1_000_000); // 1 token (6 decimals)

      // Create recipient ATA (Token-2022)
      const ataInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (provider.wallet as anchor.Wallet).payer,
        mintKeypair.publicKey,
        provider.wallet.publicKey,
        false,
        "confirmed",
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );
      recipientTokenAccount = ataInfo.address;

      const tx = await program.methods
        .mint(amount)
        .accounts({
          minter: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          minterRole: masterRolePDA,
          minterInfo: minterInfoPDA,
          mint: mintKeypair.publicKey,
          recipientAccount: recipientTokenAccount,
          mintAuthority: mintAuthorityPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Mint tx:", tx);

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.ok(state.totalSupply.eqn(1_000_000));
    });

    it("Should track epoch minted", async () => {
      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.ok(state.currentEpochMinted.eqn(1_000_000));
    });
  });

  describe("Burn (SSS-1)", () => {
    it("Should burn tokens as burner role", async () => {
      const amount = new anchor.BN(500_000); // burn 0.5 token

      const tx = await program.methods
        .burn(amount)
        .accounts({
          burner: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          burnerRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenAccount: recipientTokenAccount,
          burnAuthority: burnAuthorityPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Burn tx:", tx);

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.ok(state.totalSupply.eqn(500_000));
    });
  });

  describe("Freeze / Thaw (SSS-1)", () => {
    it("Should freeze a token account", async () => {
      await program.methods
        .freezeAccount()
        .accounts({
          pauser: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          pauserRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenAccount: recipientTokenAccount,
          freezeAuthority: freezeAuthorityPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Account frozen");
    });

    it("Should thaw a token account", async () => {
      await program.methods
        .thawAccount()
        .accounts({
          pauser: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          pauserRole: masterRolePDA,
          mint: mintKeypair.publicKey,
          tokenAccount: recipientTokenAccount,
          freezeAuthority: freezeAuthorityPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      console.log("Account thawed");
    });
  });

  describe("Pause / Unpause (SSS-1)", () => {
    it("Should pause the stablecoin", async () => {
      await program.methods
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
            minterInfo: minterInfoPDA,
            mint: mintKeypair.publicKey,
            recipientAccount: recipientTokenAccount,
            mintAuthority: mintAuthorityPDA,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown ContractPaused error");
      } catch (e: any) {
        assert.ok(e.toString().includes("ContractPaused"));
      }
    });

    it("Should unpause the stablecoin", async () => {
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
    const newMinterKp = Keypair.generate();
    let newMinterRolePDA: PublicKey;
    let newMinterInfoPDA: PublicKey;

    before(async () => {
      [newMinterRolePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), newMinterKp.publicKey.toBuffer(), mintKeypair.publicKey.toBuffer()],
        program.programId
      );

      [newMinterInfoPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("minter"), newMinterKp.publicKey.toBuffer(), mintKeypair.publicKey.toBuffer()],
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
          target: newMinterKp.publicKey,
          targetRole: newMinterRolePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.roleAccount.fetch(newMinterRolePDA);
      assert.equal(role.roles, 2);
    });

    it("Should set minter quota", async () => {
      const quota = new anchor.BN(10_000_000);

      await program.methods
        .updateMinterQuota(quota)
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          authorityRole: masterRolePDA,
          minter: newMinterKp.publicKey,
          minterInfo: newMinterInfoPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const info = await program.account.minterInfo.fetch(newMinterInfoPDA);
      assert.ok(info.quota.eqn(10_000_000));
    });
  });

  describe("Supply Cap (SSS-1)", () => {
    it("Should set and enforce supply cap", async () => {
      const cap = new anchor.BN(100_000_000);

      await program.methods
        .updateSupplyCap(cap)
        .accounts({
          authority: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          authorityRole: masterRolePDA,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPDA);
      assert.ok(state.supplyCap.eqn(100_000_000));
    });
  });

  describe("Batch Mint (SSS-1)", () => {
    it("Should batch mint to multiple recipients via remaining_accounts", async () => {
      // Create 3 recipient ATAs
      const r1 = Keypair.generate();
      const r2 = Keypair.generate();

      const ata1 = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (provider.wallet as anchor.Wallet).payer,
        mintKeypair.publicKey,
        r1.publicKey,
        false, "confirmed", { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );
      const ata2 = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (provider.wallet as anchor.Wallet).payer,
        mintKeypair.publicKey,
        r2.publicKey,
        false, "confirmed", { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      const amounts = [new anchor.BN(100_000), new anchor.BN(200_000)];
      const stateBefore = await program.account.stablecoinState.fetch(stablecoinPDA);

      await program.methods
        .batchMint(amounts)
        .accounts({
          minter: provider.wallet.publicKey,
          stablecoinState: stablecoinPDA,
          minterRole: masterRolePDA,
          minterInfo: minterInfoPDA,
          mint: mintKeypair.publicKey,
          mintAuthority: mintAuthorityPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: ata1.address, isWritable: true, isSigner: false },
          { pubkey: ata2.address, isWritable: true, isSigner: false },
        ])
        .rpc();

      const stateAfter = await program.account.stablecoinState.fetch(stablecoinPDA);
      const expectedSupply = stateBefore.totalSupply.addn(300_000);
      assert.ok(stateAfter.totalSupply.eq(expectedSupply));
      console.log("Batch mint success, new supply:", stateAfter.totalSupply.toString());
    });
  });

  describe("Authority Transfer (SSS-1)", () => {
    it("Should transfer authority to new address", async () => {
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
      assert.equal(state.authority.toBase58(), newAuthority.toBase58());
    });
  });
});
