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
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT_ADDRESS =
  process.env.BCODE_CONTRACT_ADDRESS as `0x${string}`;

const RELAYER_PRIVATE_KEY =
  process.env.BCODE_RELAYER_PRIVATE_KEY as `0x${string}`;

const BASE_RPC_URL =
  process.env.BASE_RPC_URL;

const CHAIN_ID = 8453;

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
    name: "trustedSigner",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
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

    const body =
      await request.json();

    const rawCode =
      body?.code;

    const rawRecipient =
      body?.recipient;

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

    const bCodePattern =
      /^B-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

    if (
      !bCodePattern.test(code)
    ) {
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

    if (
      !isAddress(rawRecipient)
    ) {
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
     * 6. CREATE BASE MAINNET CLIENTS
     * ========================================
     */

    const publicClient =
      createPublicClient({
        chain: base,
        transport: http(
          BASE_RPC_URL
        ),
      });

    /*
     * The same wallet is used for:
     *
     * 1. EIP-712 trusted signing
     * 2. Relaying the redemption transaction
     */
    const relayerAccount =
      privateKeyToAccount(
        RELAYER_PRIVATE_KEY
      );

    const walletClient =
      createWalletClient({
        account:
          relayerAccount,
        chain: base,
        transport: http(
          BASE_RPC_URL
        ),
      });

    /*
     * ========================================
     * 7. VERIFY TRUSTED SIGNER
     * ========================================
     *
     * The contract requires:
     *
     * recovered signer == trustedSigner
     *
     * Since BCODE_RELAYER_PRIVATE_KEY is also
     * the trusted signer, these addresses must
     * match.
     */

    const trustedSigner =
      await publicClient.readContract({
        address:
          CONTRACT_ADDRESS,
        abi: contractAbi,
        functionName:
          "trustedSigner",
      });

    if (
      getAddress(
        trustedSigner
      ) !==
      getAddress(
        relayerAccount.address
      )
    ) {
      console.error(
        "[B-CODE] Trusted signer mismatch:",
        {
          contractTrustedSigner:
            trustedSigner,
          relayerAddress:
            relayerAccount.address,
        }
      );

      return NextResponse.json(
        {
          error:
            "B-Code redemption signer is not configured correctly.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ========================================
     * 8. READ B-CODE
     * ========================================
     */

    const bcode =
      await publicClient.readContract({
        address:
          CONTRACT_ADDRESS,
        abi: contractAbi,
        functionName:
          "getBCode",
        args: [
          codeHash,
        ],
      });

    const creator =
      bcode.creator;

    const token =
      bcode.token;

    const amount =
      bcode.amount;

    const redeemed =
      bcode.redeemed;

    const cancelled =
      bcode.cancelled;

    /*
     * ========================================
     * 9. CHECK EXISTENCE
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
     * 10. CHECK STATUS
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
     * 11. GET REDEMPTION NONCE
     * ========================================
     */

    const nonce =
      await publicClient.readContract({
        address:
          CONTRACT_ADDRESS,
        abi: contractAbi,
        functionName:
          "redemptionNonces",
        args: [
          codeHash,
        ],
      });

    /*
     * ========================================
     * 12. CREATE DEADLINE
     * ========================================
     *
     * Give the signature 10 minutes of validity.
     */

    const latestBlock =
      await publicClient.getBlock();

    const deadline =
      latestBlock.timestamp +
      600n;

    /*
     * ========================================
     * 13. SIGN EIP-712 REDEMPTION
     * ========================================
     *
     * This MUST exactly match:
     *
     * EIP712(
     *   "Biyaport B-Codes",
     *   "1"
     * )
     *
     * and:
     *
     * Redeem(
     *   bytes32 codeHash,
     *   address recipient,
     *   uint256 nonce,
     *   uint256 deadline
     * )
     *
     * in the Solidity contract.
     */

    const signature =
      await walletClient.signTypedData({
        account:
          relayerAccount,

        domain: {
          name:
            "Biyaport B-Codes",
          version:
            "1",
          chainId:
            CHAIN_ID,
          verifyingContract:
            CONTRACT_ADDRESS,
        },

        types: {
          Redeem: [
            {
              name:
                "codeHash",
              type:
                "bytes32",
            },
            {
              name:
                "recipient",
              type:
                "address",
            },
            {
              name:
                "nonce",
              type:
                "uint256",
            },
            {
              name:
                "deadline",
              type:
                "uint256",
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
     * 14. SUBMIT GASLESS REDEMPTION
     * ========================================
     *
     * The relayer pays gas.
     *
     * The recipient does not need to connect
     * a wallet or pay gas for this transaction.
     */

    const txHash =
      await walletClient.writeContract({
        address:
          CONTRACT_ADDRESS,

        abi:
          contractAbi,

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
     * 15. WAIT FOR CONFIRMATION
     * ========================================
     */

    const receipt =
      await publicClient.waitForTransactionReceipt({
        hash:
          txHash,
      });

    /*
     * ========================================
     * 16. VERIFY TRANSACTION
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
     * 17. RETURN RESULT
     * ========================================
     */

    return NextResponse.json({
      success:
        true,

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