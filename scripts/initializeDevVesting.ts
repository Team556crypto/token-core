import * as anchor from "@project-serum/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  setupProvider,
  getProgram,
  WalletType,
  MINT_ADDRESS,
  TOKEN_DECIMALS,
  weeksFromNow,
} from "./common";

async function main() {
  const provider = setupProvider();
  const program = getProgram(provider);

  // --- Configurable values ---
  const beneficiaryWallet = new PublicKey(process.env.DEV_WALLET!);
  const totalVestingAmountRaw = parseFloat(process.env.DEV_TOTAL_AMOUNT!);
  const totalAmount = new anchor.BN(totalVestingAmountRaw * 10 ** TOKEN_DECIMALS);

  if (!process.env.DEV_WALLET || !process.env.DEV_TOTAL_AMOUNT) {
    throw new Error(
      "DEV_WALLET and DEV_TOTAL_AMOUNT must be set in the .env file"
    );
  }

  // Dev vesting schedule: 100% at 12m (52 weeks)
  // NOTE: Use camelCase 'releaseTime' to match Anchor's generated types
  const schedule = [
    { releaseTime: new anchor.BN(weeksFromNow(52)), amount: totalAmount },
  ];

  console.log("--- Initializing Dev Vesting ---");
  console.log(`Beneficiary: ${beneficiaryWallet.toBase58()}`);
  console.log(`Total Amount: ${totalAmount.toString()} (${totalVestingAmountRaw})`);
  console.log(`Schedule: ${JSON.stringify(schedule)}`);

  // Get the Associated Token Account addresses
  const adminTokenAccount = getAssociatedTokenAddressSync(
    MINT_ADDRESS,
    provider.wallet.publicKey
  );

  // Find PDA for vesting account
  const [vestingAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting"), beneficiaryWallet.toBuffer()],
    program.programId
  );

  // Get the vesting account's Associated Token Account address
  const vestingTokenAccount = getAssociatedTokenAddressSync(
    MINT_ADDRESS,
    vestingAccountPDA, // The PDA is the owner of this ATA
    true // Allow owner off curve (required for PDAs)
  );

  console.log(`Vesting Account PDA: ${vestingAccountPDA.toString()}`);
  console.log(`Admin ATA: ${adminTokenAccount.toString()}`);
  console.log(`Vesting ATA: ${vestingTokenAccount.toString()}`);

  // Initialize vesting account instruction
  try {
    const tx = await program.methods
      .initializeVesting({ dev: {} }, totalAmount, schedule)
      .accounts({
        admin: provider.wallet.publicKey,
        adminTokenAccount: adminTokenAccount,
        beneficiary: beneficiaryWallet,
        vestingAccount: vestingAccountPDA,
        mint: MINT_ADDRESS,
        vestingTokenAccount: vestingTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Initialization transaction signature", tx);
    console.log("Dev vesting initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize dev vesting:", err);
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
