use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_interface::{Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount};
use spl_token_2022::state::Mint as Token2022Mint;
use spl_token_2022::extension::{ExtensionType, StateWithExtensions};

// === ACCOUNT STRUCTURES ===

#[account]
pub struct StablecoinState {
    pub authority: Pubkey,           // Master authority
    pub mint: Pubkey,                // Token mint
    pub name: String,                // Token name
    pub symbol: String,              // Token symbol
    pub decimals: u8,                // Token decimals
    pub total_supply: u64,           // Current supply
    pub is_paused: bool,             // Emergency pause
    pub features: u8,                // Feature flags
    pub supply_cap: u64,             // Maximum supply (0 = unlimited)
    pub epoch_quota: u64,            // Per-epoch mint limit
    pub current_epoch_minted: u64,   // This epoch minted amount
    pub current_epoch_start: i64,    // Epoch start timestamp
    pub bump: u8,                    // PDA bump
}

#[account]
pub struct RoleAccount {
    pub owner: Pubkey,               // Role holder
    pub roles: u8,                   // Bitmask of roles
    pub stablecoin: Pubkey,          // Associated stablecoin
    pub bump: u8,                    // PDA bump
}

#[account]
pub struct MinterInfo {
    pub minter: Pubkey,              // Minter address
    pub quota: u64,                  // Max mint amount
    pub minted: u64,                 // Already minted
    pub stablecoin: Pubkey,          // Associated stablecoin
    pub bump: u8,                    // PDA bump
}

// === ROLE CONSTANTS ===
pub const ROLE_MASTER: u8 = 1;      // Full control
pub const ROLE_MINTER: u8 = 2;      // Can mint
pub const ROLE_BURNER: u8 = 4;      // Can burn
pub const ROLE_PAUSER: u8 = 8;     // Can pause/unpause
pub const ROLE_BLACKLISTER: u8 = 16; // Can manage blacklist
pub const ROLE_SEIZER: u8 = 32;     // Can seize tokens

// === ERROR CODES ===
#[error_code]
pub enum StablecoinError {
    #[msg("Unauthorized: Insufficient role permissions")]
    Unauthorized = 6000,
    #[msg("Contract is paused")]
    ContractPaused,
    #[msg("Invalid mint amount")]
    InvalidAmount,
    #[msg("Minter quota exceeded")]
    QuotaExceeded,
    #[msg("Role already assigned")]
    RoleAlreadyAssigned,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Compliance not enabled")]
    ComplianceNotEnabled,
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Supply cap exceeded")]
    SupplyCapExceeded,
    #[msg("Epoch quota exceeded")]
    EpochQuotaExceeded,
}

// === EVENTS ===
#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub timestamp: i64,
}

