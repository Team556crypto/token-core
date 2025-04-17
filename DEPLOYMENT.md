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
  - [6a. Setting Token Metadata](#6a-setting-token-metadata)
    - [Option 1: Using Metaplex Umi SDK (Recommended)](#option-1-using-metaplex-umi-sdk-recommended)
    - [Option 2: Using Metaplex JS SDK (Alternative)](#option-2-using-metaplex-js-sdk-alternative)
    - [Option 3: Using Solana Token Extensions (Newer Approach)](#option-3-using-solana-token-extensions-newer-approach)
    - [Verifying Metadata](#verifying-metadata)
  - [7. DEX Liquidity \& LP Token Burning](#7-dex-liquidity--lp-token-burning)
  - [8. Vesting Account Initialization](#8-vesting-account-initialization)
  - [9. Claiming Unlocked Tokens](#9-claiming-unlocked-tokens)

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
- **Deploy the program**:
  ```sh
  anchor deploy
  ```
- **Note the program ID** output by Anchor. Update your frontend/client as needed.
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
  # Save the mint address as $TEAM_MINT (e.g., export TEAM_MINT=3CPWoCJvtaSG4QhYHgzEFShzwLNnr6fh3PQURQF29ujs)
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
  # This creates a token account for your configured wallet (the admin)
  # Save this token account address for minting (e.g., J61s3yHFDvzVziM1nAsoWrTJmRo2Z5T2vahv4kMXHLgX)
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

- **Add token metadata BEFORE disabling minting**:

  **⚠️ CRITICAL: You must set token metadata BEFORE disabling minting (revoking mint authority). ⚠️**

  If you've already revoked mint authority, you'll need to create a new token and follow the correct order of operations. For existing tokens without metadata, consider using off-chain methods like token listing services to display metadata without requiring on-chain verification.

  **Follow this order:**

  1. Create token mint (done in previous step)
  2. Set up token metadata (detailed in section 6a below)
  3. THEN disable minting (next step)

  See the [Setting Token Metadata](#6a-setting-token-metadata) section below for detailed instructions on setting up token metadata. Complete that step now, before proceeding to disable minting.

- **Disable minting** (enforce fixed supply):

  ```sh
  # Ensure you are using the mint authority keypair (see above)
  solana address # Should match the mint authority

  spl-token authorize <TEAM_MINT> mint --disable
  ```

  > **Note:**
  >
  > - You must sign with the current mint authority. If you get an `OwnerMismatch` error, verify your keypair configuration with `solana address`.
  > - This action is irreversible - once you disable minting, you cannot add more tokens or add metadata through standard methods.

- **Verify token configuration:**

  ```sh
  # Check the mint account information
  spl-token display <TEAM_MINT>

  # Expected output will include:
  # - Mint authority: (not set)  - Confirms minting is disabled
  # - Decimals: 9               - Confirms decimal precision
  # - Supply: 1000000000000000000 - Confirms total supply (1B with 9 decimals)
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

> **TIP:** When using the commands above, replace `<TEAM_MINT>` with the actual mint address (e.g., 3CPWoCJvtaSG4QhYHgzEFShzwLNnr6fh3PQURQF29ujs) unless you've exported it as an environment variable with `export TEAM_MINT=...`

## 6a. Setting Token Metadata

There are several approaches to adding metadata to your $TEAM token. The approach in the original guide using `@metaplex/cli` is no longer available as that package has been deprecated. Here are the current methods:

### Option 1: Using Metaplex Umi SDK (Recommended)

This is the modern, recommended approach using Metaplex's newer Umi framework.

**Prerequisites:**

```sh
# Install required dependencies
npm install @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/mpl-token-metadata @metaplex-foundation/umi-uploader-irys
```

**Create a script called `set-token-metadata.js` (or `.ts` if using TypeScript):**

```javascript
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createFungible, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { keypairIdentity, percentAmount, createGenericFile } from '@metaplex-foundation/umi'
import fs from 'fs'

async function createTokenMetadata() {
  // Initialize Umi with your RPC provider (can use Metaplex Aura for higher rate limits)
  const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata()).use(irysUploader())

  // Load your keypair
  const keypairFile = fs.readFileSync('/path/to/admin.json', 'utf8')
  const secretKey = new Uint8Array(JSON.parse(keypairFile))
  const signer = umi.eddsa.createKeypairFromSecretKey(secretKey)
  umi.use(keypairIdentity(signer))

  // Read token image and prepare for upload
  const imageFile = fs.readFileSync('/path/to/logo.png')
  const umiImage = createGenericFile(imageFile, 'team-logo.png', {
    tags: [{ name: 'Content-Type', value: 'image/png' }]
  })

  // Upload image to Arweave/IPFS via Irys
  console.log('Uploading image...')
  const imageUri = await umi.uploader.upload([umiImage])
  console.log('Image uploaded:', imageUri[0])

  // Create and upload metadata JSON
  const metadata = {
    name: 'Team556 Coin',
    symbol: 'TEAM',
    description:
      'A secure Solana token designed for the firearms industry, offering lower fees, faster settlements, and enhanced privacy.',
    image: imageUri[0],
    external_url: 'https://www.team556.com/',
    attributes: [
      {
        trait_type: 'Total Supply',
        value: '1,000,000,000'
      },
      {
        trait_type: 'Blockchain',
        value: 'Solana'
      }
    ]
  }

  // Upload metadata to Arweave/IPFS
  console.log('Uploading metadata...')
  const metadataUri = await umi.uploader.uploadJson(metadata)
  console.log('Metadata uploaded:', metadataUri)

  // Now you can create your token with this metadata
  // For an existing token, you would use the updateMetadata function instead
  console.log('Setting metadata for token mint:', process.env.TEAM_MINT)

  // Return the metadata URI for reference
  return metadataUri
}

createTokenMetadata()
  .then(uri => console.log('Process complete. Metadata URI:', uri))
  .catch(error => console.error('Error:', error))
```

**Run the script:**

```sh
node set-token-metadata.js
```

### Option 2: Using Metaplex JS SDK (Alternative)

If you prefer a slightly simpler approach using the older Metaplex JS SDK:

**Prerequisites:**

```sh
npm install @metaplex-foundation/js @solana/web3.js
```

**Create a script called `set-metadata-js.js`:**

```javascript
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import fs from 'fs'

async function setTokenMetadata() {
  // Connect to Solana
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

  // Load your keypair
  const keypairFile = fs.readFileSync('/path/to/admin.json', 'utf8')
  const secretKey = new Uint8Array(JSON.parse(keypairFile))
  const keypair = Keypair.fromSecretKey(secretKey)

  // Initialize Metaplex
  const metaplex = Metaplex.make(connection).use(keypairIdentity(keypair))

  // Your token mint address
  const mintAddress = new PublicKey(process.env.TEAM_MINT || 'YOUR_MINT_ADDRESS')

  // Upload image (bundled in SDK)
  const imageBuffer = fs.readFileSync('/path/to/logo.png')
  const imageMetadata = await metaplex.nfts().uploadMetadataAsset({ file: imageBuffer })
  console.log('Image uploaded:', imageMetadata.uri)

  // Create and upload metadata
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: 'Team556 Coin',
    symbol: 'TEAM',
    description: 'A secure Solana token designed for the firearms industry.',
    image: imageMetadata.uri,
    external_url: 'https://www.team556.com/',
    attributes: [
      {
        trait_type: 'Total Supply',
        value: '1,000,000,000'
      }
    ]
  })
  console.log('Metadata uploaded:', uri)

  // Create metadata for the token
  const { response } = await metaplex.nfts().createSft({
    uri,
    name: 'Team556',
    symbol: 'TEAM',
    sellerFeeBasisPoints: 0, // No royalties
    isCollection: false,
    mintAddress: mintAddress
  })

  console.log('Metadata transaction:', response.signature)
  console.log('View on explorer:', `https://explorer.solana.com/tx/${response.signature}?cluster=devnet`)
}

setTokenMetadata()
  .then(() => console.log('Token metadata created successfully'))
  .catch(error => console.error('Error:', error))
```

### Option 3: Using Solana Token Extensions (Newer Approach)

For new tokens, you can also use the Token-2022 program with the metadata extension. This is different from Metaplex's metadata and is integrated directly with the token.

```sh
# Create a token with metadata extension
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-metadata --decimals 9

# Initialize the metadata
spl-token initialize-metadata <TOKEN_MINT_ADDRESS> "Team556" "TEAM" "https://example.com/team556.json"
```

### Verifying Metadata

After setting up metadata using any of these methods, you can verify it:

For Metaplex metadata:

```sh
# Using Solana Explorer
# Visit https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
# Look for the "Metadata" tab

# Or fetch programmatically
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');
async function getMetadata() {
  const connection = new Connection('https://api.devnet.solana.com');
  const metaplex = Metaplex.make(connection);
  const mint = new PublicKey('YOUR_MINT_ADDRESS');
  const nft = await metaplex.nfts().findByMint({ mintAddress: mint });
  console.log(nft);
}
getMetadata();
"
```

For Token-2022 metadata:

```sh
spl-token display-metadata <TOKEN_MINT_ADDRESS>
```

---

## 7. DEX Liquidity & LP Token Burning

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

---

## 8. Vesting Account Initialization

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

**Detailed verification steps:**

```sh
# Using Anchor client to verify vesting account state
await program.account.vestingAccount.fetch(vestingAccountPubkey);
// Check the returned data has the correct:
// - beneficiary
// - total amount
// - claimed amount (should be 0 initially)
// - vesting schedule (milestones with correct timestamps and amounts)

# Using Solana Explorer
# Visit https://explorer.solana.com/address/<VESTING_ACCOUNT_PUBKEY>?cluster=devnet
# Should show account data owned by your program

# Programmatically check multiple accounts (example script)
const vestingAccounts = await program.account.vestingAccount.all();
console.log(`Found ${vestingAccounts.length} vesting accounts`);
vestingAccounts.forEach(acct => {
  console.log(`Beneficiary: ${acct.account.beneficiary.toBase58()}`);
  console.log(`Total Amount: ${acct.account.totalAmount}`);
  console.log(`Claimed Amount: ${acct.account.claimedAmount}`);
  console.log(`Schedule: `, acct.account.schedule);
});
```

---

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
