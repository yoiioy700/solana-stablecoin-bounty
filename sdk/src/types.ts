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


// Multisig Types
export interface MultisigConfig {
  stablecoin: PublicKey;
  threshold: number;
  signers: PublicKey[];
}

export interface MultisigProposal {
  config: PublicKey;
  proposer: PublicKey;
  instructionData: Buffer;
  approvals: PublicKey[];
  executed: boolean;
  createdAt: BN;
  expiresAt: BN;
}

// Multisig Events
export interface MultisigProposalCreated {
  proposal: PublicKey;
  proposer: PublicKey;
  timestamp: BN;
}

export interface MultisigProposalApproved {
  proposal: PublicKey;
  approver: PublicKey;
  approvals: number;
  threshold: number;
  timestamp: BN;
}

export interface MultisigProposalExecuted {
  proposal: PublicKey;
  executor: PublicKey;
  timestamp: BN;
}

// Batch Operations
export interface BatchMinted {
  minter: PublicKey;
  recipients: number;
  totalAmount: BN;
  timestamp: BN;
}


// SSS1 Types
export interface StablecoinInfo {
  mint: PublicKey;
  authority?: PublicKey;
  totalSupply: BN;
  isPaused?: boolean;
  decimals: number;
  name?: string;
  symbol?: string;
  isFrozen?: boolean;
}

// SSS2 Types
export interface SSS2HookConfig {
  stablecoin: PublicKey;
  authority: PublicKey;
  transferFeeBasisPoints: number;
  maxTransferFee: BN;
  minTransferAmount: BN;
  isPaused: boolean;
  blacklistEnabled: boolean;
}

export interface FeeCalculation {
  fee: BN;
  netAmount: BN;
  rateBps: number;
  basisPoints?: number;
  amount?: BN;
}
