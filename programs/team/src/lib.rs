use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, transfer};
use std::str::FromStr;

// Program ID - This will be updated automatically by the build process.
declare_id!("TEAM556Swko2ytgQZoZ314X6XN5erfx42u53sJj63ts");

/// Pubkey of the admin wallet authorized to initialize vesting schedules.
/// NOTE: Set this to the deployer or governance wallet for production.
pub const ADMIN_PUBKEY: &str = "5hPhdLYWdC1zGiryjXafRPrgQ8FpR79q8259mQZXE6zQ";

#[program]
pub mod team {
    use super::*;

    /// Initializes a new vesting account for a beneficiary.
    ///
    /// This function creates a vesting schedule, initializes a Program Derived Address (PDA)
    /// to hold the vesting state and tokens, and transfers the total amount of tokens
    /// from the admin's account to the PDA's token account.
    ///
    /// Only the designated admin wallet (`ADMIN_PUBKEY`) can call this function.
    ///
    /// Args:
    /// * `ctx`: Context containing accounts required for initialization.
    /// * `wallet_type`: The type of wallet being initialized (e.g., Dev, Marketing),
    ///                  which dictates the expected schedule length.
    /// * `total_amount`: The total number of tokens to be vested according to the schedule.
    /// * `schedule`: A vector defining the vesting cliffs (release time and amount).
    pub fn initialize_vesting(
        ctx: Context<InitializeVesting>,
        wallet_type: WalletType,
        total_amount: u64,
        schedule: Vec<VestingSchedule>,
    ) -> Result<()> {
        // --- Authorization ---
        // Ensure the instruction is signed by the designated admin wallet.
        require_keys_eq!(ctx.accounts.admin.key(), Pubkey::from_str(ADMIN_PUBKEY).unwrap(), VestingError::Unauthorized);

        // --- Schedule Validation ---
        // 1. Check if the number of schedule entries matches the expected length for the given wallet type.
        match wallet_type {
            WalletType::Dev => {
                // 5% at 2w, 15% at 24w, 30% at 30w, 50% at 36w
                // Example: Dev wallets expect a 4-part schedule
                require!(schedule.len() == 4, VestingError::InvalidSchedule);
            }
            WalletType::Marketing => {
                // 10% at 2w, 15% at 6w, 25% at 10w, 50% at 14w
                // Example: Marketing wallets expect a 4-part schedule
                require!(schedule.len() == 4, VestingError::InvalidSchedule);
            }
            WalletType::Presale1 => {
                // 50% at 4w, 50% at 8w
                // Example: Presale1 wallets expect a 2-part schedule
                require!(schedule.len() == 2, VestingError::InvalidSchedule);
            }
            WalletType::Presale2 => {
                // 100% at 12w
                // Example: Presale2 wallets expect a 1-part schedule
                require!(schedule.len() == 1, VestingError::InvalidSchedule);
            }
        }

        // 2. Perform detailed validation on schedule entries.
        let mut sum = 0u64; // Accumulator for total amount in schedule entries
        let mut last_time = 0u64; // Tracks the release time of the previous entry
        for s in &schedule {
            // Ensure release times are strictly increasing.
            require!(s.release_time > last_time, VestingError::InvalidSchedule);
            last_time = s.release_time;

            // Ensure each schedule amount is positive (greater than zero).
            require!(s.amount > 0, VestingError::InvalidSchedule);

            // Add the amount to the sum, checking for potential overflow.
            sum = sum.checked_add(s.amount).ok_or(VestingError::InvalidSchedule)?;
        }

        // 3. Ensure the sum of amounts in the schedule matches the provided `total_amount`.
        require!(sum == total_amount, VestingError::InvalidSchedule);

        // --- Initialize Vesting Account PDA ---
        // Get a mutable reference to the vesting account being initialized.
        let vesting = &mut ctx.accounts.vesting_account;
        // Store the beneficiary's public key (who can claim tokens).
        vesting.authority = ctx.accounts.beneficiary.key();
        // Store the mint of the token being vested.
        vesting.mint = ctx.accounts.mint.key();
        // Store the total amount intended for vesting.
        vesting.total_amount = total_amount;
        // Initialize claimed amount to zero.
        vesting.claimed_amount = 0;
        // Store the vesting schedule.
        vesting.schedule = schedule;
        // Store the wallet type.
        vesting.wallet_type = wallet_type;
        // Store the bump seed found by Anchor for the vesting_account PDA.
        vesting.bump = ctx.bumps.vesting_account; // Use the bump provided by Anchor context

        // --- Fund the Vesting Token Account ---
        // Prepare the arguments for the token transfer CPI.
        let transfer_instruction = Transfer {
            from: ctx.accounts.admin_token_account.to_account_info(), // Source: Admin's token account
            to: ctx.accounts.vesting_token_account.to_account_info(), // Destination: PDA's token account
            authority: ctx.accounts.admin.to_account_info(), // Authority: Admin signer
        };
        // Create the CPI context.
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(), // Target program: SPL Token Program
            transfer_instruction,                       // Instruction arguments
        );
        // Execute the token transfer.
        transfer(cpi_ctx, total_amount)?;

