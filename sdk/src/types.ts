import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// ==================== PRESETS ====================

export enum Presets {
  SSS_1 = 'sss-1',  // Basic RBAC stablecoin
  SSS_2 = 'sss-2',  // Transfer hook with fees
  SSS_3 = 'sss-3',  // Advanced governance
}

// ==================== SOLANA STABLECOIN CONFIG ====================

export interface StablecoinConfig {
  preset: Presets;
  name?: string;
  symbol?: string;
  decimals?: number;
  mintAuthority?: PublicKey;
  freezeAuthority?: PublicKey;
}

export interface SSS2HookConfig {
  transferFeeBasisPoints: number;  // Fee in basis points (100 = 1%)
  maxTransferFee: BN;              // Maximum fee cap in lamports
  minTransferAmount?: BN;          // Minimum transfer amount
  blackListEnabled?: boolean;        // Enable blacklist enforcement
}

export interface CreateStablecoinOptions {
  preset: Presets;
  name: string;
  symbol: string;
  decimals: number;
  mintAuthority: PublicKey;
  freezeAuthority?: PublicKey;
  // SSS-2 specific
  hookConfig?: SSS2HookConfig;
}

// ==================== MINT / BURN ====================

export interface MintOptions {
  recipient: PublicKey;
  amount: BN;
  authority?: PublicKey;
}

export interface BurnOptions {
  amount: BN;
  authority?: PublicKey;
}

// ==================== FREEZE / THAW ====================

export interface FreezeOptions {
  account: PublicKey;
}

export interface ThawOptions {
  account: PublicKey;
}

// ==================== WHITELIST / BLACKLIST ====================

export interface WhitelistOptions {
  address: PublicKey;
}

export interface BlacklistOptions {
  address: PublicKey;
}

// ==================== PERMANENT DELEGATE ====================

export interface PermanentDelegateOptions {
  delegate?: PublicKey;  // undefined to clear
}

// ==================== SDK RESULTS ====================

export interface SDKResult<T = TransactionSignature> {
  success: boolean;
  signature?: T;
  error?: string;
  data?: any;
}

export interface StablecoinInfo {
  mint: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: BN;
  isFrozen: boolean;
  // SSS-2 specific
  hookProgramId?: PublicKey;
  hookConfig?: any;
}

export interface FeeCalculation {
  amount: BN;
  fee: BN;
  netAmount: BN;
  rateBps: number;
}
