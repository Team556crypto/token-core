#!/bin/bash

# Program ID and token mint
PROGRAM_ID="Dh1XbaChDA7daGUncgRgDHFRDjGqd953PhxcHQvU8Qrc"
TEAM_MINT="BomWBaPd9hm58Qgyb3uBube7uUrXmPs9D9ApkVRw2gyu"
ADMIN_WALLET="wallets/treasury.json"
ADMIN_PUBKEY="Azo57NjfCLHjfztDkDmrDLNN4CxLByVa8QSBqJEZUXDK"

# Get current timestamp
NOW=$(date +%s)

# Dev schedule: 5% at 2w, 15% at 24w, 30% at 30w, 50% at 36w
DEV_TWO_WEEKS=$((NOW + 14 * 24 * 60 * 60))
DEV_TWENTY_FOUR_WEEKS=$((NOW + 24 * 7 * 24 * 60 * 60))
DEV_THIRTY_WEEKS=$((NOW + 30 * 7 * 24 * 60 * 60))
DEV_THIRTY_SIX_WEEKS=$((NOW + 36 * 7 * 24 * 60 * 60))

# Marketing schedule: 10% at 2w, 15% at 6w, 25% at 10w, 50% at 14w
MARKETING_TWO_WEEKS=$((NOW + 14 * 24 * 60 * 60))
MARKETING_SIX_WEEKS=$((NOW + 6 * 7 * 24 * 60 * 60))
MARKETING_TEN_WEEKS=$((NOW + 10 * 7 * 24 * 60 * 60))
MARKETING_FOURTEEN_WEEKS=$((NOW + 14 * 7 * 24 * 60 * 60))

# Presale1 schedule: 50% at 4w, 50% at 8w
PRESALE1_FOUR_WEEKS=$((NOW + 4 * 7 * 24 * 60 * 60))
PRESALE1_EIGHT_WEEKS=$((NOW + 8 * 7 * 24 * 60 * 60))

# Presale2 schedule: 100% at 12w
PRESALE2_TWELVE_WEEKS=$((NOW + 12 * 7 * 24 * 60 * 60))

# Dev wallets - Add your wallet addresses here
DEV_WALLETS=(
  "EEdBK57zM4a44cGVr714hgLaVYwZNvTfsANSMkXG8GUj"
  "HmuxzkLkA76xy5E9SjoqeS2p2NtgR3p74dZwRcDopPYq"
)

# Marketing wallets - Add your wallet addresses here
MARKETING_WALLETS=(
  "FCpvY7NSVpsbNMTeSiiC89UYM6gLLxNJrqercbVTs8zx"
)

# Presale1 wallets - Add your wallet addresses here (example)
PRESALE1_WALLETS=(
  "6dT8yViP7A735CmQUTUpS2dCwwbryhuH1buBwLegydnw"
)

# Presale2 wallets - Add your wallet addresses here (example)
PRESALE2_WALLETS=(
  "2trUbdP6ZS9Uj4qKyDrdCJfWkjnGaXU4KMLgE9kTkLxT"
)

# Amount configuration (with 9 decimals)
# Dev wallets - 25M tokens each
DEV_TOTAL_AMOUNT="25000000000000000"
# Marketing wallet - a single wallet with 100M tokens
MARKETING_TOTAL_AMOUNT="100000000000000000"
# Presale1 wallets - 1M tokens each
PRESALE1_TOTAL_AMOUNT="1000000000000000"
# Presale2 wallets - 500k tokens each
PRESALE2_TOTAL_AMOUNT="500000000000000"

echo "============================================="
echo "Team556 Vesting Account Initialization Script"
echo "============================================="
echo "Program ID: $PROGRAM_ID"
echo "Token Mint: $TEAM_MINT"
echo "Admin: $ADMIN_PUBKEY"
echo "Network: MAINNET"
echo "Date: $(date)"
echo "============================================="

# Create results file with headers
echo "type,wallet,total_amount,vesting_account" > vesting-accounts-results.csv