        // Log success
        msg!("Vesting account initialized for beneficiary: {}", vesting.authority);
        msg!("Total amount vested: {}", total_amount);

        Ok(())
    }

    /// Allows the beneficiary (`authority`) to claim tokens that have become unlocked
    /// according to the vesting schedule.
    ///
    /// Tokens are transferred from the vesting PDA's token account to the beneficiary's
    /// specified token account (`destination_token_account`).
    ///
    /// Args:
    /// * `ctx`: Context containing accounts required for claiming.
    pub fn claim_unlocked(ctx: Context<ClaimUnlocked>) -> Result<()> {
        // Get a mutable reference to the vesting account state.
        let vesting = &mut ctx.accounts.vesting_account;
        // Get the current time from the Solana clock sysvar.
        let now = Clock::get()?.unix_timestamp as u64;

        // --- Validation ---
        // 1. Mint Consistency: Ensure token accounts belong to the correct mint.
        require_keys_eq!(ctx.accounts.vesting_token_account.mint, vesting.mint, VestingError::InvalidMint);
        require_keys_eq!(ctx.accounts.destination_token_account.mint, vesting.mint, VestingError::InvalidMint);

        // --- Calculate Claimable Amount ---
        // Determine the total amount unlocked based on the current time and schedule.
        let mut unlocked_amount = 0u64;
        for s in &vesting.schedule {
            if now >= s.release_time {
                // Add amount if release time is in the past or present.
                // Use saturating_add to prevent overflow (though unlikely with u64 amounts).
                unlocked_amount = unlocked_amount.saturating_add(s.amount);
            }
        }

        // Calculate the amount actually claimable (unlocked minus already claimed).
        // Use saturating_sub to prevent underflow if claimed_amount somehow exceeds unlocked.
        let claimable_amount = unlocked_amount.saturating_sub(vesting.claimed_amount);
        require!(claimable_amount > 0, VestingError::NothingToClaim);

        // --- Update State ---
        // Increase the claimed amount in the vesting account state.
        // Use saturating_add for safety.
        vesting.claimed_amount = vesting.claimed_amount.saturating_add(claimable_amount);

        // --- Transfer Tokens ---
        // Prepare arguments for the token transfer CPI.
        let cpi_accounts = Transfer {
            from: ctx.accounts.vesting_token_account.to_account_info(), // Source: PDA's token account
            to: ctx.accounts.destination_token_account.to_account_info(), // Destination: Beneficiary's token account
            authority: ctx.accounts.vesting_signer.to_account_info(), // Authority: The vesting PDA itself
        };
        // Get the token program account info.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Define the PDA signer seeds required for the transfer CPI.
        // Must match the seeds used in InitializeVesting.
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vesting",                  // Constant seed prefix
            vesting.authority.as_ref(), // Beneficiary's key used as seed
            &[vesting.bump], // Bump seed stored in the vesting account
        ]];
        // Execute the token transfer CPI, signed by the PDA.
        transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            claimable_amount,
        )?;

        // --- Post-Transfer Validation (Security Checks) ---
        // 1. Verify the provided `vesting_signer` account is indeed the correct PDA.
        // Recreate the expected PDA address using the same seeds.
        let expected_signer = Pubkey::create_program_address(
            &[b"vesting", vesting.authority.as_ref(), &[vesting.bump]],
            ctx.program_id, // Use the current program's ID
        ).map_err(|_| VestingError::InvalidPda)?; // Handle potential error during PDA creation
        // Compare the expected PDA with the provided account key.
        require_keys_eq!(ctx.accounts.vesting_signer.key(), expected_signer, VestingError::InvalidPda);

        // 2. Verify the `vesting_token_account` is owned by the `vesting_signer` PDA.
        // This ensures we are transferring from the correct token account.
        require_keys_eq!(ctx.accounts.vesting_token_account.owner, ctx.accounts.vesting_signer.key(), VestingError::InvalidOwner);

        // Log success
        msg!("Claimed {} tokens for beneficiary: {}", claimable_amount, vesting.authority);
        msg!("Remaining claimable based on current time: {}", unlocked_amount.saturating_sub(vesting.claimed_amount)); // Show what *might* be claimable now

        Ok(())
    }
    
    /// Allows the admin to distribute unlocked tokens to beneficiaries automatically.
    ///
    /// This function enables automated distribution without requiring beneficiaries to manually claim.
    /// Only the designated admin wallet (`ADMIN_PUBKEY`) can call this function.
    ///
    /// Similar to `claim_unlocked`, but can be initiated by the admin on behalf of beneficiaries.
    ///
    /// Args:
    /// * `ctx`: Context containing accounts required for the admin-initiated distribution.
    pub fn admin_distribute_unlocked(ctx: Context<AdminDistribute>) -> Result<()> {
        // Get a mutable reference to the vesting account state.
        let vesting = &mut ctx.accounts.vesting_account;
        // Get the current time from the Solana clock sysvar.
        let now = Clock::get()?.unix_timestamp as u64;

        // --- Calculate Claimable Amount ---
        // Determine the total amount unlocked based on the current time and schedule.
        let mut unlocked_amount = 0u64;
        for s in &vesting.schedule {
            if now >= s.release_time {
                // Add amount if release time is in the past or present.
                unlocked_amount = unlocked_amount.saturating_add(s.amount);
            }
        }

        // Calculate the amount actually claimable (unlocked minus already claimed).
        let claimable_amount = unlocked_amount.saturating_sub(vesting.claimed_amount);
        require!(claimable_amount > 0, VestingError::NothingToClaim);

        // --- Update State ---
        // Increase the claimed amount in the vesting account state.
        vesting.claimed_amount = vesting.claimed_amount.saturating_add(claimable_amount);

        // --- Transfer Tokens ---
        // Prepare arguments for the token transfer CPI.
        let cpi_accounts = Transfer {
            from: ctx.accounts.vesting_token_account.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.vesting_signer.to_account_info(),
        };
        // Get the token program account info.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Define the PDA signer seeds required for the transfer CPI.
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vesting",
            vesting.authority.as_ref(),
            &[vesting.bump],
        ]];
        // Execute the token transfer CPI, signed by the PDA.
        transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            claimable_amount,
        )?;

        // Log success
        msg!("Admin distributed {} tokens to beneficiary: {}", claimable_amount, vesting.authority);
        msg!("Remaining claimable based on current time: {}", unlocked_amount.saturating_sub(vesting.claimed_amount));

        Ok(())
    }
}

