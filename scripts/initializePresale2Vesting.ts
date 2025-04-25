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
  const beneficiaryWallet = new PublicKey(process.env.PRESALE2_WALLET!);
  const totalVestingAmountRaw = parseFloat(process.env.PRESALE2_TOTAL_AMOUNT!);
  const totalAmount = new anchor.BN(totalVestingAmountRaw * 10 ** TOKEN_DECIMALS);

  if (!process.env.PRESALE2_WALLET || !process.env.PRESALE2_TOTAL_AMOUNT) {
    throw new Error(
      "PRESALE2_WALLET and PRESALE2_TOTAL_AMOUNT must be set in the .env file"
    );
  }

  // Presale2 vesting schedule: 25% TGE, 25%@4w, 25%@8w, 25%@12w
  // NOTE: Use camelCase 'releaseTime' to match Anchor's generated types
  const tgeAmount = new anchor.BN(Math.floor(totalAmount.toNumber() * 0.25));
  const schedule = [
    { releaseTime: new anchor.BN(weeksFromNow(0)), amount: tgeAmount }, // TGE
    { releaseTime: new anchor.BN(weeksFromNow(4)), amount: tgeAmount },
    { releaseTime: new anchor.BN(weeksFromNow(8)), amount: tgeAmount },
    { releaseTime: new anchor.BN(weeksFromNow(12)), amount: totalAmount.sub(tgeAmount.mul(new anchor.BN(3))) }, // Remainder
  ];

  console.log("--- Initializing Presale2 Vesting ---");
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
      .initializeVesting({ presale2: {} }, totalAmount, schedule) // Pass enum variant as object
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
    console.log("Presale2 vesting initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize presale2 vesting:", err);
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
