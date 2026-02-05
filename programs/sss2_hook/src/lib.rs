use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

// SSS-2 Transfer Hook Program
// Compatible with SPL Token-2022 transfer hook interface
// Features: Transfer fees, Whitelist, Blacklist, Permanent Delegate

declare_id!("FSkkSmrThcLpU9Uybrn4xcpbQKswUJn7KvoUQBsLPExD");

#[program]
pub mod sss2_hook {
    use super::*;

    /// Initialize the transfer hook with configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        transfer_fee_basis_points: u16,
        max_transfer_fee: u64,
    ) -> Result<()> {
        require!(
            transfer_fee_basis_points <= 1000,
            TransferHookError::FeeTooHigh
        );
        
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.transfer_fee_basis_points = transfer_fee_basis_points;
        config.max_transfer_fee = max_transfer_fee;
        config.total_fees_collected = 0;
        config.bump = ctx.bumps.config;
        config.is_paused = false;
        config.permanent_delegate = None;
        config.blacklist_enabled = true;
        
        msg!("Transfer hook initialized");
        msg!("Authority: {}", config.authority);
        msg!("Fee: {} basis points ({}%)", transfer_fee_basis_points, transfer_fee_basis_points as f64 / 100.0);
        msg!("Max fee: {}", max_transfer_fee);
        
        Ok(())
    }

    /// Execute hook - called on every token transfer via CPI
    pub fn execute_transfer_hook(
        ctx: Context<ExecuteTransfer>,
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.is_paused, TransferHookError::ContractPaused);
        
        let config = &ctx.accounts.config;
        let source = ctx.accounts.source.key();
        let destination = ctx.accounts.destination.key();
        
        // ============ BLACKLIST CHECK ============
        // Check if source or destination is blacklisted
        if config.blacklist_enabled {
            let blacklist_info = &ctx.accounts.blacklist;
            
            // Check source blacklist
            if !blacklist_info.data_is_empty() && blacklist_info.owner == &crate::ID {
                let blacklist_data = blacklist_info.data.borrow();
                if blacklist_data.len() >= 8 + BlacklistEntry::SIZE {
                    let discriminator = &blacklist_data[0..8];
                    if discriminator == BlacklistEntry::discriminator() {
                        let blacklist: BlacklistEntry = AnchorDeserialize::deserialize(
                            &mut &blacklist_data[8..]
                        ).map_err(|_| TransferHookError::InvalidAuthority)?;
                        
                        if blacklist.is_blacklisted {
                            msg!("BLACKLISTED: Source {} is blacklisted", source);
                            return Err(TransferHookError::AddressBlacklisted.into());
                        }
                    }
                }
            }
            
            // Check destination blacklist (via separate PDA in client)
            // This would need another account in the ix, keeping it simple for now
        }
        
        // ============ PERMANENT DELEGATE CHECK ============
        // If permanent delegate is set and matches, bypass all restrictions
        if let Some(delegate) = config.permanent_delegate {
            if source == delegate || destination == delegate {
                msg!("Permanent delegate transfer - bypassing all checks");
                emit!(TransferHookEvent {
                    source,
                    destination,
                    amount,
                    fee: 0,
                    is_delegate_transfer: true,
                    timestamp: Clock::get()?.unix_timestamp,
                });
                return Ok(());
            }
        }
        
        // ============ WHITELIST CHECK ============
        // Check if source is whitelisted (no fees)
        let whitelist_info = &ctx.accounts.whitelist;
        if !whitelist_info.data_is_empty() && whitelist_info.owner == &crate::ID {
            let whitelist_data = whitelist_info.data.borrow();
            if whitelist_data.len() >= 8 + WhitelistEntry::SIZE {
                let discriminator = &whitelist_data[0..8];
                if discriminator == WhitelistEntry::discriminator() {
                    let whitelist: WhitelistEntry = AnchorDeserialize::deserialize(
                        &mut &whitelist_data[8..]
                    ).map_err(|_| TransferHookError::InvalidAuthority)?;
                    
                    if whitelist.is_whitelisted && whitelist.address == source {
                        msg!("Whitelisted transfer - skipping fees");
                        emit!(TransferHookEvent {
                            source,
                            destination,
                            amount,
                            fee: 0,
                            is_delegate_transfer: false,
                            timestamp: Clock::get()?.unix_timestamp,
                        });
                        return Ok(());
                    }
                }
            }
        }
        
        // Admin transfers bypass fees
        if source == config.authority {
            msg!("Admin transfer - skipping fees");
            emit!(TransferHookEvent {
                source,
                destination,
                amount,
                fee: 0,
                is_delegate_transfer: false,
                timestamp: Clock::get()?.unix_timestamp,
            });
            return Ok(());
        }
        
        // Validate minimum transfer
        require!(amount >= config.min_transfer_amount, TransferHookError::AmountTooLow);
        
        // Calculate fee
        let fee = calculate_fee(amount, config.transfer_fee_basis_points, config.max_transfer_fee);
        
        msg!("Transfer hook executed:");
        msg!("  Source: {}", source);
        msg!("  Destination: {}", destination);
        msg!("  Amount: {}", amount);
        msg!("  Fee: {}", fee);
        msg!("  Net: {}", amount.saturating_sub(fee));
        msg!("  Fee rate: {} bps", config.transfer_fee_basis_points);
        
        emit!(TransferHookEvent {
            source,
            destination,
            amount,
            fee,
            is_delegate_transfer: false,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Update fee configuration (authority only)
    pub fn update_fee_config(
        ctx: Context<UpdateConfig>,
        transfer_fee_basis_points: u16,
        max_transfer_fee: u64,
        min_transfer_amount: u64,
    ) -> Result<()> {
        require!(
            transfer_fee_basis_points <= 1000,
            TransferHookError::FeeTooHigh
        );
        
        let config = &mut ctx.accounts.config;
        config.transfer_fee_basis_points = transfer_fee_basis_points;
        config.max_transfer_fee = max_transfer_fee;
        config.min_transfer_amount = min_transfer_amount;
        
        emit!(FeeConfigUpdated {
            authority: ctx.accounts.authority.key(),
            transfer_fee_basis_points,
            max_transfer_fee,
            min_transfer_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Fee config updated");
        Ok(())
    }

    /// ============ WHITELIST MANAGEMENT ============
    
    pub fn add_whitelist(
        ctx: Context<ManageList>,
        address: Pubkey,
    ) -> Result<()> {
        let entry = &mut ctx.accounts.list_entry;
        entry.address = address;
        entry.is_active = true;
        entry.created_at = Clock::get()?.unix_timestamp;
        entry.bump = ctx.bumps.list_entry;
        entry.entry_type = ListType::Whitelist;
        
        emit!(ListEntryAdded {
            address,
            entry_type: ListType::Whitelist,
            added_by: ctx.accounts.authority.key(),
            timestamp: entry.created_at,
        });
        
        msg!("Added to whitelist: {}", address);
        Ok(())
    }

    pub fn remove_whitelist(
        ctx: Context<ManageList>,
        _address: Pubkey,
    ) -> Result<()> {
        let entry = &ctx.accounts.list_entry;
        let address = entry.address;
        
        // Close account and return rent
        let entry_info = entry.to_account_info();
        let authority_info = ctx.accounts.authority.to_account_info();
        
        **authority_info.lamports.borrow_mut() = authority_info.lamports()
            .checked_add(entry_info.lamports())
            .unwrap();
        **entry_info.lamports.borrow_mut() = 0;
        
        let mut data = entry_info.data.borrow_mut();
        data.fill(0);
        
        emit!(ListEntryRemoved {
            address,
            entry_type: ListType::Whitelist,
            removed_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Removed from whitelist: {}", address);
        Ok(())
    }

    /// ============ BLACKLIST MANAGEMENT ============
    
    pub fn add_blacklist(
        ctx: Context<ManageList>,
        address: Pubkey,
    ) -> Result<()> {
        let entry = &mut ctx.accounts.list_entry;
        entry.address = address;
        entry.is_active = true;
        entry.created_at = Clock::get()?.unix_timestamp;
        entry.bump = ctx.bumps.list_entry;
        entry.entry_type = ListType::Blacklist;
        
        emit!(ListEntryAdded {
            address,
            entry_type: ListType::Blacklist,
            added_by: ctx.accounts.authority.key(),
            timestamp: entry.created_at,
        });
        
        msg!("Added to BLACKLIST: {}", address);
        Ok(())
    }

    pub fn remove_blacklist(
        ctx: Context<ManageList>,
        _address: Pubkey,
    ) -> Result<()> {
        let entry = &ctx.accounts.list_entry;
        let address = entry.address;
        
        let entry_info = entry.to_account_info();
        let authority_info = ctx.accounts.authority.to_account_info();
        
        **authority_info.lamports.borrow_mut() = authority_info.lamports()
            .checked_add(entry_info.lamports())
            .unwrap();
        **entry_info.lamports.borrow_mut() = 0;
        
        let mut data = entry_info.data.borrow_mut();
        data.fill(0);
        
        emit!(ListEntryRemoved {
            address,
            entry_type: ListType::Blacklist,
            removed_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Removed from BLACKLIST: {}", address);
        Ok(())
    }

    /// ============ PERMANENT DELEGATE ============
    
    /// Set permanent delegate - can bypass all restrictions
    pub fn set_permanent_delegate(
        ctx: Context<UpdateConfig>,
        delegate: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.permanent_delegate = delegate;
        
        if let Some(d) = delegate {
            msg!("Permanent delegate SET: {}", d);
        } else {
            msg!("Permanent delegate CLEARED");
        }
        
        emit!(PermanentDelegateUpdated {
            delegate,
            updated_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Toggle blacklist enforcement
    pub fn set_blacklist_enabled(
        ctx: Context<UpdateConfig>,
        enabled: bool,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.blacklist_enabled = enabled;
        
        if enabled {
            msg!("Blacklist enforcement ENABLED");
        } else {
            msg!("Blacklist enforcement DISABLED");
        }
        
        Ok(())
    }

    /// ============ PAUSE / CLOSE ============
    
    pub fn set_paused(
        ctx: Context<UpdateConfig>,
        paused: bool,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.is_paused = paused;
        
        if paused {
            msg!("Hook PAUSED");
        } else {
            msg!("Hook UNPAUSED");
        }
        
        Ok(())
    }

    pub fn close_config(ctx: Context<CloseConfig>) -> Result<()> {
        let config = &ctx.accounts.config;
        msg!("Closing config account");
        msg!("Total fees collected: {}", config.total_fees_collected);
        Ok(())
    }
}

// ==================== CALCULATION FUNCTIONS ====================

fn calculate_fee(amount: u64, basis_points: u16, max_fee: u64) -> u64 {
    if basis_points == 0 || amount == 0 {
        return 0;
    }
    
    let fee = (amount as u128)
        .checked_mul(basis_points as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap()
        as u64;
    
    std::cmp::min(fee, max_fee)
}

// ==================== ACCOUNTS ====================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TransferHookConfig::SIZE,
        seeds = [b"config", authority.key().as_ref()],
        bump
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTransfer<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    /// Source token account
    /// CHECK: Validated by token program
    pub source: AccountInfo<'info>,
    
    /// Destination token account
    /// CHECK: Validated by token program
    pub destination: AccountInfo<'info>,
    
    /// Token mint
    /// CHECK: Validated by token program
    pub mint: AccountInfo<'info>,
    
    /// Whitelist entry (pass SystemProgram if none)
    /// CHECK: Optional whitelist validation
    pub whitelist: AccountInfo<'info>,
    
    /// Blacklist entry (pass SystemProgram if none)
    /// CHECK: Optional blacklist validation
    pub blacklist: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
        has_one = authority @ TransferHookError::InvalidAuthority,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(address: Pubkey, entry_type: ListType)]
pub struct ManageList<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
        has_one = authority @ TransferHookError::InvalidAuthority,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + ListEntry::SIZE,
        seeds = [
            match entry_type {
                ListType::Whitelist => b"whitelist",
                ListType::Blacklist => b"blacklist",
            },
            config.authority.as_ref(),
            address.as_ref()
        ],
        bump
    )]
    pub list_entry: Account<'info, ListEntry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseConfig<'info> {
    #[account(
        mut,
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
        has_one = authority @ TransferHookError::InvalidAuthority,
        close = authority,
    )]
    pub config: Account<'info, TransferHookConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

// ==================== STATE ====================

#[account]
pub struct TransferHookConfig {
    pub authority: Pubkey,
    pub transfer_fee_basis_points: u16,
    pub max_transfer_fee: u64,
    pub min_transfer_amount: u64,
    pub total_fees_collected: u64,
    pub bump: u8,
    pub is_paused: bool,
    pub permanent_delegate: Option<Pubkey>,
    pub blacklist_enabled: bool,
}

impl TransferHookConfig {
    pub const SIZE: usize = 32 + 2 + 8 + 8 + 8 + 1 + 1 + 36 + 1 + 64; // + padding
}

#[account]
pub struct ListEntry {
    pub address: Pubkey,
    pub is_active: bool,
    pub entry_type: ListType,
    pub created_at: i64,
    pub bump: u8,
}

impl ListEntry {
    pub const SIZE: usize = 32 + 1 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ListType {
    Whitelist,
    Blacklist,
}

// Backward compatibility
#[account]
pub struct WhitelistEntry {
    pub address: Pubkey,
    pub is_whitelisted: bool,
    pub added_at: i64,
    pub bump: u8,
}

impl WhitelistEntry {
    pub const SIZE: usize = 32 + 1 + 8 + 1;
}

#[account]
pub struct BlacklistEntry {
    pub address: Pubkey,
    pub is_blacklisted: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl BlacklistEntry {
    pub const SIZE: usize = 32 + 1 + 8 + 1;
}

// ==================== ERRORS ====================

#[error_code]
pub enum TransferHookError {
    #[msg("Fee amount too high (max 10%)")]
    FeeTooHigh,
    
    #[msg("Invalid authority")]
    InvalidAuthority,
    
    #[msg("Transfer amount too low")]
    AmountTooLow,
    
    #[msg("Contract is paused")]
    ContractPaused,
    
    #[msg("Address is blacklisted")]
    AddressBlacklisted,
}

// ==================== EVENTS ====================

#[event]
pub struct TransferHookEvent {
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub is_delegate_transfer: bool,
    pub timestamp: i64,
}

#[event]
pub struct FeeConfigUpdated {
    pub authority: Pubkey,
    pub transfer_fee_basis_points: u16,
    pub max_transfer_fee: u64,
    pub min_transfer_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ListEntryAdded {
    pub address: Pubkey,
    pub entry_type: ListType,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ListEntryRemoved {
    pub address: Pubkey,
    pub entry_type: ListType,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PermanentDelegateUpdated {
    pub delegate: Option<Pubkey>,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

// Legacy events for backward compatibility
#[event]
pub struct WhitelistAdded {
    pub address: Pubkey,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WhitelistRemoved {
    pub address: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}
