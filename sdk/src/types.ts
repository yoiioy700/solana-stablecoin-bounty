import { Connection, PublicKey, Keypair, TransactionInstruction, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Program IDs
export const SSS_TOKEN_PROGRAM_ID = new PublicKey('Token11111111111111111111111111111111111111');
export const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey('Hook111111111111111111111111111111111111111');

// Role constants
export const ROLE_MASTER = 1;
export const ROLE_MINTER = 2;
export const ROLE_BURNER = 4;
export const ROLE_PAUSER = 8;
export const ROLE_BLACKLISTER = 16;
export const ROLE_SEIZER = 32;

// Types
export interface StablecoinState {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: BN;
  isPaused: boolean;
  features: number;
}

export interface RoleAccount {
  owner: PublicKey;
  roles: number;
  stablecoin: PublicKey;
}

export interface MinterInfo {
  minter: PublicKey;
  quota: BN;
  minted: BN;
  stablecoin: PublicKey;
}

export interface SDKResult<T = any> {
  success: boolean;
  signature?: string;
  data?: T;
  error?: string;
}

// Events
export interface StablecoinInitialized {
  mint: PublicKey;
  authority: PublicKey;
  name: string;
  symbol: string;
  timestamp: BN;
}

export interface TokensMinted {
  minter: PublicKey;
  recipient: PublicKey;
  amount: BN;
  timestamp: BN;
}

export interface TokensBurned {
  burner: PublicKey;
  owner: PublicKey;
  amount: BN;
  timestamp: BN;
}

export interface RolesUpdated {
  authority: PublicKey;
  target: PublicKey;
  newRoles: number;
  timestamp: BN;
}
