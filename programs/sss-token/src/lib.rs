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

#[derive(Accounts)]
pub struct UpdateFeatures<'info> {
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub stablecoin_state: Account<'info, StablecoinState>,
    
    #[account(
        seeds = [b"role", authority.key().as_ref(), stablecoin_state.mint.as_ref()],
        bump = authority_role.bump,
    )]
    pub authority_role: Account<'info, RoleAccount>,
}

#[derive(Accounts)]
pub struct BatchMint<'info> {
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
    
    pub mint: InterfaceAccount<'info, InterfaceMint>,
    
    /// CHECK: PDA used as mint authority
    #[account(
        seeds = [b"mint_authority", stablecoin_state.key().as_ref()],
        bump
    )]
    pub mint_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token2022>,
}