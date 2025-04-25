import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
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
  TOKEN_DECIMALS,
} from "./common";
import fs from "fs";
import path from "path";

/**
 * Batch processor that automatically releases vested tokens to beneficiaries
 * NOTE: This requires the Anchor smart contract to be modified to include an 
 * admin_distribute_unlocked function that allows admin-initiated claims.
 */
async function main() {
  console.log("=== Batch Token Release Processor ===");
  
  // Setup provider and program
  const provider = setupProvider();
  const program = getProgram(provider);
  
  // Use the admin keypair for signing transactions
  const adminKeypair = (provider.wallet as anchor.Wallet).payer;
  console.log(`Using admin: ${adminKeypair.publicKey.toString()}`);
  
  // Get all vesting accounts managed by the program
  console.log("Fetching all vesting accounts...");
  const vestingAccounts = await program.account.vestingAccount.all();
  console.log(`Found ${vestingAccounts.length} vesting accounts`);
  
  // Statistics tracking
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalAmount = new anchor.BN(0);
  
  // Create log directory if it doesn't exist
  const logDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  
  // Create log file for this run
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const logFile = path.join(logDir, `batch-release-${timestamp}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  
  // Helper for logging
  const log = (message: string) => {
    console.log(message);
    logStream.write(message + "\n");
  };
  
  log(`[${new Date().toISOString()}] Starting batch token release process`);
  
  // Process each vesting account
  for (let i = 0; i < vestingAccounts.length; i++) {
    const accountData = vestingAccounts[i];
    const vestingAccount = accountData.account;
    const vestingPDA = accountData.publicKey;
    const beneficiary = vestingAccount.authority;
    
    log(`\n[${i + 1}/${vestingAccounts.length}] Processing ${vestingPDA.toString()}`);
    log(`  Beneficiary: ${beneficiary.toString()}`);
    log(`  Wallet Type: ${Object.keys(vestingAccount.walletType)[0]}`);
    
    // Calculate unlocked amount based on current time
    const now = Math.floor(Date.now() / 1000);
    log(`  Current time: ${now} (${new Date(now * 1000).toISOString()})`);
    
    let totalUnlocked = new anchor.BN(0);
    
    // Log full schedule
    log(`  Vesting schedule:`);
    vestingAccount.schedule.forEach((item, idx) => {
      log(`    [${idx}] ${item.releaseTime.toString()} (${new Date(item.releaseTime.toNumber() * 1000).toISOString()}) - ${item.amount.toString()} tokens (${item.amount.toNumber() / Math.pow(10, TOKEN_DECIMALS)} $TEAM)`);
      
      if (now >= item.releaseTime.toNumber()) {
        totalUnlocked = totalUnlocked.add(item.amount);
      }
    });
    
    // Calculate claimable amount
    const claimableAmount = totalUnlocked.sub(vestingAccount.claimedAmount);
    
    log(`  Total unlocked: ${totalUnlocked.toString()} tokens (${totalUnlocked.toNumber() / Math.pow(10, TOKEN_DECIMALS)} $TEAM)`);
    log(`  Already claimed: ${vestingAccount.claimedAmount.toString()} tokens (${vestingAccount.claimedAmount.toNumber() / Math.pow(10, TOKEN_DECIMALS)} $TEAM)`);
    log(`  Available to claim: ${claimableAmount.toString()} tokens (${claimableAmount.toNumber() / Math.pow(10, TOKEN_DECIMALS)} $TEAM)`);
    
    // Skip if nothing to claim
    if (claimableAmount.isZero()) {
      log(`  ⏩ Skipping: No tokens available to claim`);
      totalSkipped++;
      continue;
    }
    
    totalProcessed++;
    
    try {
      // Get token accounts
      const vestingTokenAccount = getAssociatedTokenAddressSync(
        MINT_ADDRESS,
        vestingPDA,
        true // Allow owner off curve
      );
      
      const beneficiaryTokenAccount = getAssociatedTokenAddressSync(
        MINT_ADDRESS,
        beneficiary
      );
      
      log(`  Vesting Token Account: ${vestingTokenAccount.toString()}`);
      log(`  Beneficiary Token Account: ${beneficiaryTokenAccount.toString()}`);
      
      // Send the transaction
      log(`  🔄 Sending transaction to distribute ${claimableAmount.toString()} tokens...`);
      
      // NOTE: This instruction 'adminDistributeUnlocked' needs to be implemented in the contract
      const tx = await program.methods
        .adminDistributeUnlocked()
        .accounts({
          admin: adminKeypair.publicKey,
          vestingAccount: vestingPDA,
          authority: beneficiary, // The beneficiary is still set as the authority
          vestingTokenAccount: vestingTokenAccount,
          destinationTokenAccount: beneficiaryTokenAccount,
          vestingSigner: vestingPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([adminKeypair])
        .rpc();
      
      log(`  ✅ Success! Transaction: ${tx}`);
      totalSuccessful++;
      totalAmount = totalAmount.add(claimableAmount);
    } catch (error) {
      log(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      totalFailed++;
    }
  }
  
  // Log summary
  log(`\n=== Batch Release Summary ===`);
  log(`Total accounts processed: ${vestingAccounts.length}`);
  log(`Accounts with claimable tokens: ${totalProcessed}`);
  log(`Successful distributions: ${totalSuccessful}`);
  log(`Failed distributions: ${totalFailed}`);
  log(`Skipped (no tokens to claim): ${totalSkipped}`);
  log(`Total tokens distributed: ${totalAmount.toString()} (${totalAmount.toNumber() / Math.pow(10, TOKEN_DECIMALS)} $TEAM)`);
  log(`Log file: ${logFile}`);
  
  // Close log stream
  logStream.end();
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
