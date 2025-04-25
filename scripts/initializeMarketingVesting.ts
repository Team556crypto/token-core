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
  const beneficiaryWallet = new PublicKey(process.env.MARKETING_WALLET!);
  const totalVestingAmountRaw = parseFloat(process.env.MARKETING_TOTAL_AMOUNT!);
  const totalAmount = new anchor.BN(totalVestingAmountRaw * 10 ** TOKEN_DECIMALS);

  if (!process.env.MARKETING_WALLET || !process.env.MARKETING_TOTAL_AMOUNT) {
    throw new Error(
      "MARKETING_WALLET and MARKETING_TOTAL_AMOUNT must be set in the .env file"
    );
  }

  // Marketing vesting schedule: 10%@2w, 15%@6w, 25%@10w, 50%@14w
  // NOTE: Use camelCase 'releaseTime' to match Anchor's generated types
  const schedule = [
    {
      releaseTime: new anchor.BN(weeksFromNow(2)),
      amount: new anchor.BN(Math.floor(totalAmount.toNumber() * 0.1)),
    },
    {
      releaseTime: new anchor.BN(weeksFromNow(6)),
      amount: new anchor.BN(Math.floor(totalAmount.toNumber() * 0.15)),
    },
    {
      releaseTime: new anchor.BN(weeksFromNow(10)),
      amount: new anchor.BN(Math.floor(totalAmount.toNumber() * 0.25)),
    },
    {
      releaseTime: new anchor.BN(weeksFromNow(14)),
      // Calculate remainder to avoid precision issues
      amount: totalAmount.sub(new anchor.BN(Math.floor(totalAmount.toNumber() * (0.1 + 0.15 + 0.25)))),
    },
  ];

  console.log("--- Initializing Marketing Vesting ---");
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
    vestingAccountPDA,
    true // Allow owner off curve
  );

  console.log(`Vesting Account PDA: ${vestingAccountPDA.toString()}`);
  console.log(`Admin ATA: ${adminTokenAccount.toString()}`);
  console.log(`Vesting ATA: ${vestingTokenAccount.toString()}`);

  // Initialize vesting account instruction
  try {
    const tx = await program.methods
      .initializeVesting({ marketing: {} }, totalAmount, schedule) // Pass enum variant as object
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
    console.log("Marketing vesting initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize marketing vesting:", err);
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