/// Defines the accounts required for the `initialize_vesting` instruction.
#[derive(Accounts)]
#[instruction(wallet_type: WalletType, total_amount: u64, schedule: Vec<VestingSchedule>)] // Make args available for constraints if needed
pub struct InitializeVesting<'info> {
    /// The admin account, must be a signer and match `ADMIN_PUBKEY`. Pays for account creation.
    #[account(mut, address = Pubkey::from_str(ADMIN_PUBKEY).unwrap() @ VestingError::Unauthorized)]
    pub admin: Signer<'info>,

    /// The admin's SPL token account, from which tokens will be transferred. Must be mutable.
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,

    /// The beneficiary account (wallet address). Used as a seed for the PDA. Mutable for potential future use.
    /// CHECK: This account's signature is not required, and no data is read from it besides its key.
    /// It is marked mutable because the `init` constraint on `vesting_account` requires the payer (`admin`)
    /// to be mutable, and implicitly, other accounts involved might need to be.
    #[account(mut)]
    pub beneficiary: AccountInfo<'info>,

    /// The vesting account PDA. Initialized by this instruction.
    /// Stores the vesting schedule, beneficiary, mint, amounts, and bump seed.
    /// Seeds: "vesting", beneficiary pubkey.
    #[account(
        init, // Marks this account for creation
        payer = admin, // `admin` pays for the account creation rent
        space = 8 + VestingAccount::MAX_SIZE, // 8 byte discriminator + struct size
        seeds = [b"vesting", beneficiary.key().as_ref()], // PDA seeds
        bump // Ask Anchor to find and store the bump seed
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    /// The Mint account of the SPL token being vested. Used for type safety and ATA initialization.
    pub mint: Account<'info, Mint>,

    /// The SPL token account associated with the `vesting_account` PDA. Initialized by this instruction.
    /// This account will hold the tokens being vested.
    /// Authority is automatically set to the `vesting_account` PDA itself via `associated_token::authority`.
    #[account(
        init, // Marks this account for creation
        payer = admin, // `admin` pays for the account creation rent
        associated_token::mint = mint,
        associated_token::authority = vesting_account // Sets the ATA owner/authority to the vesting PDA
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,

    /// The Solana System Program, required for creating accounts (`init`).
    pub system_program: Program<'info, System>,

    /// The SPL Token Program, required for token operations (transfer, ATA init).
    pub token_program: Program<'info, Token>,

    /// The SPL Associated Token Account Program, required for initializing the `vesting_token_account`.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

