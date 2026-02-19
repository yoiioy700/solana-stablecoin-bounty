/**
 * SSS-3 (Private Stablecoin) Preset
 * 
 * Confidential transfers with privacy-preserving compliance
 * Layer 3 of the Solana Stablecoin Standard
 * 
 * Features:
 * - Token-2022 Confidential Transfer extension
 * - Bulletproofs for range proofs
 * - ElGamal encryption for balances
 * - Allowlist-based access control
 * - Optional auditor for regulatory compliance
 * 
 * @module @stbr/sss-token/privacy
 */

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * SSS-3 Preset Configuration
 * 
 * SSS-3 = SSS-2 + Confidential Transfers + Privacy
 * This is the most advanced tier of the Solana Stablecoin Standard
 */
export const SSS3_PRESET = {
  /** Preset name */
  name: 'SSS-3 Private Stablecoin',
  
  /** Preset identifier */
  preset: 'sss-3',
  
  /** Standard decimals */
  decimals: 6,
  
  /** 
   * Enable confidential transfers
   * This is the defining feature of SSS-3
   */
  enableConfidentialTransfers: true,
  
  /**
   * Maximum confidential balance per account (0 = unlimited)
   * Set this for regulatory compliance limits
   */
  maxConfidentialBalance: new BN(0), // No limit by default
  
  /**
   * Require addresses to be on allowlist for confidential transfers
   * Recommended: true for regulated stablecoins
   */
  requireAllowlist: false,
  
  /**
   * Enable transfer fees (inherited from SSS-2)
   * Applied even to confidential transfers
   */
  enableTransferFees: true,
  transferFeeBasisPoints: 100, // 1%
  maxTransferFee: new BN(100000000), // 100 tokens
  
  /**
   * Enable permanent delegate
   * Required for asset seizure even in confidential mode
   */
  enablePermanentDelegate: true,
  
  /**
   * Enable blacklist (inherited from SSS-2)
   * Blocks both public and confidential transfers
   */
  enableBlacklist: true,
  
  /**
   * Optional auditor configuration
   * For regulatory compliance with privacy preservation
   * 
   * Auditor can decrypt transaction amounts but NOT balances
   */
  auditor: {
    enabled: false,
    pubkey: null as PublicKey | null,
  },
  
  /**
   * Range proof configuration
   * Bulletproof settings for ZK proofs
   */
  rangeProof: {
    /** Minimum transfer amount (0 = unlimited) */
    minAmount: new BN(1),
    /** Maximum transfer amount (0 = unlimited) */
    maxAmount: new BN(0),
    /** Bits for range proof (32 or 64) */
    bitSize: 32 as 32 | 64,
  },
  
  /**
   * Confidential transfer timeout
   * Maximum time for confidential transfer validity (in seconds)
   * 0 = no timeout
   */
  transferTimeoutSeconds: 0,
} as const;

/**
 * SSS-3 High Privacy Preset
 * Maximum privacy with strict access control
 */
export const SSS3_HIGH_PRIVACY_PRESET = {
  ...SSS3_PRESET,
  name: 'SSS-3 High Privacy',
  preset: 'sss-3-high',
  requireAllowlist: true,
  maxConfidentialBalance: new BN(1000000000000), // 1 million tokens
  auditor: {
    enabled: true,
    pubkey: null as PublicKey | null, // Must be set during initialization
  },
} as const;

/**
 * SSS-3 Regulatory Compliant Preset
 * Privacy with regulatory oversight
 */
export const SSS3_COMPLIANT_PRESET = {
  ...SSS3_PRESET,
  name: 'SSS-3 Compliant',
  preset: 'sss-3-compliant',
  requireAllowlist: true,
  transferFeeBasisPoints: 200, // 2%
  maxTransferFee: new BN(500000000), // 500 tokens
  rangeProof: {
    minAmount: new BN(1000000), // Minimum 1 token
    maxAmount: new BN(1000000000000), // Maximum 1 million tokens
    bitSize: 64 as 32 | 64,
  },
  auditor: {
    enabled: true,
    pubkey: null as PublicKey | null,
  },
} as const;

/**
 * Create SSS-3 initialization parameters
 * 
 * @param name Token name
 * @param symbol Token symbol
 * @param authority Authority public key
 * @param presetVariant Which preset variant to use
 * @returns Initialization parameters
 */
