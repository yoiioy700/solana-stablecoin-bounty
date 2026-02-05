import {
  Connection,
  PublicKey,
  Keypair,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

import { SSS1Stablecoin } from './sss1';
import { SSS2Hook } from './sss2';
import type {
  Presets,
  CreateStablecoinOptions,
  SDKResult,
  StablecoinInfo,
  SSS2HookConfig,
  MintOptions,
  BurnOptions,
  FreezeOptions,
  ThawOptions,
  WhitelistOptions,
  BlacklistOptions,
  FeeCalculation,
} from './types';

export { Presets } from './types';
export { SSS1Stablecoin } from './sss1';
export { SSS2Hook, SSS2_PROGRAM_ID } from './sss2';
export type {
  CreateStablecoinOptions,
  SDKResult,
  StablecoinInfo,
  SSS2HookConfig,
  MintOptions,
  BurnOptions,
  FreezeOptions,
  ThawOptions,
  WhitelistOptions,
  BlacklistOptions,
  FeeCalculation,
} from './types';

/**
 * Main Solana Stablecoin SDK
 * Unified interface for SSS-1, SSS-2, and SSS-3 stablecoin standards
 */
export class SolanaStablecoin {
  private sss1?: SSS1Stablecoin;
  private sss2?: SSS2Hook;
  private preset: Presets;
  private connection: Connection;
  private payer: Keypair;

  constructor(connection: Connection, payer: Keypair, preset: Presets) {
    this.connection = connection;
    this.payer = payer;
    this.preset = preset;

    switch (preset) {
      case 'sss-1':
        this.sss1 = new SSS1Stablecoin(connection, payer);
        break;
      case 'sss-2':
        this.sss2 = new SSS2Hook(connection, payer);
        break;
      default:
        throw new Error(`Unknown preset: ${preset}`);
    }
  }

  /**
   * Factory method to create a stablecoin instance
   * @example
   * ```
   * const stable = await SolanaStablecoin.create(connection, {
   *   preset: Presets.SSS_2,
   *   name: 'My USD',
   *   symbol: 'mUSD',
   *   decimals: 6,
   *   mintAuthority: wallet.publicKey,
   * });
   * ```
   */
  static async create(
    connection: Connection,
    options: CreateStablecoinOptions
  ): Promise<SDKResult<SolanaStablecoin>> {
    try {
      const payer = options.mintAuthority as Keypair; // In real usage, use proper wallet
      const stable = new SolanaStablecoin(connection, payer, options.preset);

      // Initialize based on preset
      if (options.preset === 'sss-2' && options.hookConfig) {
        const init = await stable.sss2!.initialize(options.hookConfig);
        if (!init.success) {
          return { success: false, error: init.error };
        }
      }

      return { success: true, data: stable };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the preset type
   */
  getPreset(): Presets {
    return this.preset;
  }

  /**
   * Get the SSS-2 hook instance (if using SSS-2 preset)
   */
  getSSS2Hook(): SSS2Hook | undefined {
    return this.sss2;
  }

  /**
   * Get the SSS-1 instance (if using SSS-1 preset)
   */
  getSSS1(): SSS1Stablecoin | undefined {
    return this.sss1;
  }

  // ============== SSS-1 METHODS (if available) ==============

  /**
   * Mint tokens to a recipient (SSS-1)
   */
  async mint(options: MintOptions): Promise<SDKResult> {
    if (!this.sss1) {
      return { success: false, error: 'SSS-1 not initialized' };
    }
    return this.sss1.mint({
      recipient: options.recipient,
      amount: options.amount,
    });
  }

  /**
   * Burn tokens (SSS-1)
   */
  async burn(options: BurnOptions): Promise<SDKResult> {
    if (!this.sss1) {
      return { success: false, error: 'SSS-1 not initialized' };
    }
    return this.sss1.burn({ amount: options.amount });
  }

  /**
   * Freeze an account (SSS-1)
   */
  async freeze(options: FreezeOptions): Promise<SDKResult> {
    if (!this.sss1) {
      return { success: false, error: 'SSS-1 not initialized' };
    }
    return this.sss1.freeze({ account: options.account });
  }

  /**
   * Thaw (unfreeze) an account (SSS-1)
   */
  async thaw(options: ThawOptions): Promise<SDKResult> {
    if (!this.sss1) {
      return { success: false, error: 'SSS-1 not initialized' };
    }
    return this.sss1.thaw({ account: options.account });
  }
}

export default SolanaStablecoin;
