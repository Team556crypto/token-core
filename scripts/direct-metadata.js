// direct-metadata.js
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import tokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';
import { uploadMetadata } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if MAINNET_RPC_URL is set
if (!process.env.MAINNET_RPC_URL) {
  console.error("ERROR: MAINNET_RPC_URL not set in environment variables");
  process.exit(1);
}

// Extract the methods we need from the CommonJS package
const { createCreateMetadataAccountV3Instruction, PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID } = tokenMetadataPkg;

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

    // Load metadata
    console.log("Loading metadata from twofake-metadata.json...");
    const metadata = JSON.parse(fs.readFileSync('./twofake-metadata.json', 'utf8'));
    console.log("Metadata loaded:", metadata);

    // Token mint address
    const mintAddress = new PublicKey('BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu');

    // Upload metadata to Arweave using Umi
    console.log("Uploading metadata to Arweave...");
    const umi = createUmi(process.env.MAINNET_RPC_URL);
    const signer = fromWeb3JsKeypair(keypair);
    umi.use(signer);
    const uri = await uploadMetadata(umi, metadata);
    console.log("Metadata uploaded successfully to:", uri);

    // Generate the metadata account PDA
    // The metadata account address is a PDA derived from the token mint
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAddress.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log("Metadata Account PDA:", metadataAccount.toString());

    // Create the metadata instruction
    const createMetadataInstruction = createCreateMetadataAccountV3Instruction({
      metadata: metadataAccount,
      mint: mintAddress,
      mintAuthority: keypair.publicKey, // Even with no mint authority, we need to sign
      payer: keypair.publicKey,
      updateAuthority: keypair.publicKey,
      data: {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    }, TOKEN_METADATA_PROGRAM_ID);

    // Create transaction
    const transaction = new Transaction().add(createMetadataInstruction);

    // Sign and send the transaction
    console.log("Creating token metadata...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair]
    );

    console.log("\n==== TOKEN METADATA CREATED SUCCESSFULLY ====");
    console.log("Transaction signature:", signature);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}`);
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

    return { signature, metadataUri: uri };
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