export function createSSS3Params(
  name: string,
  symbol: string,
  authority: PublicKey,
  presetVariant: 'default' | 'high-privacy' | 'compliant' = 'default'
): {
  name: string;
  symbol: string;
  decimals: number;
  authority: PublicKey;
  enableConfidentialTransfers: boolean;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  requireAllowlist: boolean;
  maxConfidentialBalance: BN;
  transferFeeBasisPoints: number;
  maxTransferFee: BN;
  enableBlacklist: boolean;
} {
  const base = presetVariant === 'high-privacy' 
    ? SSS3_HIGH_PRIVACY_PRESET
    : presetVariant === 'compliant'
    ? SSS3_COMPLIANT_PRESET
    : SSS3_PRESET;
  
  return {
    name,
    symbol,
    decimals: base.decimals,
    authority,
    enableConfidentialTransfers: base.enableConfidentialTransfers,
    enablePermanentDelegate: base.enablePermanentDelegate,
    enableTransferHook: base.enableTransferFees,
    requireAllowlist: base.requireAllowlist,
    maxConfidentialBalance: base.maxConfidentialBalance,
    transferFeeBasisPoints: base.transferFeeBasisPoints,
    maxTransferFee: base.maxTransferFee,
    enableBlacklist: base.enableBlacklist,
  };
}

/**
 * Check if a stablecoin has SSS-3 features
 * 
 * @param features Feature flags bitmask
 * @returns true if SSS-3 (confidential transfers) enabled
 */
export function isSSS3(features: number): boolean {
  // Bit 4 = Confidential transfers
  return (features & 16) !== 0;
}

/**
 * Encode SSS-3 features to bitmask
 * 
 * @returns Feature bitmask for SSS-3
 */
export function encodeSSS3Features(): number {
  // SSS-1 bits (1-3) + SSS-2 bits (4-15) + SSS-3 bit (16)
  let features = 0;
  features |= 1;   // Transfer hook
  features |= 2;   // Permanent delegate
  features |= 4;   // Mint close authority
  features |= 8;   // Default account state
  features |= 16;  // Confidential transfers (SSS-3)
  return features;
}

/**
 * Decode SSS-3 features to human-readable list
 * 
 * @param features Feature flags
 * @returns Array of enabled features
 */
export function decodeSSS3Features(features: number): string[] {
  const featureNames: string[] = [];
  
  if (features & 1) featureNames.push('Transfer Hook (SSS-2)');
  if (features & 2) featureNames.push('Permanent Delegate (SSS-2)');
  if (features & 4) featureNames.push('Mint Close Authority');
  if (features & 8) featureNames.push('Default Account State');
  if (features & 16) featureNames.push('Confidential Transfers (SSS-3)');
  if (features & 32) featureNames.push('Auditor Enabled');
  if (features & 64) featureNames.push('Allowlist Required');
  
  return featureNames;
}

/**
 * SSS-3 Feature descriptions for documentation
 */
export const SSS3_FEATURE_DESCRIPTIONS: Record<number, string> = {
  16: 'Confidential transfers using Token-2022 with ElGamal encryption',
  32: 'Auditor with decryption capability for regulatory compliance',
  64: 'Allowlist enforcement for confidential transfers',
};

/**
 * Validate SSS-3 parameters
 * 
 * @param params Parameters to validate
 * @returns Validation result
 */
export function validateSSS3Params(params: {
  maxConfidentialBalance?: BN;
  transferFeeBasisPoints?: number;
  requireAllowlist?: boolean;
  auditorPubkey?: PublicKey | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check transfer fee
  if (params.transferFeeBasisPoints !== undefined) {
    if (params.transferFeeBasisPoints > 10000) {
      errors.push('Transfer fee basis points must be <= 10000 (100%)');
    }
  }
  
  // Check auditor configuration
  if (params.auditorPubkey !== undefined && params.auditorPubkey !== null) {
    if (params.auditorPubkey.toString().length !== 44) {
      errors.push('Invalid auditor public key');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * SSS-3 initialization flow steps
 * Order matters for dependency
 */
export const SSS3_INIT_STEPS = [
  '1. Initialize base stablecoin (SSS-1)',
  '2. Configure transfer hook (SSS-2)',
  '3. Enable confidential transfers (SSS-3)',
  '4. Create range proof verifier',
  '5. Set auditor (optional)',
  '6. Configure allowlist',
  '7. Create confidential accounts',
] as const;

export default SSS3_PRESET;
