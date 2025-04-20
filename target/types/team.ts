export type Team = {
  "version": "0.1.0",
  "name": "team",
  "instructions": [
    {
      "name": "initializeVesting",
      "accounts": [
        {
          "name": "vestingAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "The wallet that will receive the vested tokens"
          ]
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "walletType",
          "type": {
            "defined": "WalletType"
          }
        },
        {
          "name": "totalAmount",
          "type": "u64"
        },
        {
          "name": "schedule",
          "type": {
            "vec": {
              "defined": "VestingSchedule"
            }
          }
        }
      ]
    },
    {
      "name": "claimUnlocked",
      "accounts": [
        {
          "name": "vestingAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "vestingTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vestingSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "vestingAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "claimedAmount",
            "type": "u64"
          },
          {
            "name": "schedule",
            "type": {
              "vec": {
                "defined": "VestingSchedule"
              }
            }
          },
          {
            "name": "walletType",
            "type": {
              "defined": "WalletType"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "VestingSchedule",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "releaseTime",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "WalletType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Dev"
          },
          {
            "name": "Marketing"
          },
          {
            "name": "Presale1"
          },
          {
            "name": "Presale2"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NothingToClaim",
      "msg": "No tokens available to claim at this time."
    },
    {
      "code": 6001,
      "name": "Unauthorized",
      "msg": "Unauthorized: Only the admin wallet can initialize vesting accounts."
    },
    {
      "code": 6002,
      "name": "InvalidSchedule",
      "msg": "Invalid vesting schedule for wallet type."
    },
    {
      "code": 6003,
      "name": "InvalidMint",
      "msg": "Token account mint does not match vesting account mint."
    },
    {
      "code": 6004,
      "name": "InvalidPda",
      "msg": "Provided vesting_signer PDA is invalid."
    },
    {
      "code": 6005,
      "name": "InvalidOwner",
      "msg": "Vesting token account is not owned by the correct PDA."
    }
  ]
};

export const IDL: Team = {
  "version": "0.1.0",
  "name": "team",
  "instructions": [
    {
      "name": "initializeVesting",
      "accounts": [
        {
          "name": "vestingAccount",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "The wallet that will receive the vested tokens"
          ]
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "walletType",
          "type": {
            "defined": "WalletType"
          }
        },
        {
          "name": "totalAmount",
          "type": "u64"
        },
        {
          "name": "schedule",
          "type": {
            "vec": {
              "defined": "VestingSchedule"
            }
          }
        }
      ]
    },
    {
      "name": "claimUnlocked",
      "accounts": [
        {
          "name": "vestingAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "vestingTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vestingSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "vestingAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "claimedAmount",
            "type": "u64"
          },
          {
            "name": "schedule",
            "type": {
              "vec": {
                "defined": "VestingSchedule"
              }
            }
          },
          {
            "name": "walletType",
            "type": {
              "defined": "WalletType"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "VestingSchedule",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "releaseTime",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "WalletType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Dev"
          },
          {
            "name": "Marketing"
          },
          {
            "name": "Presale1"
          },
          {
            "name": "Presale2"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NothingToClaim",
      "msg": "No tokens available to claim at this time."
    },
    {
      "code": 6001,
      "name": "Unauthorized",
      "msg": "Unauthorized: Only the admin wallet can initialize vesting accounts."
    },
    {
      "code": 6002,
      "name": "InvalidSchedule",
      "msg": "Invalid vesting schedule for wallet type."
    },
    {
      "code": 6003,
      "name": "InvalidMint",
      "msg": "Token account mint does not match vesting account mint."
    },
    {
      "code": 6004,
      "name": "InvalidPda",
      "msg": "Provided vesting_signer PDA is invalid."
    },
    {
      "code": 6005,
      "name": "InvalidOwner",
      "msg": "Vesting token account is not owned by the correct PDA."
    }
  ]
};
