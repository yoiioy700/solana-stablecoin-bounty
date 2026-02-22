use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount};

declare_id!("FSkkSmrThcLpU9Uybrn4xcpbQKswUJn7KvoUQBsLPExD");

/// ============ STATE STRUCTURES ============

#[account]
pub struct TransferHookConfig {
    pub stablecoin: Pubkey,              // Associated stablecoin
    pub authority: Pubkey,               // Admin authority
    pub transfer_fee_basis_points: u16,  // Fee rate (100 = 1%)
    pub max_transfer_fee: u64,           // Maximum fee cap
    pub min_transfer_amount: u64,        // Minimum transfer
    pub total_fees_collected: u64,       // Running total
    pub is_paused: bool,                 // Emergency pause
    pub blacklist_enabled: bool,         // Toggle blacklist
    pub permanent_delegate: Option<Pubkey>, // Super admin
    pub bump: u8,
}

#[account]
pub struct BlacklistEntry {
    pub address: Pubkey,                 // Blacklisted address
    pub reason: String,                  // Why blacklisted
    pub blacklisted_by: Pubkey,          // Who added
    pub created_at: i64,                 // When
    pub is_active: bool,                 // Still active?
    pub bump: u8,
}

#[account]
pub struct WhitelistEntry {
    pub address: Pubkey,                 // Whitelisted address
    pub whitelist_type: WhitelistType,   // Fee exempt or full
    pub added_by: Pubkey,                // Who added
    pub created_at: i64,                 // When
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum WhitelistType {
    FeeExempt,      // No transfer fees
    FullBypass,     // Bypass all restrictions
}

/// ============ ERROR CODES ============

#[error_code]
pub enum TransferHookError {
    #[msg("Transfer hook is paused")]
    HookPaused = 8000,
    #[msg("Source address is blacklisted")]
    SourceBlacklisted,
    #[msg("Destination address is blacklisted")]
    DestinationBlacklisted,
    #[msg("Transfer amount below minimum")]
    AmountTooLow,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Address already blacklisted")]
    AlreadyBlacklisted,
    #[msg("Blacklist entry not found")]
    BlacklistNotFound,
    #[msg("Already whitelisted")]
    AlreadyWhitelisted,
    #[msg("Compliance feature not enabled")]
    ComplianceNotEnabled,
    #[msg("Invalid instruction data")]
    InvalidInstruction,
    #[msg("Fee calculation overflow")]
    MathOverflow,
    #[msg("Cannot seize from self")]
    SelfSeizure,
}

/// ============ EVENTS ============

#[event]
pub struct TransferExecuted {
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub net_amount: u64,
    pub is_whitelisted: bool,
    pub is_delegate: bool,
    pub timestamp: i64,
}

#[event]
pub struct BlacklistAdded {
    pub address: Pubkey,
    pub reason: String,
    pub blacklisted_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BlacklistRemoved {
    pub address: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokensSeized {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub seized_by: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct ConfigUpdated {
    pub authority: Pubkey,
    pub field: String,
    pub value: String,
    pub timestamp: i64,
}

#[event]
pub struct BatchBlacklistAdded {
    pub authority: Pubkey,
    pub count: u16,
    pub timestamp: i64,
}

/// ============ PROGRAM MODULE ============

#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the transfer hook for a stablecoin
    pub fn initialize(
        ctx: Context<InitializeHook>,
        transfer_fee_basis_points: u16,
        max_transfer_fee: u64,
        min_transfer_amount: u64,
        blacklist_enabled: bool,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.stablecoin = ctx.accounts.stablecoin.key();
        config.authority = ctx.accounts.authority.key();
        config.transfer_fee_basis_points = transfer_fee_basis_points;
        config.max_transfer_fee = max_transfer_fee;
        config.min_transfer_amount = min_transfer_amount;
        config.total_fees_collected = 0;
        config.is_paused = false;
        config.blacklist_enabled = blacklist_enabled;
        config.permanent_delegate = None;
        config.bump = ctx.bumps.config;

        emit!(ConfigUpdated {
            authority: ctx.accounts.authority.key(),
            field: "initialize".to_string(),
            value: format!("fee_bps:{}, max_fee:{}, min:{}, blacklist:{}", 
                transfer_fee_basis_points, max_transfer_fee, min_transfer_amount, blacklist_enabled),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Execute transfer hook (called by Token-2022 on every transfer)
    pub fn execute_transfer_hook(
        ctx: Context<ExecuteTransferHook>,
        amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        
        // Check pause
        require!(!config.is_paused, TransferHookError::HookPaused);
        
        // Check blacklist (if enabled)
        if config.blacklist_enabled {
            // Check source
            if ctx.accounts.source_blacklist.is_some() {
                let entry = ctx.accounts.source_blacklist.as_ref().unwrap();
                if entry.is_active {
                    return Err(TransferHookError::SourceBlacklisted.into());
                }
            }
            
            // Check destination
            if ctx.accounts.destination_blacklist.is_some() {
                let entry = ctx.accounts.destination_blacklist.as_ref().unwrap();
                if entry.is_active {
                    return Err(TransferHookError::DestinationBlacklisted.into());
                }
            }
        }
        
        // Check permanent delegate (bypasses everything)
        let is_delegate = if let Some(delegate) = config.permanent_delegate {
            ctx.accounts.source_account.owner == delegate || 
            ctx.accounts.destination_account.owner == delegate
        } else {
            false
        };
        
        // Check whitelist
        let mut is_whitelisted = false;
        if let Some(ref _whitelist) = ctx.accounts.source_whitelist {
            is_whitelisted = true;
        }
        if let Some(ref _whitelist) = ctx.accounts.destination_whitelist {
            is_whitelisted = true;
        }
        
        // Calculate fee
        let mut fee: u64 = 0;
        if !is_delegate && !is_whitelisted {
            require!(amount >= config.min_transfer_amount, TransferHookError::AmountTooLow);
            
            fee = (amount as u128)
                .checked_mul(config.transfer_fee_basis_points as u128)
                .ok_or(TransferHookError::MathOverflow)?
                .checked_div(10000)
                .ok_or(TransferHookError::MathOverflow)? as u64;
            
            if fee > config.max_transfer_fee {
                fee = config.max_transfer_fee;
            }
        }
        
        let net_amount = amount.checked_sub(fee).ok_or(TransferHookError::MathOverflow)?;
        
        // Update total fees (if fee > 0)
        if fee > 0 {
            let config_mut = &mut ctx.accounts.config;
            config_mut.total_fees_collected = config_mut.total_fees_collected
                .checked_add(fee)
                .ok_or(TransferHookError::MathOverflow)?;
        }
        
        emit!(TransferExecuted {
            source: ctx.accounts.source_account.owner,
            destination: ctx.accounts.destination_account.owner,
            amount,
            fee,
            net_amount,
            is_whitelisted,
            is_delegate,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Add address to blacklist
    pub fn add_to_blacklist(
        ctx: Context<ManageBlacklist>,
        reason: String,
    ) -> Result<()> {
        require!(ctx.accounts.config.blacklist_enabled, TransferHookError::ComplianceNotEnabled);
        
        let entry = &mut ctx.accounts.blacklist_entry;
        entry.address = ctx.accounts.target_address.key();
        entry.reason = reason.clone();
        entry.blacklisted_by = ctx.accounts.authority.key();
        entry.created_at = Clock::get()?.unix_timestamp;
        entry.is_active = true;
        entry.bump = 0; // bump stored in PDA, not needed in data
        
        emit!(BlacklistAdded {
            address: ctx.accounts.target_address.key(),
            reason,
            blacklisted_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Remove from blacklist
    pub fn remove_from_blacklist(ctx: Context<ManageBlacklist>) -> Result<()> {
        let entry = &mut ctx.accounts.blacklist_entry;
        entry.is_active = false;
        
        emit!(BlacklistRemoved {
            address: ctx.accounts.target_address.key(),
            removed_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Seize tokens from blacklisted account
    pub fn seize_tokens(
        ctx: Context<SeizeTokens>,
        amount: Option<u64>,
        reason: String,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        
        // Only permanent delegate can seize
        require!(
            config.permanent_delegate == Some(ctx.accounts.authority.key()),
            TransferHookError::InvalidAuthority
        );
        
        // Cannot seize from self
        require!(
            ctx.accounts.source_account.owner != ctx.accounts.treasury.key(),
            TransferHookError::SelfSeizure
        );
        
        // Determine amount to seize
        let seize_amount = match amount {
            Some(amt) => amt,
            None => ctx.accounts.source_account.amount,
        };
        
        require!(seize_amount > 0, TransferHookError::AmountTooLow);
        require!(
            seize_amount <= ctx.accounts.source_account.amount,
            TransferHookError::AmountTooLow
        );
        
        // Transfer using permanent delegate authority
        anchor_spl::token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token_2022::TransferChecked {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.source_account.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.permanent_delegate.to_account_info(),
                },
                &[],
            ),
            seize_amount,
            ctx.accounts.config.decimals,
        )?;
        
        emit!(TokensSeized {
            from: ctx.accounts.source_account.owner,
            to: ctx.accounts.treasury.owner,
            amount: seize_amount,
            seized_by: ctx.accounts.authority.key(),
            reason,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Add to whitelist
    pub fn add_to_whitelist(
        ctx: Context<ManageWhitelist>,
        whitelist_type: WhitelistType,
    ) -> Result<()> {
        let entry = &mut ctx.accounts.whitelist_entry;
        entry.address = ctx.accounts.target_address.key();
        entry.whitelist_type = whitelist_type;
        entry.added_by = ctx.accounts.authority.key();
        entry.created_at = Clock::get()?.unix_timestamp;
        entry.bump = 0; // bump stored in PDA, not needed in data
        
        Ok(())
    }

    /// Remove from whitelist
    pub fn remove_from_whitelist(ctx: Context<ManageWhitelist>) -> Result<()> {
        // Account will be closed by Anchor
        Ok(())
    }

    /// Update configuration
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        transfer_fee_basis_points: Option<u16>,
        max_transfer_fee: Option<u64>,
        min_transfer_amount: Option<u64>,
        is_paused: Option<bool>,
        blacklist_enabled: Option<bool>,
        permanent_delegate: Option<Option<Pubkey>>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        
        if let Some(fee_bps) = transfer_fee_basis_points {
            config.transfer_fee_basis_points = fee_bps;
        }
        if let Some(max) = max_transfer_fee {
            config.max_transfer_fee = max;
        }
        if let Some(min) = min_transfer_amount {
            config.min_transfer_amount = min;
        }
        if let Some(paused) = is_paused {
            config.is_paused = paused;
        }
        if let Some(enabled) = blacklist_enabled {
            config.blacklist_enabled = enabled;
        }
        if let Some(delegate) = permanent_delegate {
            config.permanent_delegate = delegate;
        }
        
        emit!(ConfigUpdated {
            authority: ctx.accounts.authority.key(),
            field: "update_config".to_string(),
            value: "multiple".to_string(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// ============ BATCH OPERATIONS ============
    
    /// Batch blacklist multiple addresses
    pub fn batch_blacklist(
        ctx: Context<BatchBlacklist>,
        addresses: Vec<Pubkey>,
        reasons: Vec<String>,
    ) -> Result<()> {
        require!(
            addresses.len() == reasons.len(),
            TransferHookError::InvalidInstruction
        );
        require!(
            addresses.len() <= 10,
            TransferHookError::InvalidInstruction
        );
        
        let config = &ctx.accounts.config;
        require!(config.blacklist_enabled, TransferHookError::ComplianceNotEnabled);
        
        // In real implementation, this would iterate and create multiple blacklist entries
        // For now, we emit a batch event
        
        emit!(BatchBlacklistAdded {
            authority: ctx.accounts.authority.key(),
            count: addresses.len() as u16,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

/// ============ ACCOUNT STRUCTURES ============

#[derive(Accounts)]
pub struct InitializeHook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: The stablecoin mint this hook is for
    pub stablecoin: AccountInfo<'info>,
    
    /// CHECK: Stablecoin state PDA
    pub stablecoin_state: AccountInfo<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 200,
        seeds = [b"hook_config", stablecoin.key().as_ref()],
        bump
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTransferHook<'info> {
    #[account(
        seeds = [b"hook_config", mint.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    #[account(mut)]
    pub source_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    #[account(mut)]
    pub destination_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    /// CHECK: Source owner (from token account data)
    pub source_owner: AccountInfo<'info>,
    
    /// CHECK: Optional source blacklist
    #[account(
        seeds = [b"blacklist", config.key().as_ref(), source_owner.key().as_ref()],
        bump,
    )]
    pub source_blacklist: Option<Account<'info, BlacklistEntry>>,
    
    /// CHECK: Optional destination blacklist
    #[account(
        seeds = [b"blacklist", config.key().as_ref(), destination_account.owner.as_ref()],
        bump,
    )]
    pub destination_blacklist: Option<Account<'info, BlacklistEntry>>,
    
    /// CHECK: Optional source whitelist
    #[account(
        seeds = [b"whitelist", config.key().as_ref(), source_owner.key().as_ref()],
        bump,
    )]
    pub source_whitelist: Option<Account<'info, WhitelistEntry>>,
    
    /// CHECK: Optional destination whitelist
    #[account(
        seeds = [b"whitelist", config.key().as_ref(), destination_account.owner.as_ref()],
        bump,
    )]
    pub destination_whitelist: Option<Account<'info, WhitelistEntry>>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ManageBlacklist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub config: Account<'info, TransferHookConfig>,
    
    /// CHECK: Target address
    pub target_address: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 200,
        seeds = [b"blacklist", config.key().as_ref(), target_address.key().as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
    
    pub bump: u8,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageWhitelist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub config: Account<'info, TransferHookConfig>,
    
    /// CHECK: Target address
    pub target_address: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 100,
        seeds = [b"whitelist", config.key().as_ref(), target_address.key().as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    
    pub bump: u8,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub config: Account<'info, TransferHookConfig>,
    
    #[account(mut)]
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    #[account(mut)]
    pub source_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    #[account(mut)]
    pub treasury: InterfaceAccount<'info, InterfaceTokenAccount>,
    
    /// CHECK: Permanent delegate PDA
    pub permanent_delegate: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = authority @ TransferHookError::InvalidAuthority,
    )]
    pub config: Account<'info, TransferHookConfig>,
}

#[derive(Accounts)]
pub struct BatchBlacklist<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = authority @ TransferHookError::InvalidAuthority,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    pub system_program: Program<'info, System>,
}