/// Defines the accounts required for the `claim_unlocked` instruction.
#[derive(Accounts)]
pub struct ClaimUnlocked<'info> {
    /// The vesting account PDA containing the schedule and state. Mutable because `claimed_amount` is updated.
    /// `has_one = authority` constraint ensures the `authority` signer matches the one stored in the account.
    #[account(mut, has_one = authority @ VestingError::InvalidAuthority)]
    pub vesting_account: Account<'info, VestingAccount>,
    /// The beneficiary of the vesting schedule, must be a signer to authorize the claim.
    pub authority: Signer<'info>,
    /// The PDA's SPL token account holding the vested tokens. Mutable because its balance decreases.
    /// constraint = vesting_token_account.mint == vesting_account.mint,
    /// constraint = vesting_token_account.owner == vesting_signer.key() // Checked manually in handler
    #[account(mut)]
    pub vesting_token_account: Account<'info, TokenAccount>,
    /// The beneficiary's SPL token account where claimed tokens will be deposited. Mutable because its balance increases.
    /// constraint = destination_token_account.mint == vesting_account.mint @ VestingError::InvalidMint
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,
    /// The vesting account PDA, required as the authority for the token transfer CPI.
    /// CHECK: This account is not deserialized. Its key is checked against the expected PDA
    /// derived from seeds (`vesting_account.authority`, `vesting_account.bump`) within the handler logic.
    #[account(
        seeds = [b"vesting", vesting_account.authority.as_ref()], // Ensure seeds match for Anchor's internal checks if needed
        bump = vesting_account.bump
    )]
    /// CHECK: PDA signer for vesting account
    pub vesting_signer: UncheckedAccount<'info>,
    /// The SPL Token Program, required for the token transfer CPI.
    pub token_program: Program<'info, Token>,
}

