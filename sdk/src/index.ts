// SSS Token SDK - @stbr/sss-token
// Complete SDK for Solana Stablecoin Standards

// Core modules
export { SolanaStablecoin } from './SolanaStablecoin';
export { ComplianceModule } from './ComplianceModule';
export { RoleManager } from './RoleManager';
export { MultisigModule } from './MultisigModule';

// Types
export {
  // Constants
  SSS_TOKEN_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  ROLE_MASTER,
  ROLE_MINTER,
  ROLE_BURNER,
  ROLE_PAUSER,
  ROLE_BLACKLISTER,
  ROLE_SEIZER,
  
  // Interfaces
  StablecoinState,
  RoleAccount,
  MinterInfo,
  MultisigConfig,
  MultisigProposal,
  SDKResult,
  StablecoinInitialized,
  TokensMinted,
  TokensBurned,
  RolesUpdated,
  BatchMinted,
  MultisigProposalCreated,
  MultisigProposalApproved,
  MultisigProposalExecuted,
} from './types';

// Re-export commonly used types from web3.js
export { PublicKey, Keypair, Connection } from '@solana/web3.js';
export { BN } from '@coral-xyz/anchor';

/**
 * SDK Version
 */
export const VERSION = '0.1.0';

/**
 * SDK Info
 */
export const SDK_INFO = {
  name: '@stbr/sss-token',
  version: VERSION,
  description: 'Solana Stablecoin Standards SDK (SSS-1 + SSS-2)',
  author: 'SolanaBR',
  license: 'MIT',
};
