/**
 * Solana Stablecoin Standard (SSS) SDK
 * 
 * @module @ssb/sss-sdk
 * @description TypeScript SDK for managing SSS-1 (minimal), SSS-2 (compliant), and SSS-3 (private) stablecoins on Solana
 * 
 * @example
 * ```typescript
 * import { SolanaStablecoin, PrivacyModule, SSS3_PRESET } from '@ssb/sss-sdk';
 * 
 * const sdk = new SolanaStablecoin(connection, wallet);
 * const privacy = new PrivacyModule(connection);
 * 
 * // Initialize SSS-3 private stablecoin
 * const result = await sdk.initialize({
 *   name: 'Private USD',
 *   symbol: 'PUSD',
 *   decimals: 6,
 *   authority: keypair,
 *   ...SSS3_PRESET,
 * });
 * ```
 */

// Core SDK
export { SolanaStablecoin } from './SolanaStablecoin';

// SSS-3 Privacy Module
export { PrivacyModule, generateElGamalKeypair } from './PrivacyModule';

// SSS-3 Presets
export {
  SSS3_PRESET,
  SSS3_HIGH_PRIVACY_PRESET,
  SSS3_COMPLIANT_PRESET,
  createSSS3Params,
  isSSS3,
  encodeSSS3Features,
  decodeSSS3Features,
  SSS3_FEATURE_DESCRIPTIONS,
  validateSSS3Params,
  SSS3_INIT_STEPS,
} from './sss3';

// Types
export {
  // Program IDs
  SSS_TOKEN_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  
  // Roles
  ROLE_MASTER,
  ROLE_MINTER,
  ROLE_BURNER,
  ROLE_PAUSER,
  ROLE_BLACKLISTER,
  ROLE_SEIZER,
  ROLE_NAMES,
  
  // Features
  FEATURE_TRANSFER_HOOK,
  FEATURE_PERMANENT_DELEGATE,
  FEATURE_MINT_CLOSE_AUTHORITY,
  FEATURE_DEFAULT_ACCOUNT_STATE,
  
  // State types
  StablecoinState,
  RoleAccount,
  MinterInfo,
  MultisigConfig,
  MultisigProposal,
  
  // SDK result
  SDKResult,
  
  // Events
  StablecoinInitialized,
  TokensMinted,
  TokensBurned,
  AccountFrozen,
  AccountThawed,
  StablecoinPaused,
  StablecoinUnpaused,
  RolesUpdated,
  MinterQuotaUpdated,
  AuthorityTransferred,
  BatchMinted,
  MultisigProposalCreated,
  MultisigProposalApproved,
  MultisigProposalExecuted,
  
  // SSS-2 Types
  SSS2HookConfig,
  BlacklistEntry,
  WhitelistEntry,
  WhitelistType,
  FeeCalculation,
  TransferExecuted,
  TokensSeized,
  BlacklistAdded,
  BlacklistRemoved,
  ConfigUpdated,
  BatchBlacklistAdded,
  
  // SSS-3 Types
  ConfidentialAccount,
  AllowlistEntry,
  RangeProof,
  ElGamalPubkey,
  
  // Errors
  StablecoinError,
  TransferHookError,
  decodeError,
  
  // Helpers
  calculateFee,
  hasRole,
  getFeatureString,
  formatAmount,
  parseAmount,
} from './types';

