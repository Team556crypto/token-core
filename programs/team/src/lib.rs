use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use std::str::FromStr;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("9zQ1Zf83KRmxXQFqb7nfcDXsZ4zys4RsGomrM7CfxYgd");

// Only this wallet can initialize vesting accounts (set to the deployer or governance wallet for production)
const ADMIN_PUBKEY: &str = "Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK"; // Set at build time: export TREASURY_ADDRESS=<TREASURY_ADDRESS> before building, or use .env with Anchor

#[program]
mod team {
    use super::*;
    pub fn initialize_vesting(
        ctx: Context<InitializeVesting>,
        wallet_type: WalletType,
        total_amount: u64,
        schedule: Vec<VestingSchedule>,
    ) -> Result<()> {
        // Only the admin wallet can initialize vesting accounts
        require_keys_eq!(ctx.accounts.admin.key(), Pubkey::from_str(ADMIN_PUBKEY).unwrap(), VestingError::Unauthorized);
        // Enforce correct schedule for wallet type
        match wallet_type {
            WalletType::Dev => {
                // 5% at 2w, 15% at 24w, 30% at 30w, 50% at 36w
                require!(schedule.len() == 4, VestingError::InvalidSchedule);
            }
            WalletType::Marketing => {
                // 10% at 2w, 15% at 6w, 25% at 10w, 50% at 14w
                require!(schedule.len() == 4, VestingError::InvalidSchedule);
            }
            WalletType::Presale1 => {
                // 50% at 4w, 50% at 8w
                require!(schedule.len() == 2, VestingError::InvalidSchedule);
            }
            WalletType::Presale2 => {
                // 100% at 12w
                require!(schedule.len() == 1, VestingError::InvalidSchedule);
            }
        }
        // Additional schedule validation: times strictly increasing, amounts sum to total_amount
        let mut sum = 0u64;
        let mut last_time = 0u64;
        for s in &schedule {
            require!(s.release_time > last_time, VestingError::InvalidSchedule);
            last_time = s.release_time;
            sum = sum.checked_add(s.amount).ok_or(VestingError::InvalidSchedule)?;
        }
        require!(sum == total_amount, VestingError::InvalidSchedule);
        let vesting = &mut ctx.accounts.vesting_account;
        vesting.authority = ctx.accounts.beneficiary.key();
        vesting.mint = ctx.accounts.mint.key();
        vesting.total_amount = total_amount;
        vesting.claimed_amount = 0;
        vesting.schedule = schedule;
        vesting.wallet_type = wallet_type;
        // Set bump for PDA
        let (_, bump) = Pubkey::find_program_address(&[b"vesting", vesting.authority.as_ref()], ctx.program_id);
        vesting.bump = bump;
        Ok(())
    }

    pub fn claim_unlocked(ctx: Context<ClaimUnlocked>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_account;
        let now = Clock::get()?.unix_timestamp as u64;
        // Mint consistency checks
        require_keys_eq!(ctx.accounts.vesting_token_account.mint, vesting.mint, VestingError::InvalidMint);
        require_keys_eq!(ctx.accounts.destination_token_account.mint, vesting.mint, VestingError::InvalidMint);
        let mut unlocked = 0u64;
        for s in &vesting.schedule {
            if now >= s.release_time {
                unlocked = unlocked.saturating_add(s.amount);
            }
        }
        let claimable = unlocked.saturating_sub(vesting.claimed_amount);
        require!(claimable > 0, VestingError::NothingToClaim);
        vesting.claimed_amount = vesting.claimed_amount.saturating_add(claimable);
        // Transfer tokens from vesting token account to destination
        let cpi_accounts = Transfer {
            from: ctx.accounts.vesting_token_account.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.vesting_signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let signer_seeds: &[&[&[u8]]] = &[&[b"vesting", vesting.authority.as_ref(), &[vesting.bump]]];
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            claimable,
        )?;
        // PDA validation: ensure vesting_signer is correct PDA
        let expected_signer = Pubkey::create_program_address(
            &[b"vesting", vesting.authority.as_ref(), &[vesting.bump]],
            ctx.program_id,
        ).map_err(|_| VestingError::InvalidPda)?;
        require_keys_eq!(ctx.accounts.vesting_signer.key(), expected_signer, VestingError::InvalidPda);
        // Check vesting_token_account is owned by the correct PDA
        require_keys_eq!(ctx.accounts.vesting_token_account.owner, ctx.accounts.vesting_signer.key(), VestingError::InvalidOwner);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVesting<'info> {
    #[account(init, payer = admin, space = 8 + VestingAccount::MAX_SIZE)]
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// The wallet that will receive the vested tokens
    pub beneficiary: SystemAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimUnlocked<'info> {
    #[account(mut, has_one = authority)]
    pub vesting_account: Account<'info, VestingAccount>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub vesting_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,
    /// CHECK: PDA signer for vesting account
    pub vesting_signer: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct VestingAccount {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub claimed_amount: u64,
    pub schedule: Vec<VestingSchedule>,
    pub wallet_type: WalletType,
    pub bump: u8,
}

impl VestingAccount {
    pub const MAX_SCHEDULES: usize = 4; // max for dev/marketing
    pub const MAX_SIZE: usize = 32 + 32 + 8 + 8 + (4 + Self::MAX_SCHEDULES * VestingSchedule::SIZE) + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum WalletType {
    Dev,
    Marketing,
    Presale1,
    Presale2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VestingSchedule {
    pub release_time: u64, // unix timestamp
    pub amount: u64,       // amount unlocked at this time
}

impl VestingSchedule {
    pub const SIZE: usize = 8 + 8;
}

#[error_code]
pub enum VestingError {
    #[msg("No tokens available to claim at this time.")]
    NothingToClaim,
    #[msg("Unauthorized: Only the admin wallet can initialize vesting accounts.")]
    Unauthorized,
    #[msg("Invalid vesting schedule for wallet type.")]
    InvalidSchedule,
    #[msg("Token account mint does not match vesting account mint.")]
    InvalidMint,
    #[msg("Provided vesting_signer PDA is invalid.")]
    InvalidPda,
    #[msg("Vesting token account is not owned by the correct PDA.")]
    InvalidOwner,
}