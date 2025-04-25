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
    - [7.1 Prerequisites](#71-prerequisites)
    - [7.2 Initializing Vesting Accounts Using TypeScript Client](#72-initializing-vesting-accounts-using-typescript-client)
    - [7.4 Fund the Vesting Token Accounts](#74-fund-the-vesting-token-accounts)
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

After token creation and distribution, you must initialize vesting accounts for each wallet type (Dev, Marketing, Presale1, Presale2) to enforce vesting schedules defined in the whitepaper. **Only the admin wallet can initialize vesting accounts.**

### 7.1 Prerequisites

- The Anchor program is deployed
- SPL token is created and tokens are minted
- Token accounts are created for all beneficiary wallets
- Admin wallet (specified in `ADMIN_PUBKEY` in the program) has SOL for transaction fees

### 7.2 Initializing Vesting Accounts Using TypeScript Client

The project includes dedicated TypeScript scripts in the `scripts/` directory to automate vesting account initialization for each allocation type. This approach is more maintainable and less error-prone than manual initialization.

#### Setup Prerequisites

1. **Install Dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```

2. **Create `.env` File:**
   Create a `.env` file in the project root directory with the following variables:
   ```dotenv
   # RPC URL (use Devnet for testing, Mainnet for production)
   RPC_URL=https://api.mainnet-beta.solana.com
   # RPC_URL=https://api.devnet.solana.com
   # RPC_URL=http://127.0.0.1:8899  # Local validator

   # Path to the admin keypair file (must match ADMIN_PUBKEY in the program)
   ADMIN_KEYPAIR_PATH=/path/to/admin-wallet.json

   # Deployed Program ID
   PROGRAM_ID=Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc

   # $TEAM Token Mint Address
   MINT_ADDRESS=BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu

   # Token Decimals (usually 9 for Solana SPL tokens)
   TOKEN_DECIMALS=9

   # Beneficiary Wallet Addresses
   DEV_WALLET=DevTeamPubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   MARKETING_WALLET=MarketingPubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   PRESALE1_WALLET=Presale1PubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   PRESALE2_WALLET=Presale2PubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

   # Total Vesting Amounts (in UI format, not raw lamports)
   DEV_TOTAL_AMOUNT=100000000    # e.g., 100 million tokens
   MARKETING_TOTAL_AMOUNT=50000000
   PRESALE1_TOTAL_AMOUNT=100000000
   PRESALE2_TOTAL_AMOUNT=50000000
   ```

3. **Verify Admin Token Balance:**
   Ensure the admin wallet has sufficient $TEAM tokens before initializing vesting accounts. The tokens will be transferred from this wallet to each vesting PDA's associated token account during initialization.
   ```sh
   spl-token balance <MINT_ADDRESS> --owner <ADMIN_PUBKEY>
   ```

#### Running the Initialization Scripts

Each vesting type has its own dedicated initialization script with appropriate vesting schedules defined according to the tokenomics:

1. **Dev Team Vesting (10%, 12-month cliff):**
   ```sh
   npx ts-node scripts/initializeDevVesting.ts
   ```

2. **Marketing Vesting (5%, gradual release):**
   ```sh
   npx ts-node scripts/initializeMarketingVesting.ts
   ```

3. **Presale 1 Vesting (10%, two releases):**
   ```sh
   npx ts-node scripts/initializePresale1Vesting.ts
   ```

4. **Presale 2 Vesting (5%, TGE + gradual release):**
   ```sh
   npx ts-node scripts/initializePresale2Vesting.ts
   ```

Each script will:
- Read configuration from the `.env` file
- Derive the vesting account PDAs and token accounts
- Create the necessary associated token accounts if they don't exist
- Submit the initialization transaction
- Log the transaction signature and important account addresses

**Example Output:**
```
--- Initializing Dev Vesting ---
Beneficiary: DevTeamPubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Total Amount: 100000000000000000 (100000000)
Schedule: [{"releaseTime":"1782086400","amount":"100000000000000000"}]
Vesting Account PDA: 8zJAzuEyL7RsvgCdQGMvRVvDjQz5rpWRFUkCJKJ7xyiZ
Admin ATA: EoCo8zx6fZiAmwNxG3MvXhwkjgKja38RpLce8jzUQxMj
Vesting ATA: 3xgKv5aCvNKRGBYkcQoLrwJxQUJyrrQJ4bQLKHkBnwez
Initialization transaction signature 5VrdHS9hNVQbB2pT4RcqHPrVowguo3gmHf89er2qhXrEZBsXxegFr4UyWkJ2YWSB65atpqL6MfHZ9iGeiJrGBzZF
Dev vesting initialized successfully!
```

#### Verification

After running the initialization scripts, you can verify the vesting accounts using the provided `readVestingAccount.ts` script:

```sh
# Replace <VESTING_PDA> with the vesting account address output from the initialization script
npx ts-node scripts/readVestingAccount.ts --pda <VESTING_PDA>
```

This will display:
- Beneficiary wallet address
- Total and claimed token amounts
- Vesting schedule with release dates
- Wallet type (Dev, Marketing, Presale1, Presale2)
- Other vesting account details

**Example Output:**
```
--- Reading Vesting Account: 8zJAzuEyL7RsvgCdQGMvRVvDjQz5rpWRFUkCJKJ7xyiZ ---
Beneficiary (Authority): DevTeamPubkeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Mint: BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu
Wallet Type: Dev
Total Amount: 100000000000000000 (raw) / 100000000 (ui)
Claimed Amount: 0 (raw) / 0 (ui)
Bump: 255
Schedule:
  [0] Release Time: 1782086400 (2026-06-18T20:00:00.000Z)
      Amount: 100000000000000000 (raw) / 100000000 (ui)
```

You can also check token balances:
```sh
# Check the vesting token account balance
spl-token balance <MINT_ADDRESS> --owner <VESTING_PDA>

# Check admin wallet balance after transfers
spl-token balance <MINT_ADDRESS> --owner <ADMIN_PUBKEY>
```

### 7.4 Fund the Vesting Token Accounts

The initialization scripts automatically create and fund the vesting token accounts as part of the process. The scripts perform these steps:

1. Derive the PDA for each vesting account using the beneficiary address
2. Create the associated token account for the vesting PDA (if it doesn't exist)
3. Transfer the specified token amount from the admin wallet to the vesting token account

However, if you need to manually fund these accounts or add additional tokens, follow these steps:

1. **Get the vesting account PDA:**
   ```sh
   # Run the readVestingAccount script to view the PDA
   npx ts-node scripts/readVestingAccount.ts --pda <VESTING_PDA>
   ```
   or derive it manually:
   ```sh
   solana address --keypair /path/to/admin.json -s "[\"vesting\",\"<BENEFICIARY_PUBKEY>\"]" -k <PROGRAM_ID>
   ```

2. **Get the vesting account's associated token account:**
   ```sh
   spl-token accounts <VESTING_PDA> --verbose
   ```

3. **Transfer additional tokens if needed:**
   ```sh
   spl-token transfer <MINT_ADDRESS> <AMOUNT> <VESTING_TOKEN_ACCOUNT> --from <ADMIN_TOKEN_ACCOUNT> --fee-payer <ADMIN_KEYPAIR>
   ```

### Verification Commands

After initializing vesting accounts, verify they were set up correctly:

```sh
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

- **Add liquidity to Raydium**
  Add liquidity via the Raydium web UI

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

## 9. Automated Token Distribution

Instead of requiring beneficiaries to claim tokens manually, this system uses an automated approach where tokens are distributed periodically to eligible accounts. This design improves user experience by eliminating the need for manual claiming.

### Automated Distribution System

The automated token distribution system works as follows:

1. **Scheduled Execution**
   - A batch script runs on a schedule (e.g., daily, weekly)
   - The script is executed by an administrator or automated service

2. **Account Discovery**
   - All vesting accounts in the program are scanned
   - Each account's vesting schedule is checked against the current time
   
3. **Automatic Processing**
   - For accounts with unlocked tokens, automated distribution occurs
   - Tokens are transferred from the vesting account to the beneficiary's wallet
   - Transaction records are maintained for auditing

### Required Program Modifications

To implement automated distribution, the Anchor program must be modified to include an admin distribution function:

```rust
// Add this function to lib.rs
pub fn admin_distribute_unlocked(ctx: Context<AdminDistribute>) -> Result<()> {
    // Verify admin authorization
    require_keys_eq!(
        ctx.accounts.admin.key(),
        Pubkey::from_str(ADMIN_PUBKEY).unwrap(),
        VestingError::Unauthorized
    );
    
    // Calculate unlocked amount (similar to claim_unlocked logic)
    let now = Clock::get()?.unix_timestamp as u64;
    let vesting = &mut ctx.accounts.vesting_account;
    
    // Calculate claimable amount
    let mut unlocked_amount = 0;
    for schedule_item in vesting.schedule.iter() {
        if now >= schedule_item.release_time {
            unlocked_amount += schedule_item.amount;
        }
    }
    
    // Subtract already claimed
    let claimable = unlocked_amount.checked_sub(vesting.claimed_amount)
        .ok_or(VestingError::NothingToClaim)?;
    
    if claimable == 0 {
        return err!(VestingError::NothingToClaim);
    }
    
    // Transfer tokens
    let seeds = &[
        b"vesting".as_ref(),
        vesting.authority.as_ref(),
        &[vesting.bump],
    ];
    let signer = &[&seeds[..]]; 
    
    // Execute the transfer
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vesting_token_account.to_account_info(),
                to: ctx.accounts.destination_token_account.to_account_info(),
                authority: ctx.accounts.vesting_signer.to_account_info(),
            },
            signer,
        ),
        claimable,
    )?;
    
    // Update claimed amount
    vesting.claimed_amount = vesting.claimed_amount.checked_add(claimable)
        .ok_or(VestingError::MathOverflow)?;
        
    msg!("Admin distributed {} tokens to {}", claimable, vesting.authority);
    
    Ok(())
}
```

Add the corresponding account validation struct:

```rust
#[derive(Accounts)]
pub struct AdminDistribute<'info> {
    /// The admin account (must match ADMIN_PUBKEY)
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// The vesting account
    #[account(mut)]
    pub vesting_account: Account<'info, VestingAccount>,
    
    /// The beneficiary
    /// CHECK: We're only using this for reference, not signing
    pub authority: UncheckedAccount<'info>,
    
    /// The vesting token account (source)
    #[account(mut, 
        constraint = vesting_token_account.mint == vesting_account.mint,
        constraint = vesting_token_account.owner == vesting_signer.key()
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,
    
    /// The destination token account (beneficiary's account)
    #[account(mut, 
        constraint = destination_token_account.mint == vesting_account.mint,
        constraint = destination_token_account.owner == vesting_account.authority
    )]
    pub destination_token_account: Account<'info, TokenAccount>,
    
    /// The vesting PDA acting as signer
    /// CHECK: This is checked in the constraint
    #[account(seeds = [b"vesting", vesting_account.authority.as_ref()], bump = vesting_account.bump)]
    pub vesting_signer: UncheckedAccount<'info>,
    
    /// The token program
    pub token_program: Program<'info, Token>,
}
```

### Batch Processing Script

The repository includes a script for automated distribution in `scripts/batchReleaseTokens.ts`. This script:

1. Scans all vesting accounts managed by the program
2. Identifies accounts with unlocked, unclaimed tokens
3. Processes distribution for all eligible accounts
4. Generates detailed logs for tracking and auditing

To run the batch distribution process:

```sh
# Daily/weekly job to release tokens to all eligible accounts
npx ts-node scripts/batchReleaseTokens.ts
```

The script produces a log file in the `logs` directory with the timestamp, transaction details, and summary statistics.

### Configuration and Scheduling

For production deployment, set up the batch distribution to run automatically:

1. **Using Cron (Linux/Unix/macOS):**
   ```sh
   # Run daily at 2 AM
   0 2 * * * cd /path/to/token-core && npx ts-node scripts/batchReleaseTokens.ts >> /path/to/token-core/logs/cron.log 2>&1
   ```

2. **Using Task Scheduler (Windows):**
   - Create a scheduled task that runs the script using a batch file
   - Set the desired frequency (daily/weekly)

3. **Using Cloud Services:**
   - AWS Lambda with EventBridge trigger
   - Google Cloud Functions with Cloud Scheduler
   - Azure Functions with Timer trigger

### Verification and Monitoring

After each batch run, verify the distribution results:

```sh
# View the latest distribution log
cat logs/batch-release-<latest-timestamp>.log

# Check specific beneficiary's token balance
spl-token balance <MINT_ADDRESS> --owner <BENEFICIARY_PUBKEY>

# View vesting account state
npx ts-node scripts/readVestingAccount.ts --pda <VESTING_PDA_ADDRESS>
```

### Verifying Claims

After claiming tokens, verify the following:
1. Beneficiary's token account balance has increased
2. Vesting account's token account balance has decreased
3. The claimed_amount in the vesting account state has been updated

To check the vesting account's state after claiming:
```sh
npx ts-node scripts/readVestingAccount.ts --pda <VESTING_PDA_ADDRESS>
```

**Detailed verification steps:**

```sh
# Check beneficiary's token balance
spl-token balance <MINT_ADDRESS> --owner <BENEFICIARY_PUBKEY>

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