#[event]
pub struct TokensMinted {
    pub minter: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensBurned {
    pub burner: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AccountFrozen {
    pub pauser: Pubkey,
    pub account: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AccountThawed {
    pub pauser: Pubkey,
    pub account: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StablecoinPaused {
    pub pauser: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StablecoinUnpaused {
    pub pauser: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RolesUpdated {
    pub authority: Pubkey,
    pub target: Pubkey,
    pub new_roles: u8,
    pub timestamp: i64,
}

#[event]
pub struct MinterQuotaUpdated {
    pub authority: Pubkey,
    pub minter: Pubkey,
    pub new_quota: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferred {
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

// === PROGRAM ===
declare_id!("Token11111111111111111111111111111111111111"); // Placeholder

#[program]
pub mod sss_token {
    use super::*;

    // === INITIALIZE ===
    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        symbol: String,
        decimals: u8,
        enable_transfer_hook: bool,
        enable_permanent_delegate: bool,
    ) -> Result<()> {
        require!(name.len() <= 32, StablecoinError::InvalidAmount);
        require!(symbol.len() <= 10, StablecoinError::InvalidAmount);
        require!(!ctx.accounts.stablecoin_state.is_initialized(), StablecoinError::AlreadyInitialized);

        // Initialize stablecoin state
        let stablecoin = &mut ctx.accounts.stablecoin_state;
        stablecoin.authority = ctx.accounts.authority.key();
        stablecoin.mint = ctx.accounts.mint.key();
        stablecoin.name = name.clone();
        stablecoin.symbol = symbol.clone();
        stablecoin.decimals = decimals;
        stablecoin.total_supply = 0;
        stablecoin.is_paused = false;
        stablecoin.features = 0;
        stablecoin.supply_cap = 0;          // 0 = unlimited
        stablecoin.epoch_quota = 0;         // 0 = unlimited
        stablecoin.current_epoch_minted = 0;
        stablecoin.current_epoch_start = Clock::get()?.unix_timestamp;
        if enable_transfer_hook {
            stablecoin.features |= 1;
        }
        if enable_permanent_delegate {
            stablecoin.features |= 2;
        }
        stablecoin.bump = ctx.bumps.stablecoin_state;

        // Initialize master role for creator
        let master_role = &mut ctx.accounts.master_role;
        master_role.owner = ctx.accounts.authority.key();
        master_role.roles = ROLE_MASTER | ROLE_MINTER | ROLE_BURNER | ROLE_PAUSER | ROLE_BLACKLISTER | ROLE_SEIZER;
        master_role.stablecoin = stablecoin.key();
        master_role.bump = ctx.bumps.master_role;

        emit!(StablecoinInitialized {
            mint: ctx.accounts.mint.key(),
            authority: ctx.accounts.authority.key(),
            name,
            symbol,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === MINT ===
    pub fn mint(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        let stablecoin = &ctx.accounts.stablecoin_state;
        
        require!(!stablecoin.is_paused, StablecoinError::ContractPaused);
        require!(amount > 0, StablecoinError::InvalidAmount);
        
        // Check minter role
        let role_account = &ctx.accounts.minter_role;
        require!(
            role_account.roles & ROLE_MINTER != 0 || role_account.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );
        
        // Check quota if not master
        if role_account.roles & ROLE_MASTER == 0 {
            let minter_info = &ctx.accounts.minter_info;
            require!(
                minter_info.minted + amount <= minter_info.quota,
                StablecoinError::QuotaExceeded
            );
        }
        
        // Check supply cap
        let new_supply = stablecoin.total_supply + amount;
        if stablecoin.supply_cap > 0 {
            require!(new_supply <= stablecoin.supply_cap, StablecoinError::SupplyCapExceeded);
        }
        
        // Check epoch quota
        if stablecoin.epoch_quota > 0 {
            let current_time = Clock::get()?.unix_timestamp;
            let epoch_elapsed = current_time - stablecoin.current_epoch_start;
            
            // If epoch passed (24 hours = 86400 seconds), reset
            if epoch_elapsed >= 86400 {
                ctx.accounts.stablecoin_state.current_epoch_minted = 0;
                ctx.accounts.stablecoin_state.current_epoch_start = current_time;
            }
            
            require!(
                ctx.accounts.stablecoin_state.current_epoch_minted + amount <= stablecoin.epoch_quota,
                StablecoinError::EpochQuotaExceeded
            );
        }

        // CPI to mint tokens
        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[&[b"mint_authority", stablecoin.key().as_ref(), &[ctx.bumps.mint_authority]]],
            ),
            amount,
        )?;

        // Update state
        let stablecoin_mut = &mut ctx.accounts.stablecoin_state;
        stablecoin_mut.total_supply = stablecoin_mut.total_supply.checked_add(amount)
            .ok_or(StablecoinError::MathOverflow)?;

        // Update minter quota if applicable
        if role_account.roles & ROLE_MASTER == 0 {
            let minter_info = &mut ctx.accounts.minter_info;
            minter_info.minted = minter_info.minted.checked_add(amount)
                .ok_or(StablecoinError::MathOverflow)?;
        }
        
        // Update epoch minted
        stablecoin_mut.current_epoch_minted = stablecoin_mut.current_epoch_minted
            .checked_add(amount)
            .ok_or(StablecoinError::MathOverflow)?;

        emit!(TokensMinted {
            minter: ctx.accounts.minter.key(),
            recipient: ctx.accounts.recipient_account.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === BURN ===
    pub fn burn(
        ctx: Context<BurnTokens>,
        amount: u64,
    ) -> Result<()> {
        let stablecoin = &ctx.accounts.stablecoin_state;
        
        require!(!stablecoin.is_paused, StablecoinError::ContractPaused);
        require!(amount > 0, StablecoinError::InvalidAmount);
        
        // Check burner role or self-burn
        let is_burner = ctx.accounts.burner_role.roles & ROLE_BURNER != 0 
            || ctx.accounts.burner_role.roles & ROLE_MASTER != 0;
        let is_owner = ctx.accounts.token_account.owner == ctx.accounts.burner.key();
        require!(is_burner || is_owner, StablecoinError::Unauthorized);

        // CPI to burn tokens
        if is_burner {
            // Burner can burn from any account
            token_2022::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: ctx.accounts.token_account.to_account_info(),
                        authority: ctx.accounts.burn_authority.to_account_info(),
                    },
                    &[&[b"burn_authority", stablecoin.key().as_ref(), &[ctx.bumps.burn_authority]]],
                ),
                amount,
            )?;
        } else {
            // Owner burns their own tokens
            token_2022::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: ctx.accounts.token_account.to_account_info(),
                        authority: ctx.accounts.burner.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        // Update state
        let stablecoin_mut = &mut ctx.accounts.stablecoin_state;
        stablecoin_mut.total_supply = stablecoin_mut.total_supply.checked_sub(amount)
            .ok_or(StablecoinError::MathOverflow)?;

        emit!(TokensBurned {
            burner: ctx.accounts.burner.key(),
            owner: ctx.accounts.token_account.owner,
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === FREEZE ===
    pub fn freeze_account(ctx: Context<FreezeAccount>) -> Result<()> {
        let stablecoin = &ctx.accounts.stablecoin_state;
        
        require!(!stablecoin.is_paused, StablecoinError::ContractPaused);
        
        // Check pauser role
        require!(
            ctx.accounts.pauser_role.roles & ROLE_PAUSER != 0
            || ctx.accounts.pauser_role.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );

        // CPI to freeze account
        token_2022::freeze_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::FreezeAccount {
                    account: ctx.accounts.token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.freeze_authority.to_account_info(),
                },
                &[&[b"freeze_authority", stablecoin.key().as_ref(), &[ctx.bumps.freeze_authority]]],
            ),
        )?;

        emit!(AccountFrozen {
            pauser: ctx.accounts.pauser.key(),
            account: ctx.accounts.token_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === THAW ===
    pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
        let stablecoin = &ctx.accounts.stablecoin_state;
        
        // Check pauser role
        require!(
            ctx.accounts.pauser_role.roles & ROLE_PAUSER != 0
            || ctx.accounts.pauser_role.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );

        // CPI to thaw account
        token_2022::thaw_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::ThawAccount {
                    account: ctx.accounts.token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.freeze_authority.to_account_info(),
                },
                &[&[b"freeze_authority", stablecoin.key().as_ref(), &[ctx.bumps.freeze_authority]]],
            ),
        )?;

        emit!(AccountThawed {
            pauser: ctx.accounts.pauser.key(),
            account: ctx.accounts.token_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === PAUSE/UNPAUSE ===
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        let stablecoin = &mut ctx.accounts.stablecoin_state;
        
        // Check pauser role
        require!(
            ctx.accounts.pauser_role.roles & ROLE_PAUSER != 0
            || ctx.accounts.pauser_role.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );

        stablecoin.is_paused = paused;

        if paused {
            emit!(StablecoinPaused {
                pauser: ctx.accounts.pauser.key(),
                timestamp: Clock::get()?.unix_timestamp,
            });
        } else {
            emit!(StablecoinUnpaused {
                pauser: ctx.accounts.pauser.key(),
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        Ok(())
    }

    // === ROLE MANAGEMENT ===
    pub fn update_roles(
        ctx: Context<UpdateRoles>,
        new_roles: u8,
    ) -> Result<()> {
        // Check master role
        require!(
            ctx.accounts.authority_role.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );

        let role_account = &mut ctx.accounts.target_role;
        role_account.roles = new_roles;

        emit!(RolesUpdated {
            authority: ctx.accounts.authority.key(),
            target: ctx.accounts.target.key(),
            new_roles,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === MINTER QUOTA ===
    pub fn update_minter_quota(
        ctx: Context<UpdateMinterQuota>,
        new_quota: u64,
    ) -> Result<()> {
        // Check master role
        require!(
            ctx.accounts.authority_role.roles & ROLE_MASTER != 0,
            StablecoinError::Unauthorized
        );

        let minter_info = &mut ctx.accounts.minter_info;
        minter_info.quota = new_quota;

        emit!(MinterQuotaUpdated {
            authority: ctx.accounts.authority.key(),
            minter: ctx.accounts.minter.key(),
            new_quota,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === TRANSFER AUTHORITY ===
    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        let stablecoin = &mut ctx.accounts.stablecoin_state;
        
        // Only current authority can transfer
        require!(
            ctx.accounts.authority.key() == stablecoin.authority,
            StablecoinError::InvalidAuthority
        );

        let previous_authority = stablecoin.authority;
        stablecoin.authority = ctx.accounts.new_authority.key();

        emit!(AuthorityTransferred {
            previous_authority,
            new_authority: ctx.accounts.new_authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// === ACCOUNT STRUCTURES FOR INSTRUCTIONS ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 200,
        seeds = [b"stablecoin", mint.key().as_ref()],
        bump
    )]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 100,
        seeds = [b"role", authority.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub master_role: Account<'info, RoleAccount>,
    
    #[account(mut)]
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", minter.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = minter_role.bump,
    )]
    pub minter_role: Account<'info, RoleAccount>,
    
    #[account(
        mut,
        seeds = [b"minter", minter.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = minter_info.bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,
    
    #[account(mut)]
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    #[account(mut)]
    pub recipient_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    /// CHECK: PDA used as mint authority
    #[account(
        seeds = [b"mint_authority", stablecoin_state.key().as_ref()],
        bump
    )]
    pub mint_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", burner.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = burner_role.bump,
    )]
    pub burner_role: Account<'info, RoleAccount>,
    
    #[account(mut)]
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    /// CHECK: PDA used as burn authority (for burner role)
    #[account(
        seeds = [b"burn_authority", stablecoin_state.key().as_ref()],
        bump
    )]
    pub burn_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    pub pauser: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", pauser.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = pauser_role.bump,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
    
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    /// CHECK: PDA used as freeze authority
    #[account(
        seeds = [b"freeze_authority", stablecoin_state.key().as_ref()],
        bump
    )]
    pub freeze_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ThawAccount<'info> {
    pub pauser: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", pauser.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = pauser_role.bump,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
    
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    /// CHECK: PDA used as freeze authority
    #[account(
        seeds = [b"freeze_authority", stablecoin_state.key().as_ref()],
        bump
    )]
    pub freeze_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub pauser: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", pauser.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = pauser_role.bump,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
}

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", authority.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = authority_role.bump,
    )]
    pub authority_role: Account<'info, RoleAccount>,
    
    /// CHECK: Target account to update roles for
    pub target: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 100,
        seeds = [b"role", target.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump
    )]
    pub target_role: Account<'info, RoleAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMinterQuota<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", authority.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = authority_role.bump,
    )]
    pub authority_role: Account<'info, RoleAccount>,
    
    /// CHECK: Minter account
    pub minter: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 100,
        seeds = [b"minter", minter.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump
    )]
    pub minter_info: Account<'info, MinterInfo>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    /// CHECK: New authority account
    pub new_authority: AccountInfo<'info>,
}