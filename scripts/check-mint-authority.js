// check-mint-authority.js
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if MAINNET_RPC_URL is set
if (!process.env.MAINNET_RPC_URL) {
  console.error("ERROR: MAINNET_RPC_URL not set in environment variables");
  process.exit(1);
}

async function checkTokenMintAuthority() {
  try {
    // Connect to Solana
    console.log("Connecting to Mainnet...");
    const connection = new Connection(process.env.MAINNET_RPC_URL, "confirmed");

    // Token mint address
    const mintAddress = new PublicKey('3CPWoCJvtaSG4QhYHgzEFShzwLNnr6fh3PQURQF29ujs');

    // Get mint info
    console.log(`Fetching mint info for: ${mintAddress.toString()}`);
    const mintInfo = await getMint(connection, mintAddress);

    console.log("\n=== TOKEN MINT INFO ===");
    console.log(`Supply: ${mintInfo.supply}`);
    console.log(`Decimals: ${mintInfo.decimals}`);
    console.log(`Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);

    if (mintInfo.mintAuthority) {
      console.log(`Mint Authority: ${mintInfo.mintAuthority.toString()}`);
    } else {
      console.log("Mint Authority: None (Authority has been revoked)");
    }

    // Your wallet for comparison
    const yourWallet = "Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK";

    if (mintInfo.mintAuthority?.toString() === yourWallet) {
      console.log("\n✅ Your wallet IS the mint authority");
    } else {
      console.log("\n❌ Your wallet is NOT the mint authority");
    }

    return mintInfo;
  } catch (error) {
    console.error("ERROR CHECKING MINT AUTHORITY:");
    console.error(error);
    throw error;
  }
}

checkTokenMintAuthority()
  .then(() => console.log("\nToken mint authority check complete!"))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 