import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if MAINNET_RPC_URL is set
if (!process.env.MAINNET_RPC_URL) {
  console.error("ERROR: MAINNET_RPC_URL not set in environment variables");
  process.exit(1);
}

async function setTokenMetadata() {
  try {
    // Connect to Solana
    console.log("Connecting to Mainnet...");
    const connection = new Connection(process.env.MAINNET_RPC_URL, "confirmed");

    // Load your keypair
    console.log("Loading wallet keypair...");
    const keypairFile = fs.readFileSync('mainnet-test-wallets/treasury.json', 'utf8');
    const secretKey = new Uint8Array(JSON.parse(keypairFile));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log("Using keypair with public key:", keypair.publicKey.toString());

    // Initialize Metaplex
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(keypair));

    // Load metadata
    console.log("Loading metadata from fakeseals-metadata.json...");
    const metadata = JSON.parse(fs.readFileSync('./fakeseals-metadata.json', 'utf8'));
    console.log("Metadata loaded:", metadata);

    // Your token mint address
    const mintAddress = new PublicKey('3CPWoCJvtaSG4QhYHgzEFShzwLNnr6fh3PQURQF29ujs');

    // First, upload the complete metadata JSON to get a metadata URI
    console.log("Uploading complete metadata to Arweave...");
    const { uri } = await metaplex.nfts().uploadMetadata(metadata);
    console.log("Metadata uploaded successfully to:", uri);

    // Create metadata using a more direct approach that doesn't require mint authority
    console.log("Creating on-chain metadata...");

    // Get the metadata PDA for this mint
    const metadataPDA = metaplex.nfts().pdas().metadata({ mint: mintAddress });
    console.log("Metadata PDA:", metadataPDA.toString());

    // Build the transaction to create metadata
    const { response } = await metaplex.nfts().createToken({
      mint: mintAddress,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: uri,
      isMutable: true,
      sellerFeeBasisPoints: 0,
      // This approach works without mint authority
      updateAuthority: keypair,
      tokenStandard: 'fungible',
    });

    console.log("\n==== TOKEN METADATA CREATED SUCCESSFULLY ====");
    console.log("Transaction signature:", response.signature);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${response.signature}`);
    console.log(`Token URL: https://explorer.solana.com/address/${mintAddress.toString()}`);

    // Display summary of what was uploaded
    console.log("\nMetadata Summary:");
    console.log("- Name:", metadata.name);
    console.log("- Symbol:", metadata.symbol);
    console.log("- Description:", metadata.description);
    console.log("- Image:", metadata.image);
    console.log("- Website:", metadata.extensions?.website);
    console.log("- X/Twitter:", metadata.extensions?.x);
    console.log("- Complete Metadata URI:", uri);

    return { signature: response.signature, metadataUri: uri };
  } catch (error) {
    console.error("ERROR CREATING TOKEN METADATA:");
    console.error(error);
    throw error;
  }
}

setTokenMetadata()
  .then(() => console.log("\nToken metadata setup complete!"))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 