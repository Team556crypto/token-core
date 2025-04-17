// simple-direct-metadata.js
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} from "@solana/web3.js";
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if MAINNET_RPC_URL is set
if (!process.env.MAINNET_RPC_URL) {
  console.error("ERROR: MAINNET_RPC_URL not set in environment variables");
  process.exit(1);
}

// Hardcoded Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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

    // Initialize Metaplex (only used for Arweave upload)
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(keypair));

    // Load metadata
    console.log("Loading metadata from fakeseals-metadata.json...");
    const metadata = JSON.parse(fs.readFileSync('./fakeseals-metadata.json', 'utf8'));
    console.log("Metadata loaded:", metadata);

    // Token mint address
    const mintAddress = new PublicKey('3CPWoCJvtaSG4QhYHgzEFShzwLNnr6fh3PQURQF29ujs');

    // Upload metadata to Arweave using Metaplex JS SDK
    console.log("Uploading metadata to Arweave...");
    const { uri } = await metaplex.nfts().uploadMetadata(metadata);
    console.log("Metadata uploaded successfully to:", uri);

    // Generate the metadata account PDA
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAddress.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log("Metadata Account PDA:", metadataAccount.toString());

    // Check if metadata account already exists
    const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);
    if (metadataAccountInfo) {
      console.log("Metadata account already exists. You need to update it instead of creating a new one.");
      return;
    }

    console.log("Creating a new token metadata account...");

    // NOTE: Without mint authority, this will likely fail, but we can try
    // In a production environment, this would need to be adjusted based on the specific needs
    console.log("\nWARNING: This script will likely fail since mint authority is revoked for this token.");
    console.log("To add metadata to a token with revoked mint authority, you need to use a custom program or");
    console.log("work with the protocol/team that created the token originally.\n");

    console.log("For Mainnet tokens, consider using a token listing service instead that displays metadata");
    console.log("without requiring on-chain metadata creation (like Solscan, Jupiter, etc.)");

    return { uri };
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