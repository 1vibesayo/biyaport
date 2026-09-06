import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  stringToHex,
  getAddress,
  isAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT_ADDRESS =
  process.env.BCODE_CONTRACT_ADDRESS as `0x${string}`;

const RELAYER_PRIVATE_KEY =
  process.env.BCODE_RELAYER_PRIVATE_KEY as `0x${string}`;

const BASE_RPC_URL =
  process.env.BASE_RPC_URL;

const CHAIN_ID = 84532;

const contractAbi = [
  {
    type: "function",
    name: "getBCode",
    stateMutability: "view",
    inputs: [
      {
        name: "codeHash",
        type: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {
            name: "creator",
            type: "address",
          },
          {
            name: "token",
            type: "address",
          },
          {
            name: "amount",
            type: "uint256",
          },
          {
            name: "redeemed",
            type: "bool",
          },
          {
            name: "cancelled",
            type: "bool",
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "redemptionNonces",
    stateMutability: "view",
    inputs: [
      {
        name: "codeHash",
        type: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "redeemBCode",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "codeHash",
        type: "bytes32",
      },
      {
        name: "recipient",
        type: "address",
      },
      {
        name: "nonce",
        type: "uint256",
      },
      {
        name: "deadline",
        type: "uint256",
      },
      {
        name: "signature",
        type: "bytes",
      },
    ],
    outputs: [],
  },
] as const;

function normalizeBCode(code: string) {
  return code
    .trim()
    .toUpperCase();
}

function hashBCode(code: string) {
  return keccak256(
    stringToHex(code)
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * ========================================
     * 1. CHECK ENVIRONMENT
     * ========================================
     */

    if (
      !CONTRACT_ADDRESS ||
      !RELAYER_PRIVATE_KEY ||
      !BASE_RPC_URL
    ) {
      return NextResponse.json(
        {
          error:
            "B-Code redemption is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ========================================
     * 2. READ REQUEST
     * ========================================
     */

    const body = await request.json();

    const rawCode = body?.code;
    const rawRecipient = body?.recipient;

    if (
      typeof rawCode !== "string" ||
      typeof rawRecipient !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "B-Code and recipient wallet address are required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 3. NORMALIZE B-CODE
     * ========================================
     */

    const code =
      normalizeBCode(rawCode);

    /*
     * Expected:
     *
     * B-XXXX-XXXX
     */

    const bCodePattern =
      /^B-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

    if (!bCodePattern.test(code)) {
      return NextResponse.json(
        {
          error:
            "Invalid B-Code format.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 4. VALIDATE RECIPIENT
     * ========================================
     */

    if (!isAddress(rawRecipient)) {
      return NextResponse.json(
        {
          error:
            "Invalid recipient wallet address.",
        },
        {
          status: 400,
        }
      );
    }

    const recipient =
      getAddress(rawRecipient);

    /*
     * ========================================
     * 5. HASH B-CODE
     * ========================================
     */

    const codeHash =
      hashBCode(code);

    /*
     * ========================================
     * 6. CREATE BASE SEPOLIA CLIENTS
     * ========================================
     */

    const publicClient =
      createPublicClient({
        chain: baseSepolia,
        transport: http(
          BASE_RPC_URL
        ),
      });

    const relayerAccount =
      privateKeyToAccount(
        RELAYER_PRIVATE_KEY
      );

    const walletClient =
      createWalletClient({
        account: relayerAccount,
        chain: baseSepolia,
        transport: http(
          BASE_RPC_URL
        ),
      });

    /*
     * ========================================
     * 7. READ B-CODE
     * ========================================
     */

    const bcode = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: "getBCode",
      args: [codeHash],
    });

    const creator = bcode.creator;
    const token = bcode.token;
    const amount = bcode.amount;
    const redeemed = bcode.redeemed;
    const cancelled = bcode.cancelled;

    /*
     * ========================================
     * 8. CHECK EXISTENCE
     * ========================================
     */

    if (
      creator ===
      "0x0000000000000000000000000000000000000000"
    ) {
      return NextResponse.json(
        {
          error:
            "B-Code does not exist.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ========================================
     * 9. CHECK STATUS
     * ========================================
     */

    if (redeemed) {
      return NextResponse.json(
        {
          error:
            "This B-Code has already been redeemed.",
        },
        {
          status: 409,
        }
      );
    }

    if (cancelled) {
      return NextResponse.json(
        {
          error:
            "This B-Code has been cancelled.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * ========================================
     * 10. GET NONCE
     * ========================================
     */

    const nonce =
      await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: contractAbi,
        functionName:
          "redemptionNonces",
        args: [codeHash],
      });

    /*
     * ========================================
     * 11. CREATE SHORT DEADLINE
     * ========================================
     */

    const latestBlock =
      await publicClient.getBlock();

    const deadline =
      BigInt(
        Number(
          latestBlock.timestamp
        ) + 10 * 60
      );

    /*
     * ========================================
     * 12. SIGN EIP-712
     * ========================================
     */

    const signature =
      await walletClient.signTypedData({
        account:
          relayerAccount,

        domain: {
          name:
            "Biyaport B-Codes",
          version: "1",
          chainId: CHAIN_ID,
          verifyingContract:
            CONTRACT_ADDRESS,
        },

        types: {
          Redeem: [
            {
              name:
                "codeHash",
              type: "bytes32",
            },
            {
              name:
                "recipient",
              type: "address",
            },
            {
              name:
                "nonce",
              type: "uint256",
            },
            {
              name:
                "deadline",
              type: "uint256",
            },
          ],
        },

        primaryType:
          "Redeem",

        message: {
          codeHash,
          recipient,
          nonce,
          deadline,
        },
      });

    /*
     * ========================================
     * 13. SUBMIT GASLESS REDEMPTION
     * ========================================
     */

    const txHash =
      await walletClient.writeContract({
        address:
          CONTRACT_ADDRESS,

        abi: contractAbi,

        functionName:
          "redeemBCode",

        args: [
          codeHash,
          recipient,
          nonce,
          deadline,
          signature,
        ],
      });

    /*
     * ========================================
     * 14. WAIT FOR CONFIRMATION
     * ========================================
     */

    const receipt =
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

    /*
     * ========================================
     * 15. VERIFY TRANSACTION
     * ========================================
     */

    if (
      receipt.status !==
      "success"
    ) {
      return NextResponse.json(
        {
          error:
            "Redemption transaction failed.",
          txHash,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ========================================
     * 16. RETURN RESULT
     * ========================================
     */

    return NextResponse.json({
      success: true,

      code,

      recipient,

      token,

      amount:
        amount.toString(),

      txHash,

      chainId:
        CHAIN_ID,
    });
  } catch (error) {
    console.error(
      "[B-CODE REDEEM ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to redeem B-Code.",
      },
      {
        status: 500,
      }
    );
  }
}