# Team556 Anchor Vesting Program Deployment Guide

This comprehensive guide covers every step required to deploy, configure, secure, and validate the Team556 vesting program and token ecosystem, in line with the whitepaper and best practices for Solana/Anchor projects.

## Devnet Deployment Configuration

- This project is pre-configured for **Solana devnet** deployment.
- The default deployer wallet is `wallets/treasury.json`.
- All test wallets are in the `wallets/` directory (see `.env` for addresses).
- `Anchor.toml`, `.env`, and Solana CLI are set to use devnet and the treasury wallet.
- To switch to mainnet, update these files and reconfigure the CLI as needed.

---

## Table of Contents

- [Team556 Anchor Vesting Program Deployment Guide](#team556-anchor-vesting-program-deployment-guide)
  - [Devnet Deployment Configuration](#devnet-deployment-configuration)
  - [Table of Contents](#table-of-contents)
  - [1. Overview \& Architecture](#1-overview--architecture)
  - [2. Prerequisites \& Environment Setup](#2-prerequisites--environment-setup)
  - [3. Wallet Management \& Security](#3-wallet-management--security)
  - [4. Anchor \& Solana CLI Configuration](#4-anchor--solana-cli-configuration)
  - [5. Building \& Deploying the Anchor Program](#5-building--deploying-the-anchor-program)
  - [5a. Upgrading the Anchor Program](#5a-upgrading-the-anchor-program)
    - [1. Prerequisites](#1-prerequisites)
    - [2. Standard Upgrade (Online)](#2-standard-upgrade-online)
      - [If the program binary is larger than the current allocation:](#if-the-program-binary-is-larger-than-the-current-allocation)
    - [3. Using a Buffer Account (Multi-sig/Offline/DAO)](#3-using-a-buffer-account-multi-sigofflinedao)
    - [4. Upgrading with an Offline Signer](#4-upgrading-with-an-offline-signer)
    - [5. Managing Upgrade Authority](#5-managing-upgrade-authority)
    - [6. Best Practices](#6-best-practices)
    - [7. Verifying Program Upgrades](#7-verifying-program-upgrades)
  - [6. SPL Token Creation \& Configuration](#6-spl-token-creation--configuration)
  - [7. Vesting Account Initialization](#7-vesting-account-initialization)
    - [Testing with CLI Commands](#testing-with-cli-commands)
      - [Using Anchor CLI Directly](#using-anchor-cli-directly)
      - [Using a Shell Script for Multiple Wallets](#using-a-shell-script-for-multiple-wallets)
      - [Using Solana CLI for Verification](#using-solana-cli-for-verification)
    - [Bulk Testing with CSV Input](#bulk-testing-with-csv-input)
    - [Verification Commands](#verification-commands)
  - [8. DEX Liquidity \& LP Token Burning](#8-dex-liquidity--lp-token-burning)
  - [9. Claiming Unlocked Tokens](#9-claiming-unlocked-tokens)
  - [10. Finalizing Token Setup](#10-finalizing-token-setup)

---

## 1. Overview & Architecture

- **Team556** is a Solana-based token with enforced vesting for dev, marketing, and presale wallets.
- **On-chain logic**: Vesting, claim enforcement, admin-only vesting account creation.
- **Off-chain/CLI logic**: Token minting, distribution, disabling minting, LP token burning.
- **Key files**: `programs/team/src/lib.rs`, `DEPLOYMENT.md`, `Anchor.toml`, `tests/anchor.ts`, `client/client.ts`.

---

## 2. Prerequisites & Environment Setup

- **OS**: Linux/macOS recommended.
- **Solana CLI**: [Install Guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI**: [Install Guide](https://book.anchor-lang.com/getting_started/installation.html)
- **Node.js & npm/yarn**: [Node.js Download](https://nodejs.org/)
- **Rust**: [Install Guide](https://www.rust-lang.org/tools/install)
- **Yarn**: `npm install -g yarn`
- **A funded Solana wallet** (for deployment and fees)
- **Install project dependencies**:
  ```sh
  yarn install # or npm install
  ```

---

## 3. Wallet Management & Security

- **Generate keypairs** for admin, dev, marketing, and presale wallets:
  ```sh
  solana-keygen new -o <wallet_name>.json
  ```
- **Backup** all keypairs securely (hardware wallet, encrypted storage).
- **Set up multisig** for admin wallet (recommended for production; see [Solana Multisig Guide](https://spl.solana.com/token-2022/multisig)).
- **Rotate keys** as needed (update program and configs).

---

## 4. Anchor & Solana CLI Configuration

- **Configure Solana CLI**:
  ```sh
  solana config set --url devnet # or mainnet-beta
  solana config set --keypair /path/to/admin.json
  ```
- **Configure Anchor.toml**:
  - Set `[provider]` wallet and cluster.
  - Set `[scripts]` for test/client scripts.
- **Check your configuration**:

  ```sh
  solana address
  solana config get
  anchor --version
  ```

- **Verify configuration**:

  ```sh
  # Ensure you're on the right network
  solana config get | grep "RPC URL" # Should show your selected network

  # Verify your wallet is set correctly
  solana address # Should match your admin wallet address

  # Check wallet balance
  solana balance # Should have enough SOL for deployment
  ```

---

## 5. Building & Deploying the Anchor Program

- **Build the program**:
  ```sh
  anchor build
  ```
- **Deploy the program** (two methods):

  **Method 1: Direct deployment** (works best on devnet or with low network congestion):

  ```sh
  anchor deploy
  ```

  **Method 2: Manual buffer deployment** (recommended for mainnet)\*\*:

  ```sh
  # Step 1: Write program to buffer
  solana program write-buffer target/deploy/team.so
  # Note the buffer address from output (e.g., 6A5EQy6A1Xc3SK23J7vvNjTtADfmynuXSTBdmqTtCRq4)

  # Step 2: Deploy from buffer
  solana program deploy --buffer <BUFFER_ADDRESS> target/deploy/team.so
  ```

- **Note the program ID** output by deployment (e.g., Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc).
- **Update your `Anchor.toml` and client code** with the new program ID.
- **Set the correct `ADMIN_PUBKEY`** in `lib.rs` before deployment.
- **Upgrade the program** (if needed):

  ```sh
  anchor upgrade --program-id <PROGRAM_ID> target/deploy/team.so
  ```

- **Verify program deployment**:

  ```sh
  # Check that the program exists on-chain
  solana program show <PROGRAM_ID>

  # Verify program data
  solana program dump <PROGRAM_ID> deployed_program.so
  diff target/deploy/team.so deployed_program.so # Should show no differences

  # Check the program's upgrade authority
  solana program show <PROGRAM_ID> | grep Authority
  ```

---

## 5a. Upgrading the Anchor Program

Solana programs are upgradeable by default unless marked immutable. Upgrading allows you to fix bugs or add features without changing the program ID. Only the upgrade authority can perform upgrades.

### 1. Prerequisites

- You must have the upgrade authority keypair (set at deployment or via `solana program set-upgrade-authority`).
- The new program binary (`.so` file) must be built and available.
- The program account must have enough space for the new binary. If not, extend it (see below).

### 2. Standard Upgrade (Online)

```sh
# Build the new program
anchor build

# Upgrade using Anchor (recommended for Anchor projects)
anchor upgrade --program-id <PROGRAM_ID> target/deploy/team.so

# Or use Solana CLI directly
solana program upgrade <BUFFER_PUBKEY> <PROGRAM_ID> --upgrade-authority <UPGRADE_AUTHORITY_KEYPAIR>
```

#### If the program binary is larger than the current allocation:

```sh
solana program extend <PROGRAM_ID> <ADDITIONAL_BYTES>
```

### 3. Using a Buffer Account (Multi-sig/Offline/DAO)

1. Write the new program to a buffer:
   ```sh
   solana program write-buffer target/deploy/team.so
   # Note the buffer pubkey output
   ```
2. (Optional) Set the buffer authority:
   ```sh
   solana program set-buffer-authority <BUFFER_PUBKEY> --new-buffer-authority <NEW_AUTHORITY>
   ```
3. Upgrade the program:
   ```sh
   solana program upgrade <BUFFER_PUBKEY> <PROGRAM_ID> --upgrade-authority <UPGRADE_AUTHORITY_KEYPAIR>
   ```

### 4. Upgrading with an Offline Signer

1. On an online machine, create the buffer and set buffer authority to the offline signer.
2. On the offline machine, sign the upgrade transaction:
   ```sh
   solana program upgrade <BUFFER_PUBKEY> <PROGRAM_ID> --sign-only --fee-payer <ONLINE_SIGNER_PUBKEY> --upgrade-authority <OFFLINE_SIGNER> --blockhash <RECENT_BLOCKHASH>
   ```
3. On the online machine, broadcast the signed transaction:
   ```sh
   solana program upgrade <BUFFER_PUBKEY> <PROGRAM_ID> --fee-payer <ONLINE_SIGNER> --upgrade-authority <OFFLINE_SIGNER_PUBKEY> --blockhash <RECENT_BLOCKHASH> --signer <OFFLINE_SIGNER_PUBKEY>:<OFFLINE_SIGNATURE>
   ```

### 5. Managing Upgrade Authority

- To change the upgrade authority:
  ```sh
  solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <NEW_AUTHORITY>
  # Or to make the program immutable (no further upgrades):
  solana program set-upgrade-authority <PROGRAM_ID> --final
  ```
- To check the current upgrade authority:
  ```sh
  solana program show <PROGRAM_ID>
  # Look for the 'Authority' field
  ```

### 6. Best Practices

- **Backup your upgrade authority keypair securely.**
- **Consider using a multisig or DAO for upgrade authority in production.**
- **Test upgrades on devnet before mainnet.**
- **If you want to prevent all future upgrades, set the program as immutable.**
- **If the upgrade fails due to insufficient space, use `solana program extend` or redeploy with a larger max length.**

### 7. Verifying Program Upgrades

After each program upgrade, verify that the new version is deployed correctly:

```sh
# Check program version information
solana program show <PROGRAM_ID>

# Dump the program binary and compare with your local binary
solana program dump <PROGRAM_ID> dumped_program.so
diff target/deploy/team.so dumped_program.so # Should show no differences

# Check program logs to ensure it's working correctly
# Run a simple transaction with your program and check logs:
solana logs <PROGRAM_ID> --commitment confirmed

# Verify via frontend/client by calling a function that uses new features
```

For critical upgrades, conduct a full suite of tests against the on-chain program to ensure all functionality works as expected.

---

## 6. SPL Token Creation & Configuration

- **Create the $TEAM mint**:

  ```sh
  spl-token create-token --owner /path/to/admin.json --decimals 9
  # Save the mint address as $TEAM_MINT (e.g., export TEAM_MINT=BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu)
  ```

  > **Note:** The wallet specified with `--owner` becomes the initial mint authority. Save this keypair securely, as it is required for metadata setup and to disable minting later.

- **Set CLI to use the mint authority keypair (REQUIRED for next steps):**

  ```sh
  solana config set --keypair /path/to/admin.json
  # Verify:
  solana address # Should match the mint authority public key
  ```

  > **Warning:** If you skip this step, setting metadata and disabling minting will fail with an `OwnerMismatch` error.

- **Create a token account for your admin/treasury wallet first:**

  ```sh
  spl-token create-account <TEAM_MINT>
  ```

- **Export the token account address:**

  ```sh
  export ADMIN_TOKEN_ACCOUNT_ADDRESS=<TOKEN_ACCOUNT_ADDRESS>
  # Save this token account address for minting (e.g., HiQzADiGbHkbyGwGuVux2zkFs1eFL1FLfjpTs9CFLbrJ)
  ```

  > **IMPORTANT:** In Solana, tokens must be sent to token accounts, not directly to wallet addresses. Each wallet needs a token account for each type of token it will hold.

- **Create token accounts for each vesting wallet (one-time per wallet per mint):**

  ```sh
  spl-token create-account <TEAM_MINT> --owner <WALLET_PUBKEY> --fee-payer /path/to/treasury.json
  ```

  **Arguments:**

  - `<TEAM_MINT>`: The mint address of your $TEAM SPL token (created in the previous step).
  - `--owner <WALLET_PUBKEY>`: The public key of the wallet that will own this token account (e.g., a dev, marketing, or presale wallet).
  - Run this command once for each wallet that will receive vested tokens.

  > **Note:**
  >
  > - This command creates a **standard SPL associated token account** for the specified wallet and the $TEAM mint. There is no special "vesting account type" at the token level; all accounts created this way are standard token accounts.
  > - **Vesting logic is enforced by the Anchor program, not by the token account type.** After creating the token account, you must initialize the vesting schedule for each wallet using the Anchor program's `initialize_vesting` instruction (see the Vesting Account Initialization section).
  > - You only need to run this command **once per wallet per mint**. If a wallet already has a token account for the $TEAM mint, you do not need to create it again.

- **Set up token metadata** (BEFORE minting initial supply):

  Create a script file named `complete-metadata.js` with the following content:

  ```javascript
  // This example uses @metaplex-foundation/js and @solana/web3.js
  // Install with: npm install @metaplex-foundation/js @solana/web3.js

  import { Metaplex } from '@metaplex-foundation/js'
  import { Connection, Keypair, PublicKey } from '@solana/web3.js'
  import fs from 'fs'

  async function setupTokenMetadata() {
    console.log('Connecting to Mainnet...')
    // Connect to your preferred RPC endpoint
    const connection = new Connection(process.env.RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY')

    console.log('Loading wallet keypair...')
    // Load the keypair (must be the mint authority)
    const keypairData = JSON.parse(fs.readFileSync('/path/to/admin.json', 'utf-8'))
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData))
    console.log(`Using keypair with public key: ${keypair.publicKey.toString()}`)

    // Load metadata from a JSON file (create this file with your token's metadata)
    console.log('Loading metadata from token-metadata.json...')
    const metadata = JSON.parse(fs.readFileSync('token-metadata.json', 'utf-8'))
    console.log('Metadata loaded:', metadata)

    // Initialize Metaplex with your connection and keypair
    const metaplex = Metaplex.make(connection).use({ identity: keypair })

    console.log('Uploading complete metadata to Arweave...')
    const { uri } = await metaplex.nfts().uploadMetadata(metadata)
    console.log(`Metadata uploaded successfully to: ${uri}`)

    // Your token mint address
    const mintAddress = new PublicKey(process.env.TEAM_MINT)
    console.log('Creating on-chain metadata...')

    const { response } = await metaplex.nfts().createSft({
      uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: 0, // No royalties
      isCollection: false,
      mintAddress
    })

    console.log('\n==== TOKEN METADATA CREATED SUCCESSFULLY ====')
    console.log(`Transaction signature: ${response.signature}`)
    console.log(`Explorer URL: https://explorer.solana.com/tx/${response.signature}`)
    console.log(`Token URL: https://explorer.solana.com/address/${mintAddress.toString()}`)

    console.log('\nMetadata Summary:')
    console.log(`- Name: ${metadata.name}`)
    console.log(`- Symbol: ${metadata.symbol}`)
    console.log(`- Description: ${metadata.description}`)
    console.log(`- Image: ${metadata.image}`)
    if (metadata.extensions?.website) console.log(`- Website: ${metadata.extensions.website}`)
    if (metadata.extensions?.x) console.log(`- X/Twitter: ${metadata.extensions.x}`)
    console.log(`- Complete Metadata URI: ${uri}`)

    console.log('\nToken metadata setup complete!')
  }

  setupTokenMetadata().catch(console.error)
  ```

  Create a `token-metadata.json` file with your token's metadata:

  ```json
  {
    "name": "Team556 Coin",
    "symbol": "TEAM",
    "description": "A secure Solana token designed for the firearms industry, offering lower fees, faster settlements, and enhanced privacy.",
    "image": "https://your-image-url.com/team556-logo.png",
    "external_url": "https://www.team556.com/",
    "extensions": {
      "website": "https://www.team556.com/",
      "x": "https://x.com/team556"
    }
  }
  ```

  Run the script to create the metadata:

  ```sh
  # Install required dependencies
  npm install @metaplex-foundation/js @solana/web3.js

  # Set environment variables
  export TEAM_MINT=your_mint_address_here
  export RPC_URL=your_rpc_url_here

  # Run the script
  node complete-metadata.js
  ```

  > **⚠️ CRITICAL:** You must set token metadata BEFORE minting your total supply. The metadata creation process requires mint authority permissions.

- **Mint the initial supply** (1B tokens):

  ```sh
  # List your token accounts to find your admin token account address
  spl-token accounts

  # Mint tokens to your admin token account (NOT directly to your wallet address)
  spl-token mint <TEAM_MINT> 1000000000 <ADMIN_TOKEN_ACCOUNT_ADDRESS>
  ```

  **Arguments:**

  - `<TEAM_MINT>`: The mint address of your $TEAM SPL token.
  - `1000000000`: The total number of tokens to mint in user-facing format. With 9 decimals, this represents 1 billion tokens.
  - `<ADMIN_TOKEN_ACCOUNT_ADDRESS>`: The token account address created for your admin wallet (NOT your wallet address).

  > **Note:**
  >
  > - $TEAM is a standard SPL token with **9 decimals**. The actual supply will be 1,000,000,000 × 10^9 = 1,000,000,000,000,000,000 in base units.
  > - **CRITICAL:** Never mint directly to a wallet address (e.g., Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK) - always mint to a token account.

- **Verify token configuration:**

  ```sh
  # Check the mint account information
  spl-token display <TEAM_MINT>

  # Expected output will include:
  # - Mint authority: <YOUR_WALLET> - Shows mint authority is still active
  # - Decimals: 9                  - Confirms decimal precision
  # - Supply: 1000000000000000000  - Confirms total supply (1B with 9 decimals)
  ```

- **Additional verification steps:**

  ```sh
  # List all your token accounts and balances
  spl-token accounts

  # Check a specific wallet's balance
  spl-token balance <TEAM_MINT> --owner <WALLET_PUBKEY>

  # Get detailed info about your token account
  spl-token account-info <TEAM_MINT>
  ```

> **TIP:** When using the commands above, replace `<TEAM_MINT>` with the actual mint address (e.g., BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu) unless you've exported it as an environment variable with `export TEAM_MINT=...`

## 7. Vesting Account Initialization

- **Use the Anchor client or CLI** to call `initialize_vesting` for each vesting wallet.
- **Schedules:**
  - **Dev (2 wallets, 25M each):** 5% at 2w, 15% at 24w, 30% at 30w, 50% at 36w
  - **Marketing (1 wallet, 100M):** 10% at 2w, 15% at 6w, 25% at 10w, 50% at 14w
  - **Presale 1 (172 wallets, 1M each):** 50% at 4w, 50% at 8w
  - **Presale 2 (100 wallets, 500k each):** 100% at 12w
- **Example TypeScript call:**
  ```ts
  await program.methods
    .initializeVesting(walletType, totalAmount, [
      { releaseTime: <UNIX_TIMESTAMP>, amount: <AMOUNT> },
      // ...
    ])
    .accounts({
      vestingAccount: <VESTING_ACCOUNT_PUBKEY>,
      admin: <ADMIN_PUBKEY>,
      beneficiary: <BENEFICIARY_PUBKEY>,
      mint: <TEAM_MINT_PUBKEY>,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([<ADMIN_KEYPAIR>])
    .rpc();
  ```
- **Automate** with a script for batch creation (recommended for presale wallets).
- **Verify** vesting accounts on-chain (explorer, Anchor client).

### Testing with CLI Commands

For testing purposes with a small number of wallets, you can use the following CLI commands:

#### Using Anchor CLI Directly

Anchor CLI provides a direct way to interact with your deployed program. First, ensure your `Anchor.toml` is properly configured with your deployed program ID and provider settings.

1. **Create a simple vesting initialization test instruction file** named `vesting-init.json`:

```json
{
  "walletType": "dev",
  "totalAmount": "25000000000000000",
  "schedule": [
    {
      "releaseTime": "1718035200",
      "amount": "1250000000000000"
    },
    {
      "releaseTime": "1750204800",
      "amount": "3750000000000000"
    },
    {
      "releaseTime": "1758153600",
      "amount": "7500000000000000"
    },
    {
      "releaseTime": "1765892800",
      "amount": "12500000000000000"
    }
  ]
}
```

2. **Execute the initialize_vesting instruction** using Anchor CLI:

```sh
# Generate a new keypair for the vesting account
solana-keygen new -o vesting_account.json --no-bip39-passphrase

# Execute the initialize_vesting instruction with Anchor CLI
anchor call \
  --program-id Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc \
  --provider.cluster mainnet \
  --provider.wallet mainnet-test-wallets/treasury.json \
  --filepath vesting-init.json \
  initialize_vesting '{ "vestingAccount": "$(solana-keygen pubkey vesting_account.json)", "admin": "Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK", "beneficiary": "EEdBK57zM4a44cGVr714hgLaVYwZNvTfsANSMkXG8GUj", "mint": "BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu", "systemProgram": "11111111111111111111111111111111" }' \
  --signer vesting_account.json
```

3. **Save the vesting account address for future reference**:

```sh
echo "Dev Vesting Account: $(solana-keygen pubkey vesting_account.json)" >> vesting-accounts.txt
```

#### Using a Shell Script for Multiple Wallets

For initializing vesting for multiple wallets, create a shell script:

1. **Create a shell script** named `initialize-vesting.sh`:

```bash
#!/bin/bash

# Program ID and token mint
PROGRAM_ID="Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc"
TEAM_MINT="BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu"
ADMIN_WALLET="mainnet-test-wallets/treasury.json"
ADMIN_PUBKEY="Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK"

# Get current timestamp
NOW=$(date +%s)
TWO_WEEKS=$((NOW + 14 * 24 * 60 * 60))
TWENTY_FOUR_WEEKS=$((NOW + 24 * 7 * 24 * 60 * 60))
THIRTY_WEEKS=$((NOW + 30 * 7 * 24 * 60 * 60))
THIRTY_SIX_WEEKS=$((NOW + 36 * 7 * 24 * 60 * 60))

# Dev wallets
DEV_WALLETS=(
  "EEdBK57zM4a44cGVr714hgLaVYwZNvTfsANSMkXG8GUj"
  "HmuxzkLkA76xy5E9SjoqeS2p2NtgR3p74dZwRcDopPYq"
)

# Amounts (25M tokens with 9 decimals)
TOTAL_AMOUNT="25000000000000000"
FIRST_AMOUNT=$((TOTAL_AMOUNT / 20))    # 5%
SECOND_AMOUNT=$((TOTAL_AMOUNT * 3 / 20)) # 15%
THIRD_AMOUNT=$((TOTAL_AMOUNT * 3 / 10))  # 30%
FOURTH_AMOUNT=$((TOTAL_AMOUNT / 2))    # 50%

# Process each dev wallet
for WALLET in "${DEV_WALLETS[@]}"; do
  echo "Initializing vesting for $WALLET..."

  # Create vesting account keypair
  VESTING_KEYPAIR="vesting_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")

  # Create instruction file
  cat > "vesting_${WALLET:0:8}.json" << EOF
{
  "walletType": "dev",
  "totalAmount": "$TOTAL_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$TWO_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$TWENTY_FOUR_WEEKS",
      "amount": "$SECOND_AMOUNT"
    },
    {
      "releaseTime": "$THIRTY_WEEKS",
      "amount": "$THIRD_AMOUNT"
    },
    {
      "releaseTime": "$THIRTY_SIX_WEEKS",
      "amount": "$FOURTH_AMOUNT"
    }
  ]
}
EOF

  # Execute initialize_vesting instruction
  echo "Executing initialize_vesting for $WALLET..."

  ARGS='{
    "vestingAccount": "'$VESTING_PUBKEY'",
    "admin": "'$ADMIN_PUBKEY'",
    "beneficiary": "'$WALLET'",
    "mint": "'$TEAM_MINT'",
    "systemProgram": "11111111111111111111111111111111"
  }'

  anchor call \
    --program-id "$PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet "$ADMIN_WALLET" \
    --filepath "vesting_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"

  # Save vesting account info
  echo "$WALLET: $VESTING_PUBKEY" >> vesting-accounts.txt

  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

echo "All vesting accounts initialized. Check vesting-accounts.txt for details."
```

2. **Make the script executable and run it**:

```sh
chmod +x initialize-vesting.sh
./initialize-vesting.sh
```

#### Using Solana CLI for Verification

After initializing vesting accounts, verify they were set up correctly using Solana CLI:

1. **Get vesting account data** (you'll need to know the account's data layout):

```sh
# Get the raw account data
solana account <VESTING_ACCOUNT_ADDRESS>

# Use Anchor CLI to decode the account data
anchor account <VESTING_ACCOUNT_ADDRESS> --provider.cluster mainnet
```

2. **Check program-owned accounts** to see all vesting accounts:

```sh
solana program show --programs --output json Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc | jq '.accounts'
```

3. **Monitor transactions** on the vesting account:

```sh
solana account --output json <VESTING_ACCOUNT_ADDRESS> | jq '.lamports'
```

### Bulk Testing with CSV Input

For larger scale testing with multiple wallets, you can process a CSV file:

1. **Create a CSV file** named `vesting-wallets.csv`:

```
type,wallet,amount
dev,EEdBK57zM4a44cGVr714hgLaVYwZNvTfsANSMkXG8GUj,25000000
dev,HmuxzkLkA76xy5E9SjoqeS2p2NtgR3p74dZwRcDopPYq,25000000
marketing,FCpvY7NSVpsbNMTeSiiC89UYM6gLLxNJrqercbVTs8zx,100000000
```

2. **Create a script to process CSV** named `process-vesting-csv.sh`:

```bash
#!/bin/bash

# Configuration
PROGRAM_ID="Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc"
TEAM_MINT="BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu"
ADMIN_WALLET="mainnet-test-wallets/treasury.json"
ADMIN_PUBKEY="Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK"
CSV_FILE="vesting-wallets.csv"
DECIMALS=9

# Get current timestamp
NOW=$(date +%s)

# Read CSV file and skip header
tail -n +2 "$CSV_FILE" | while IFS=, read -r TYPE WALLET AMOUNT; do
  echo "Processing $TYPE wallet: $WALLET with amount: $AMOUNT"

  # Convert amount to base units (with 9 decimals)
  BASE_AMOUNT=$((AMOUNT * 10**DECIMALS))

  # Generate vesting keypair
  VESTING_KEYPAIR="vesting_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")

  # Set vesting schedule based on wallet type
  if [ "$TYPE" == "dev" ]; then
    # Dev schedule: 5% at 2w, 15% at 24w, 30% at 30w, 50% at 36w
    TWO_WEEKS=$((NOW + 14 * 24 * 60 * 60))
    TWENTY_FOUR_WEEKS=$((NOW + 24 * 7 * 24 * 60 * 60))
    THIRTY_WEEKS=$((NOW + 30 * 7 * 24 * 60 * 60))
    THIRTY_SIX_WEEKS=$((NOW + 36 * 7 * 24 * 60 * 60))

    FIRST_AMOUNT=$((BASE_AMOUNT / 20))       # 5%
    SECOND_AMOUNT=$((BASE_AMOUNT * 3 / 20))  # 15%
    THIRD_AMOUNT=$((BASE_AMOUNT * 3 / 10))   # 30%
    FOURTH_AMOUNT=$((BASE_AMOUNT / 2))       # 50%

    # Create instruction file
    cat > "vesting_${WALLET:0:8}.json" << EOF
{
  "walletType": "dev",
  "totalAmount": "$BASE_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$TWO_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$TWENTY_FOUR_WEEKS",
      "amount": "$SECOND_AMOUNT"
    },
    {
      "releaseTime": "$THIRTY_WEEKS",
      "amount": "$THIRD_AMOUNT"
    },
    {
      "releaseTime": "$THIRTY_SIX_WEEKS",
      "amount": "$FOURTH_AMOUNT"
    }
  ]
}
EOF

  elif [ "$TYPE" == "marketing" ]; then
    # Marketing schedule: 10% at 2w, 15% at 6w, 25% at 10w, 50% at 14w
    TWO_WEEKS=$((NOW + 14 * 24 * 60 * 60))
    SIX_WEEKS=$((NOW + 6 * 7 * 24 * 60 * 60))
    TEN_WEEKS=$((NOW + 10 * 7 * 24 * 60 * 60))
    FOURTEEN_WEEKS=$((NOW + 14 * 7 * 24 * 60 * 60))

    FIRST_AMOUNT=$((BASE_AMOUNT / 10))      # 10%
    SECOND_AMOUNT=$((BASE_AMOUNT * 3 / 20)) # 15%
    THIRD_AMOUNT=$((BASE_AMOUNT / 4))       # 25%
    FOURTH_AMOUNT=$((BASE_AMOUNT / 2))      # 50%

    # Create instruction file
    cat > "vesting_${WALLET:0:8}.json" << EOF
{
  "walletType": "marketing",
  "totalAmount": "$BASE_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$TWO_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$SIX_WEEKS",
      "amount": "$SECOND_AMOUNT"
    },
    {
      "releaseTime": "$TEN_WEEKS",
      "amount": "$THIRD_AMOUNT"
    },
    {
      "releaseTime": "$FOURTEEN_WEEKS",
      "amount": "$FOURTH_AMOUNT"
    }
  ]
}
EOF
  fi

  # Execute initialize_vesting instruction
  echo "Executing initialize_vesting for $WALLET..."

  ARGS='{
    "vestingAccount": "'$VESTING_PUBKEY'",
    "admin": "'$ADMIN_PUBKEY'",
    "beneficiary": "'$WALLET'",
    "mint": "'$TEAM_MINT'",
    "systemProgram": "11111111111111111111111111111111"
  }'

  anchor call \
    --program-id "$PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet "$ADMIN_WALLET" \
    --filepath "vesting_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"

  # Save vesting account info
  echo "$TYPE,$WALLET,$AMOUNT,$VESTING_PUBKEY" >> vesting-accounts-results.csv

  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

echo "All vesting accounts initialized. Check vesting-accounts-results.csv for details."
```

3. **Make the script executable and run it**:

```sh
chmod +x process-vesting-csv.sh
./process-vesting-csv.sh
```

### Verification Commands

After initializing vesting accounts, verify they were set up correctly:

```sh
# List all vesting accounts saved during initialization
cat vesting-accounts.txt

# Get account data for a specific vesting account
anchor account <VESTING_ACCOUNT_ADDRESS> --provider.cluster mainnet

# Check for recent transactions involving your program
solana transaction-history --limit 10 Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK

# Verify account ownership
solana account <VESTING_ACCOUNT_ADDRESS> --output json | jq '.owner'
```

**Detailed verification steps:**

```sh
# Using Solana Explorer
# Visit https://explorer.solana.com/address/<VESTING_ACCOUNT_PUBKEY>?cluster=mainnet
# Should show account data owned by your program

# Check program-owned accounts
solana program show --programs --output json Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc

# Check vesting account details
solana account <VESTING_ACCOUNT_PUBKEY>
```

## 8. DEX Liquidity & LP Token Burning

- **Add liquidity to Raydium using the CLI**

You can add liquidity to Raydium pools directly from the command line using the [Raydium CLI](https://github.com/raydium-io/raydium-cli). This is useful for automation, scripting, or when you want to avoid using the web UI.

**Prerequisites:**

- You have created and funded your $TEAM and SOL (or USDC) token accounts.
- You have enough $TEAM and SOL/USDC in your accounts for the liquidity you want to provide.
- You have installed the Raydium CLI:
  ```sh
  npm install -g @raydium-io/raydium-cli
  ```
  **Arguments:**
  - `-g`: Installs the package globally so you can use the `raydium` command from anywhere.
  - `@raydium-io/raydium-cli`: The Raydium CLI npm package name.
- You know the pool address (AMM ID) for the $TEAM/SOL or $TEAM/USDC pool. (You can find this on Raydium's website or by searching Solana explorers.)

**Step-by-step:**

1. **Find or create the pool (if not already created):**

   - Most likely, you will be adding liquidity to an existing pool.
   - If the pool does not exist, you must create it first (see Raydium docs).

2. **Add liquidity:**

   ```sh
   raydium add-liquidity \
     --ammId <POOL_AMM_ID> \
     --tokenA <TEAM_TOKEN_MINT> \
     --tokenB <SOL_OR_USDC_MINT> \
     --amountA <AMOUNT_TEAM> \
     --amountB <AMOUNT_SOL_OR_USDC> \
     --owner wallets/treasury.json \
     --rpc https://devnet.helius-rpc.com/?api-key=5654c7b6-c88b-4cbf-a0aa-68fc3e84adb1
   ```

   **Arguments:**

   - `--ammId <POOL_AMM_ID>`: The Raydium AMM pool address for the $TEAM/SOL or $TEAM/USDC pair.
   - `--tokenA <TEAM_TOKEN_MINT>`: The mint address of your $TEAM token.
   - `--tokenB <SOL_OR_USDC_MINT>`: The mint address of the paired token (SOL or USDC).
   - `--amountA <AMOUNT_TEAM>`: The amount of $TEAM tokens to add as liquidity.
   - `--amountB <AMOUNT_SOL_OR_USDC>`: The amount of SOL or USDC to add as liquidity.
   - `--owner wallets/treasury.json`: The keypair file for the wallet providing liquidity (must have both tokens and SOL for fees).
   - `--rpc <URL>`: The Solana RPC endpoint to use (here, devnet with your Helius API key).

3. **Confirm the transaction:**

   - The CLI will output a transaction signature.
   - You can check the status on [Solana Explorer](https://explorer.solana.com/?cluster=devnet).

4. **Verify your LP tokens:**
   - After adding liquidity, you will receive LP tokens in your wallet.
   - Check your LP token account with:
     ```sh
     spl-token accounts
     ```
     **Arguments:**
     - This command lists all SPL token accounts owned by your wallet, including balances and mint addresses.

**Additional verification steps for liquidity addition:**

```sh
# Verify liquidity pool exists and contains your tokens
raydium info-pool --ammId <POOL_AMM_ID> --rpc <RPC_URL>
# Should show pool information including token balances

# Check pool on Raydium UI
# Visit https://raydium.io/liquidity/?ammId=<POOL_AMM_ID> (mainnet)
# or https://devnet.raydium.io/liquidity/?ammId=<POOL_AMM_ID> (devnet)
# Should show your pool with correct token balances
```

- **Burn all LP tokens** (official method):
  ```sh
  spl-token burn <LP_TOKEN_ACCOUNT_ADDRESS> <AMOUNT> --owner <YOUR_KEYPAIR>
  ```
  **Arguments:**
  - `<LP_TOKEN_ACCOUNT_ADDRESS>`: The address of your token account holding the LP tokens you want to burn.
  - `<AMOUNT>`: The number of LP tokens to burn (usually your full balance).
  - `--owner <YOUR_KEYPAIR>`: The keypair file for the wallet that owns the LP token account.

**Verify LP token burning:**

```sh
# Check your LP token balance after burning
spl-token accounts | grep <LP_TOKEN_MINT>
# Should show 0 balance or no matching accounts

# Alternatively, check specific account balance
spl-token balance <LP_TOKEN_MINT> --owner <YOUR_PUBKEY>
# Should return 0
```

## 9. Claiming Unlocked Tokens

- **Beneficiaries** call `claim_unlocked` to transfer unlocked tokens to their wallet.
- **Example TypeScript call:**
  ```ts
  await program.methods
    .claimUnlocked()
    .accounts({
      vestingAccount: <VESTING_ACCOUNT_PUBKEY>,
      authority: <BENEFICIARY_PUBKEY>,
      vestingTokenAccount: <VESTING_TOKEN_ACCOUNT>,
      destinationTokenAccount: <BENEFICIARY_TOKEN_ACCOUNT>,
      vestingSigner: <VESTING_SIGNER_PDA>,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([<BENEFICIARY_KEYPAIR>])
    .rpc();
  ```
- **Check** how much is claimable (schedule, on-chain state).
- **Verify** token transfers and balances.

**Detailed verification steps:**

```sh
# Check token balances before and after claiming
spl-token balance <TEAM_MINT> --owner <BENEFICIARY_PUBKEY>
# Should increase after claiming

# Verify vesting account state after claiming
await program.account.vestingAccount.fetch(vestingAccountPubkey);
// Check that claimed_amount has increased by the claimed amount

# Check transaction history
solana confirm -v <TRANSACTION_SIGNATURE>
# Should show successful transaction with token transfers

# Find claim transactions for a specific wallet
solana transaction-history <BENEFICIARY_PUBKEY> | grep -i <PROGRAM_ID>
# Should list all claim transactions

# Verify no more tokens can be claimed if not yet unlocked
# (Try claiming again and confirm it fails with the expected error)
```

## 10. Finalizing Token Setup

After completing all necessary token operations (setup, minting, distribution, vesting, DEX liquidity), you should disable minting to ensure the total supply remains fixed.

- **Disable minting** (enforce fixed supply):

  ```sh
  # Ensure you are using the mint authority keypair
  solana address # Should match the mint authority

  spl-token authorize <TEAM_MINT> mint --disable
  ```

  > **Note:**
  >
  > - This should be done as the final step after all token operations are complete
  > - You must sign with the current mint authority. If you get an `OwnerMismatch` error, verify your keypair configuration with `solana address`
  > - This action is irreversible - once you disable minting, you cannot add more tokens or add metadata through standard methods
  > - Keep the mint active if you need to perform more token operations, but always disable it before going to production

- **Verify mint is disabled:**

  ```sh
  # Check the mint account information
  spl-token display <TEAM_MINT>

  # Confirm "Mint authority: (not set)" in the output
  ```

This completes the token setup and ensures that no additional tokens can be minted in the future.
