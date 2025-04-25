import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  setupProvider,
  getProgram,
  loadKeypair,
  MINT_ADDRESS,
} from "./common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("beneficiaryKeypair", {
      alias: "k",
      type: "string",
      description: "Path to the beneficiary's keypair file",
      demandOption: true,
    })
    .option("vestingAccountPda", {
      alias: "pda",
      type: "string",
      description: "Public key of the vesting account PDA",
      demandOption: true,
    })
    .help()
    .alias("help", "h").argv;

  const provider = setupProvider();
  const program = getProgram(provider);

  const beneficiaryKeypair = loadKeypair(argv.beneficiaryKeypair);
  const vestingAccount = new PublicKey(argv.vestingAccountPda);
  const beneficiaryPublicKey = beneficiaryKeypair.publicKey;

  console.log("--- Claiming Vesting Tokens ---");
  console.log(`Beneficiary: ${beneficiaryPublicKey.toBase58()}`);
  console.log(`Vesting Account PDA: ${vestingAccount.toBase58()}`);

  // Get the necessary associated token accounts
  const beneficiaryAta = getAssociatedTokenAddressSync(
    MINT_ADDRESS,
    beneficiaryPublicKey
  );

  const [vestingSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting"), beneficiaryPublicKey.toBuffer()],
    program.programId
  );

  const vestingAta = getAssociatedTokenAddressSync(
    MINT_ADDRESS,
    vestingSigner, // Vesting PDA owns this account
    true // Allow owner off curve
  );

  console.log(`Beneficiary ATA: ${beneficiaryAta.toString()}`);
  console.log(`Vesting ATA: ${vestingAta.toString()}`);
  console.log(`Vesting Signer PDA: ${vestingSigner.toString()}`);

  // Claim instruction
  try {
    const tx = await program.methods
      .claimUnlocked()
      .accounts({
        vestingAccount: vestingAccount,
        authority: beneficiaryPublicKey,
        vestingTokenAccount: vestingAta, // Source PDA's ATA
        destinationTokenAccount: beneficiaryAta, // Destination Beneficiary's ATA
        vestingSigner: vestingSigner, // The PDA itself
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([beneficiaryKeypair]) // Beneficiary must sign
      .rpc();

    console.log("Claim transaction signature", tx);
    console.log("Tokens claimed successfully!");
  } catch (err) {
    console.error("Failed to claim tokens:", err);
    // Try to parse AnchorError
    if (err instanceof anchor.AnchorError) {
      console.error(`AnchorError: ${err.error.errorMessage} (Code: ${err.error.errorCode.code})`);
    } else {
      console.error(err);
    }
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