// Utils
export {
  // PDA helpers
  getStablecoinPDA,
  getMintPDA,
  getRolePDA,
  getMinterPDA,
  getMultisigConfigPDA,
  getProposalPDA,
  getMintAuthorityPDA,
  getBurnAuthorityPDA,
  getFreezeAuthorityPDA,
  getHookConfigPDA,
  getBlacklistPDA,
  getWhitelistPDA,
  
  // SSS-3 PDA helpers
  getConfidentialityConfigPDA,
  getConfidentialAccountPDA,
  getElGamalRegistryPDA,
  getRangeProofVerifierPDA,
  
  // Validation
  validateName,
  validateSymbol,
  validateDecimals,
  validateBatch,
  
  // Role helpers
  hasRole,
  decodeRoles,
  encodeRoles,
  
  // Feature helpers
  hasFeature,
  decodeFeatures,
  isSSS2,
  isSSS3,
  
  // Calculations
  calculateFee,
  wouldExceedQuota,
  wouldExceedCap,
  
  // Formatting
  formatAmount,
  parseAmount,
  formatWithSymbol,
  
  // RPC helpers
  getTokenBalance,
  accountExists,
  getAccountOwner,
  
  // Error handling
  extractError,
  isAnchorError,
  isInsufficientFunds,
  isSlippageError,
  
  // Utils
  sleep,
  withRetry,
  
  // Time
  formatTimestamp,
  now,
  timeUntilEpochReset,
} from './utils';

// ============================================
// CONSTANTS
// ============================================

/** SDK Version */
export const VERSION = '0.2.0';

/** SDK Build Date */
export const BUILD_DATE = new Date('2025-02-25');

/** Default RPC Endpoint */
export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com';

/** Default Commitment Level */
export const DEFAULT_COMMITMENT = 'confirmed';

/** Default Max Batch Size */
export const MAX_BATCH_SIZE = 10;

/** Default Transaction Timeout (ms) */
export const TX_TIMEOUT = 30000;

/** Default Retry Count */
export const DEFAULT_RETRIES = 3;

/** Default Retry Delay (ms) */
export const DEFAULT_RETRY_DELAY = 1000;

// ============================================
// TYPE ALIASES (for convenience)
// ============================================

/** Alias for RoleAccount */
export type Role = RoleAccount;

/** Alias for StablecoinState */
export type Stablecoin = StablecoinState;

/** Alias for SSS2HookConfig */
export type HookConfig = SSS2HookConfig;

/** Alias for ConfidentialAccount */
export type PrivateAccount = ConfidentialAccount;

// ============================================
// PRESETS
// ============================================

/** SSS-1 Minimal preset configuration */
export const SSS1_PRESET = {
  enableTransferHook: false,
  enablePermanentDelegate: false,
  decimals: 6,
} as const;

/** SSS-2 Compliant preset configuration */
export const SSS2_PRESET = {
  enableTransferHook: true,
  enablePermanentDelegate: true,
  decimals: 6,
  transferFeeBasisPoints: 100, // 1%
  maxTransferFee: 100000, // 0.1 token
  minTransferAmount: 1000, // 0.001 token
} as const;

/** SSS-2 High Compliance preset (stricter settings) */
export const SSS2_HIGH_COMPLIANCE_PRESET = {
  enableTransferHook: true,
  enablePermanentDelegate: true,
  decimals: 6,
  transferFeeBasisPoints: 200, // 2%
  maxTransferFee: 500000, // 0.5 token
  minTransferAmount: 10000, // 0.01 token
} as const;

/** SSS-3 Private preset (confidential transfers) */
export const SSS3_PRIVATE_PRESET = {
  ...SSS2_PRESET,
  enableConfidentialTransfers: true,
  requireAllowlist: false,
  maxConfidentialBalance: 0, // Unlimited
} as const;

// ============================================
// QUICK START
// ============================================

/**
 * Quick start preset for new developers
 * 
 * @example
 * ```typescript
 * import { quickStart } from '@ssb/sss-sdk';
 * 
 * const { initSSS1, initSSS2, initSSS3, privacy } = quickStart(connection, wallet);
 * 
 * // Initialize SSS-3 private stablecoin
 * const result = await initSSS3('Private USD', 'PUSD');
 * ```
 */