# Process each dev wallet
echo "Processing dev wallets..."
for WALLET in "${DEV_WALLETS[@]}"; do
  echo "Initializing vesting for $WALLET..."
  
  # Calculate amounts for each milestone
  FIRST_AMOUNT=$((DEV_TOTAL_AMOUNT / 20))    # 5%
  SECOND_AMOUNT=$((DEV_TOTAL_AMOUNT * 3 / 20)) # 15%
  THIRD_AMOUNT=$((DEV_TOTAL_AMOUNT * 3 / 10))  # 30%
  FOURTH_AMOUNT=$((DEV_TOTAL_AMOUNT / 2))    # 50%
  
  # Create vesting account keypair
  VESTING_KEYPAIR="vesting_dev_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")
  
  # Create instruction file
  cat > "vesting_dev_${WALLET:0:8}.json" << EOF
{
  "walletType": "dev",
  "totalAmount": "$DEV_TOTAL_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$DEV_TWO_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$DEV_TWENTY_FOUR_WEEKS",
      "amount": "$SECOND_AMOUNT"
    },
    {
      "releaseTime": "$DEV_THIRTY_WEEKS",
      "amount": "$THIRD_AMOUNT"
    },
    {
      "releaseTime": "$DEV_THIRTY_SIX_WEEKS",
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
    --filepath "vesting_dev_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"
  
  # Save vesting account info
  echo "dev,$WALLET,$DEV_TOTAL_AMOUNT,$VESTING_PUBKEY" >> vesting-accounts-results.csv
  
  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

# Process each marketing wallet
echo "Processing marketing wallets..."
for WALLET in "${MARKETING_WALLETS[@]}"; do
  echo "Initializing vesting for $WALLET..."
  
  # Calculate amounts for each milestone
  FIRST_AMOUNT=$((MARKETING_TOTAL_AMOUNT / 10))      # 10%
  SECOND_AMOUNT=$((MARKETING_TOTAL_AMOUNT * 3 / 20)) # 15%
  THIRD_AMOUNT=$((MARKETING_TOTAL_AMOUNT / 4))       # 25%
  FOURTH_AMOUNT=$((MARKETING_TOTAL_AMOUNT / 2))      # 50%
  
  # Create vesting account keypair
  VESTING_KEYPAIR="vesting_marketing_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")
  
  # Create instruction file
  cat > "vesting_marketing_${WALLET:0:8}.json" << EOF
{
  "walletType": "marketing",
  "totalAmount": "$MARKETING_TOTAL_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$MARKETING_TWO_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$MARKETING_SIX_WEEKS",
      "amount": "$SECOND_AMOUNT"
    },
    {
      "releaseTime": "$MARKETING_TEN_WEEKS",
      "amount": "$THIRD_AMOUNT"
    },
    {
      "releaseTime": "$MARKETING_FOURTEEN_WEEKS",
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
    --filepath "vesting_marketing_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"
  
  # Save vesting account info
  echo "marketing,$WALLET,$MARKETING_TOTAL_AMOUNT,$VESTING_PUBKEY" >> vesting-accounts-results.csv
  
  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

# Process each presale1 wallet
echo "Processing presale1 wallets..."
for WALLET in "${PRESALE1_WALLETS[@]}"; do
  echo "Initializing vesting for $WALLET..."
  
  # Calculate amounts for each milestone
  FIRST_AMOUNT=$((PRESALE1_TOTAL_AMOUNT / 2))  # 50%
  SECOND_AMOUNT=$((PRESALE1_TOTAL_AMOUNT / 2)) # 50%
  
  # Create vesting account keypair
  VESTING_KEYPAIR="vesting_presale1_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")
  
  # Create instruction file
  cat > "vesting_presale1_${WALLET:0:8}.json" << EOF
{
  "walletType": "presale1",
  "totalAmount": "$PRESALE1_TOTAL_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$PRESALE1_FOUR_WEEKS",
      "amount": "$FIRST_AMOUNT"
    },
    {
      "releaseTime": "$PRESALE1_EIGHT_WEEKS",
      "amount": "$SECOND_AMOUNT"
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
    --filepath "vesting_presale1_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"
  
  # Save vesting account info
  echo "presale1,$WALLET,$PRESALE1_TOTAL_AMOUNT,$VESTING_PUBKEY" >> vesting-accounts-results.csv
  
  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

# Process each presale2 wallet
echo "Processing presale2 wallets..."
for WALLET in "${PRESALE2_WALLETS[@]}"; do
  echo "Initializing vesting for $WALLET..."
  
  # Calculate amount (100% at 12 weeks)
  AMOUNT="$PRESALE2_TOTAL_AMOUNT"
  
  # Create vesting account keypair
  VESTING_KEYPAIR="vesting_presale2_${WALLET:0:8}.json"
  solana-keygen new -o "$VESTING_KEYPAIR" --no-bip39-passphrase
  VESTING_PUBKEY=$(solana-keygen pubkey "$VESTING_KEYPAIR")
  
  # Create instruction file
  cat > "vesting_presale2_${WALLET:0:8}.json" << EOF
{
  "walletType": "presale2",
  "totalAmount": "$PRESALE2_TOTAL_AMOUNT",
  "schedule": [
    {
      "releaseTime": "$PRESALE2_TWELVE_WEEKS",
      "amount": "$AMOUNT"
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
    --filepath "vesting_presale2_${WALLET:0:8}.json" \
    initialize_vesting "$ARGS" \
    --signer "$VESTING_KEYPAIR"
  
  # Save vesting account info
  echo "presale2,$WALLET,$PRESALE2_TOTAL_AMOUNT,$VESTING_PUBKEY" >> vesting-accounts-results.csv
  
  echo "Vesting initialized for $WALLET at account $VESTING_PUBKEY"
  echo "-------------------"
done

echo "All vesting accounts initialized. Results saved to vesting-accounts-results.csv"
echo "Make sure to save all vesting account keypairs in a secure location!" 