import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Team } from "../target/types/team";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// WalletType Enum mirroring the Rust definition
export enum WalletType {
  Dev,
  Marketing,
  Presale1,
  Presale2,
}

// Function to load a keypair from a file path
export function loadKeypair(keypairPath: string): Keypair {
  if (!keypairPath || keypairPath === "") {
    throw new Error("Keypair path is required!");
  }
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair file not found at path: ${keypairPath}`);
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath).toString()))
  );
  console.log(`Loaded keypair with public key: ${loaded.publicKey.toBase58()}`);
  return loaded;
}

// Function to calculate future timestamp in seconds
export function weeksFromNow(weeks: number): number {
  const now = Math.floor(Date.now() / 1000);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + weeks * 7);
  return Math.floor(futureDate.getTime() / 1000);
}

// Configure the client to use the local cluster or specified RPC URL
export function setupProvider(): anchor.AnchorProvider {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8899";
  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
  const adminKeypairPath = process.env.ADMIN_KEYPAIR_PATH!;
  const adminWallet = loadKeypair(adminKeypairPath);

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(adminWallet), // Use the loaded admin keypair
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  return provider;
}

// Get the program instance
export function getProgram(provider: anchor.AnchorProvider): Program<Team> {
  const programId = new PublicKey(process.env.PROGRAM_ID!);
  return anchor.workspace.Team as Program<Team>; // Assumes program ID is in Anchor.toml
}

// Common constants
export const MINT_ADDRESS = new PublicKey(process.env.MINT_ADDRESS!);
export const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || "9");

// Basic validation
if (!process.env.ADMIN_KEYPAIR_PATH) {
  throw new Error("ADMIN_KEYPAIR_PATH must be set in the .env file");
}
if (!process.env.MINT_ADDRESS) {
  throw new Error("MINT_ADDRESS must be set in the .env file");
}
if (!process.env.PROGRAM_ID) {
  console.warn(
    "PROGRAM_ID not found in .env, relying on Anchor.toml. Ensure it's correct."
  );
}

console.log(`Using RPC: ${process.env.RPC_URL || "http://127.0.0.1:8899"}`);
console.log(`Using Mint: ${MINT_ADDRESS.toBase58()}`);
console.log(`Token Decimals: ${TOKEN_DECIMALS}`);
console.log(`Program ID: ${process.env.PROGRAM_ID || "From Anchor.toml"}`);