export function quickStart(connection: any, wallet: any) {
  const { SolanaStablecoin } = require('./SolanaStablecoin');
  const { PrivacyModule } = require('./PrivacyModule');
  const { SSS3_PRESET } = require('./sss3');
  
  const sdk = new SolanaStablecoin(connection, wallet);
  const privacy = new PrivacyModule(connection, wallet);
  
  return {
    sdk,
    privacy,
    
    /** Initialize SSS-1 stablecoin */
    initSSS1: async (name: string, symbol: string, decimals: number = 6) => {
      return await sdk.initialize({
        name,
        symbol,
        decimals,
        authority: (wallet as any).payer,
        ...SSS1_PRESET,
      });
    },
    
    /** Initialize SSS-2 stablecoin */
    initSSS2: async (name: string, symbol: string, decimals: number = 6) => {
      return await sdk.initialize({
        name,
        symbol,
        decimals,
        authority: (wallet as any).payer,
        ...SSS2_PRESET,
      });
    },
    
    /** Initialize SSS-3 private stablecoin */
    initSSS3: async (name: string, symbol: string, decimals: number = 6) => {
      return await sdk.initialize({
        name,
        symbol,
        decimals,
        authority: (wallet as any).payer,
        ...SSS3_PRESET,
      });
    },
    
    /** Mint tokens */
    mint: sdk.mint.bind(sdk),
    
    /** Burn tokens */
    burn: sdk.burn.bind(sdk),
    
    /** Freeze account */
    freeze: sdk.freeze.bind(sdk),
    
    /** Thaw account */
    thaw: sdk.thaw.bind(sdk),
    
    /** Pause contract */
    pause: sdk.pause.bind(sdk),
    
    /** Unpause contract */
    unpause: sdk.unpause.bind(sdk),
    
    /** Get state */
    getState: sdk.getState.bind(sdk),
    
    /** Get role */
    getRole: sdk.getRole.bind(sdk),
    
    /** Create confidential account */
    createConfidentialAccount: privacy.createConfidentialAccount.bind(privacy),
    
    /** Confidential transfer */
    confidentialTransfer: privacy.confidentialTransfer.bind(privacy),
    
    /** Deposit to confidential */
    depositToConfidential: privacy.depositToConfidential.bind(privacy),
    
    /** Withdraw from confidential */
    withdrawFromConfidential: privacy.withdrawFromConfidential.bind(privacy),
  };
}

// ============================================
// SUPPORTED NETWORKS
// ============================================

export const NETWORKS = {
  /** Local validator */
  LOCALNET: 'http://127.0.0.1:8899',
  
  /** Solana Devnet */
  DEVNET: 'https://api.devnet.solana.com',
  
  /** Solana Mainnet */
  MAINNET: 'https://api.mainnet-beta.solana.com',
  
  /** QuickNode Devnet (example) */
  QUICKNODE_DEVNET: 'https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  
  /** Helius Devnet */
  HELIUS_DEVNET: 'https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  
  /** Helius Mainnet */
  HELIUS_MAINNET: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
} as const;

// ============================================
// EXPLORER URLS
// ============================================

export const EXPLORERS = {
  /** SolanaFM */
  SOLANAFM: {
    devnet: (address: string) => `https://solana.fm/address/${address}?cluster=devnet-solana`,
    mainnet: (address: string) => `https://solana.fm/address/${address}`,
  },
  
  /** Solscan */
  SOLSCAN: {
    devnet: (address: string) => `https://solscan.io/account/${address}?cluster=devnet`,
    mainnet: (address: string) => `https://solscan.io/account/${address}`,
  },
  
  /** Explorer.solana.com */
  EXPLORER: {
    devnet: (address: string) => `https://explorer.solana.com/address/${address}?cluster=devnet`,
    mainnet: (address: string) => `https://explorer.solana.com/address/${address}`,
  },
};

// ============================================
// MIGRATION
// ============================================

/**
 * Check if SDK needs to migrate from older version
 */
export function needsMigration(version: string): boolean {
  // For now, no migrations needed
  return false;
}

/**
 * Get migration guide URL
 */
export function getMigrationGuide(): string {
  return 'https://github.com/solanabr/solana-stablecoin-standard/blob/main/SDK_MIGRATION.md';
}
