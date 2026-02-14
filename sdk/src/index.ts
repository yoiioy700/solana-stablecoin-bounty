/**
 * Solana Stablecoin Standard (SSS) SDK
 * 
 * @module @ssb/sss-sdk
 * @description TypeScript SDK for managing SSS-1 (minimal) and SSS-2 (compliant) stablecoins on Solana
 * 
 * @example
 * ```typescript
 * import { SolanaStablecoin, getStablecoinPDA, ROLE_MASTER } from '@ssb/sss-sdk';
 * 
 * const sdk = new SolanaStablecoin(connection, wallet);
 * 
 * // Initialize SSS-1 stablecoin
 * const result = await sdk.initialize({
 *   name: 'Test USD',
 *   symbol: 'TUSD',
 *   decimals: 6,
 *   authority: keypair,
 * });
 * 
 * if (result.success) {
 *   console.log(`Mint created: ${result.data?.mint}`);
 * }
 * ```
 */

// Core SDK
export { SolanaStablecoin } from './SolanaStablecoin';

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
export const VERSION = '0.1.0';

/** SDK Build Date */
export const BUILD_DATE = new Date('2025-02-24');

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
 * const { initSSS1, initSSS2 } = quickStart(connection, wallet);
 * 
 * // Initialize SSS-1
 * const result = await initSSS1('My Token', 'MYT');
 * ```
 */
export function quickStart(connection: any, wallet: any) {
  const { SolanaStablecoin } = require('./SolanaStablecoin');
  const sdk = new SolanaStablecoin(connection, wallet);
  
  return {
    sdk,
    
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
