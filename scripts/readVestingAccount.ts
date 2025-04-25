import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  setupProvider,
  getProgram,
  WalletType,
  TOKEN_DECIMALS
} from "./common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("vestingAccountPda", {
      alias: "pda",
      type: "string",
      description: "Public key of the vesting account PDA to read",
      demandOption: true,
    })
    .help()
    .alias("help", "h").argv;

  const provider = setupProvider();
  const program = getProgram(provider);

  const vestingAccountPda = new PublicKey(argv.vestingAccountPda);

  console.log(`--- Reading Vesting Account: ${vestingAccountPda.toBase58()} ---`);

  try {
    const vestingAccountData = await program.account.vestingAccount.fetch(vestingAccountPda);

    console.log(`Beneficiary (Authority): ${vestingAccountData.authority.toBase58()}`);
    console.log(`Mint: ${vestingAccountData.mint.toBase58()}`);
    const walletTypeName = Object.keys(vestingAccountData.walletType)[0];
    console.log(`Wallet Type: ${walletTypeName.charAt(0).toUpperCase() + walletTypeName.slice(1)}`); // Capitalize for display
    console.log(`Total Amount: ${vestingAccountData.totalAmount.toString()} (raw) / ${vestingAccountData.totalAmount.toNumber() / (10 ** TOKEN_DECIMALS)} (ui)`);
    console.log(`Claimed Amount: ${vestingAccountData.claimedAmount.toString()} (raw) / ${vestingAccountData.claimedAmount.toNumber() / (10 ** TOKEN_DECIMALS)} (ui)`);
    console.log(`Bump: ${vestingAccountData.bump}`);
    console.log(`Schedule:`);
    vestingAccountData.schedule.forEach((s, index) => {
      const releaseDate = new Date(s.releaseTime.toNumber() * 1000);
      console.log(`  [${index}] Release Time: ${s.releaseTime.toString()} (${releaseDate.toISOString()})`);
      console.log(`      Amount: ${s.amount.toString()} (raw) / ${s.amount.toNumber() / (10 ** TOKEN_DECIMALS)} (ui)`);
    });

  } catch (err) {
    console.error(`Failed to read vesting account ${vestingAccountPda.toBase58()}:`, err);
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