/// Defines the accounts required for the `admin_distribute_unlocked` instruction.
/// Similar to ClaimUnlocked but doesn't require the authority (beneficiary) to sign.
/// Instead, it requires the admin to sign.
#[derive(Accounts)]
pub struct AdminDistribute<'info> {
    /// The admin account (must match ADMIN_PUBKEY)
    #[account(address = Pubkey::from_str(ADMIN_PUBKEY).unwrap() @ VestingError::Unauthorized)]
    pub admin: Signer<'info>,
    
    /// The vesting account PDA containing the schedule and state. Mutable because `claimed_amount` is updated.
    #[account(mut)]
    pub vesting_account: Account<'info, VestingAccount>,
    
    /// The beneficiary who will receive the tokens
    /// CHECK: This account is only used for reference and verification
    #[account(constraint = authority.key() == vesting_account.authority @ VestingError::InvalidAuthority)]
    pub authority: UncheckedAccount<'info>,
    
    /// The PDA's SPL token account holding the vested tokens. Mutable because its balance decreases.
    #[account(mut,
        constraint = vesting_token_account.mint == vesting_account.mint @ VestingError::InvalidMint,
        constraint = vesting_token_account.owner == vesting_signer.key() @ VestingError::InvalidOwner
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,
    
    /// The beneficiary's SPL token account where claimed tokens will be deposited. Mutable because its balance increases.
    #[account(mut,
        constraint = destination_token_account.mint == vesting_account.mint @ VestingError::InvalidMint,
        constraint = destination_token_account.owner == vesting_account.authority @ VestingError::InvalidAuthority
    )]
    pub destination_token_account: Account<'info, TokenAccount>,
    
    /// The vesting account PDA, required as the authority for the token transfer CPI.
    #[account(
        seeds = [b"vesting", vesting_account.authority.as_ref()],
        bump = vesting_account.bump
    )]
    /// CHECK: PDA signer for vesting account
    pub vesting_signer: UncheckedAccount<'info>,
    
    /// The SPL Token Program, required for the token transfer CPI.
    pub token_program: Program<'info, Token>,
}

/// Represents the state of a vesting schedule stored in the PDA.
#[account]
pub struct VestingAccount {
    /// The public key of the beneficiary who can claim the tokens. Used in `has_one` and PDA seeds.
    pub authority: Pubkey,
    /// The mint address of the SPL token being vested.
    pub mint: Pubkey,
    /// The total amount of tokens initially locked in the schedule.
    pub total_amount: u64,
    /// The amount of tokens already claimed by the beneficiary.
    pub claimed_amount: u64,
    /// The vector containing individual vesting cliffs (time and amount).
    pub schedule: Vec<VestingSchedule>,
    /// The type of wallet this schedule corresponds to (e.g., Dev, Marketing).
    pub wallet_type: WalletType,
    /// The bump seed used for the PDA derivation. Required for CPI signing.
    pub bump: u8,
}

impl VestingAccount {
    /// Maximum number of schedule entries allowed (adjust based on longest schedule type).
    pub const MAX_SCHEDULES: usize = 4; // e.g., Dev/Marketing schedule length
    /// Calculate the maximum size required for the account, including discriminator (8 bytes).
    pub const MAX_SIZE: usize = 8 // Discriminator
        + 32 // authority: Pubkey
        + 32 // mint: Pubkey
        + 8  // total_amount: u64
        + 8  // claimed_amount: u64
        + (4 + Self::MAX_SCHEDULES * VestingSchedule::SIZE) // schedule: Vec<VestingSchedule> (4 bytes for len + size per item)
        + 1 // wallet_type: WalletType (assuming enum size 1)
        + 1; // bump: u8
}

/// Enum defining different types of vesting schedules (e.g., based on recipient role).
/// Used to enforce specific schedule lengths during initialization.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum WalletType {
    Dev,
    Marketing,
    Presale1,
    Presale2,
}

/// Represents a single vesting cliff in the schedule.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct VestingSchedule {
    /// The Unix timestamp (seconds since epoch) when the amount becomes unlocked.
    pub release_time: u64,
    /// The amount of tokens unlocked at the `release_time`.
    pub amount: u64,
}

impl VestingSchedule {
    /// Size of one VestingSchedule struct in bytes.
    pub const SIZE: usize = 8 + 8; // release_time: u64 + amount: u64
}

// --- Errors ---

#[error_code]
pub enum VestingError {
    #[msg("Unauthorized: Only the admin can perform this action.")]
    Unauthorized,
    #[msg("Invalid schedule: Schedule does not meet requirements (length, order, amounts).")]
    InvalidSchedule,
    #[msg("Invalid mint: Provided token account mint does not match vesting mint.")]
    InvalidMint,
    #[msg("Nothing to claim: No tokens are currently claimable.")]
    NothingToClaim,
    #[msg("Invalid authority: Signer does not match vesting account authority.")]
    InvalidAuthority,
    #[msg("Invalid PDA: Provided vesting signer account is not the correct PDA.")]
    InvalidPda,
    #[msg("Invalid owner: Vesting token account is not owned by the vesting PDA.")]
    InvalidOwner,
}