import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  recoverTypedDataAddress,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

/*
 * ====================================================
 * B-CODE CREATE RELAYER
 * ====================================================
 *
 * Flow:
 *
 * User signs EIP-712 CreateBCode message
 *              ↓
 * POST /api/bcode/create
 *              ↓
 * Server verifies signature
 *              ↓
 * Relayer submits transaction
 *              ↓
 * BiyaportBCodes.createBCodeWithSignature()
 *              ↓
 * Contract pulls USDC from creator
 *              ↓
 * B-Code created
 *
 * The relayer pays gas.
 */

// ====================================================
// CONFIG
// ====================================================

const CHAIN = baseSepolia;

const CHAIN_ID = 84532;

const B_CODE_CONTRACT_ADDRESS =
  "0x8a7826FDBBE26CB8Fced97893A4144997F0fE74D" as Address;

const USDC_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

// ====================================================
// ABI
// ====================================================

const B_CODE_ABI = [
  {
    type: "function",
    name: "createBCodeWithSignature",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "creator",
        type: "address",
      },
      {
        name: "codeHash",
        type: "bytes32",
      },
      {
        name: "code",
        type: "string",
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

// ====================================================
// EIP-712 CONFIG
// ====================================================

const BCODE_DOMAIN = {
  name: "Biyaport B-Codes",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract:
    B_CODE_CONTRACT_ADDRESS,
} as const;

const BCODE_CREATE_TYPES = {
  CreateBCode: [
    {
      name: "creator",
      type: "address",
    },
    {
      name: "codeHash",
      type: "bytes32",
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
      name: "nonce",
      type: "uint256",
    },
    {
      name: "deadline",
      type: "uint256",
    },
  ],
} as const;

// ====================================================
// TYPES
// ====================================================

type CreateBCodeRequest = {
  creator: string;
  codeHash: string;
  code: string;
  token: string;
  amount: string;
  nonce: string;
  deadline: string;
  signature: string;
};

// ====================================================
// POST
// ====================================================

export async function POST(
  request: NextRequest
) {
  try {
    // ==================================================
    // ENVIRONMENT VARIABLES
    // ==================================================

    const rawRelayerPrivateKey =
      process.env.BCODE_RELAYER_PRIVATE_KEY?.trim();

    const rpcUrl =
      process.env.BASE_RPC_URL?.trim();

    console.log(
      "[B-CODE CREATE] Environment check:",
      {
        hasRelayerPrivateKey:
          Boolean(rawRelayerPrivateKey),

        relayerPrivateKeyLength:
          rawRelayerPrivateKey?.length ?? 0,

        hasBaseRpc:
          Boolean(rpcUrl),
      }
    );

    // ==================================================
    // RELAYER PRIVATE KEY
    // ==================================================

    if (!rawRelayerPrivateKey) {
      console.error(
        "[B-CODE CREATE] BCODE_RELAYER_PRIVATE_KEY is not configured."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Relayer private key is not configured.",
        },
        { status: 500 }
      );
    }

    const normalizedRelayerPrivateKey =
      rawRelayerPrivateKey.startsWith("0x")
        ? rawRelayerPrivateKey
        : `0x${rawRelayerPrivateKey}`;

    if (
      !/^0x[a-fA-F0-9]{64}$/.test(
        normalizedRelayerPrivateKey
      )
    ) {
      console.error(
        "[B-CODE CREATE] Invalid relayer private key format."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Relayer private key has an invalid format.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // RPC VALIDATION
    // ==================================================

    if (!rpcUrl) {
      console.error(
        "[B-CODE CREATE] BASE_RPC_URL is not configured."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Base RPC is not configured.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // RELAYER ACCOUNT
    // ==================================================

    const relayerAccount =
      privateKeyToAccount(
        normalizedRelayerPrivateKey as Hex
      );

    console.log(
      "[B-CODE CREATE] Relayer address:",
      relayerAccount.address
    );

    // ==================================================
    // CLIENTS
    // ==================================================

    const publicClient =
      createPublicClient({
        chain: CHAIN,
        transport: http(rpcUrl),
      });

    const walletClient =
      createWalletClient({
        account: relayerAccount,
        chain: CHAIN,
        transport: http(rpcUrl),
      });

    // ==================================================
    // REQUEST BODY
    // ==================================================

    const body =
      (await request.json()) as CreateBCodeRequest;

    const {
      creator,
      codeHash,
      code,
      token,
      amount,
      nonce,
      deadline,
      signature,
    } = body;

    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (
      !creator ||
      !codeHash ||
      !code ||
      !token ||
      !amount ||
      nonce === undefined ||
      !deadline ||
      !signature
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // ADDRESS VALIDATION
    // ==================================================

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        creator
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid creator address.",
        },
        { status: 400 }
      );
    }

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        token
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid token address.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // TOKEN VALIDATION
    // ==================================================

    if (
      token.toLowerCase() !==
      USDC_ADDRESS.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported token. Only Base Sepolia USDC is supported.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // CODE HASH VALIDATION
    // ==================================================

    if (
      !/^0x[a-fA-F0-9]{64}$/.test(
        codeHash
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid codeHash.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // SIGNATURE VALIDATION
    // ==================================================

    if (
      !/^0x[a-fA-F0-9]+$/.test(
        signature
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid signature.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // NUMERIC VALIDATION
    // ==================================================

    let amountBigInt: bigint;
    let nonceBigInt: bigint;
    let deadlineBigInt: bigint;

    try {
      amountBigInt = BigInt(amount);
      nonceBigInt = BigInt(nonce);
      deadlineBigInt = BigInt(deadline);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid numeric value.",
        },
        { status: 400 }
      );
    }

    if (amountBigInt <= 0n) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (nonceBigInt < 0n) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid nonce.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // DEADLINE CHECK
    // ==================================================

    const now = BigInt(
      Math.floor(Date.now() / 1000)
    );

    if (deadlineBigInt <= now) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creation signature has expired.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // CODE HASH INTEGRITY CHECK
    // ==================================================

    const calculatedCodeHash =
      keccak256(toBytes(code));

    console.log(
      "[B-CODE CREATE] Code hash check:",
      {
        supplied: codeHash,
        calculated: calculatedCodeHash,
      }
    );

    if (
      calculatedCodeHash.toLowerCase() !==
      codeHash.toLowerCase()
    ) {
      console.error(
        "[B-CODE CREATE] Code hash mismatch."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "B-Code hash does not match the supplied code.",
        },
        { status: 400 }
      );
    }

    // ==================================================
    // EIP-712 SIGNATURE VERIFICATION
    // ==================================================

    console.log(
      "[B-CODE CREATE] Verifying EIP-712 signature..."
    );

    let recoveredSigner: Address;

    try {
      recoveredSigner =
        await recoverTypedDataAddress({
          domain: BCODE_DOMAIN,

          types:
            BCODE_CREATE_TYPES,

          primaryType:
            "CreateBCode",

          message: {
            creator:
              creator as Address,

            codeHash:
              codeHash as `0x${string}`,

            token:
              token as Address,

            amount:
              amountBigInt,

            nonce:
              nonceBigInt,

            deadline:
              deadlineBigInt,
          },

          signature:
            signature as `0x${string}`,
        });
    } catch (signatureError) {
      console.error(
        "[B-CODE CREATE] Signature recovery failed:",
        signatureError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the B-Code signature.",
        },
        { status: 400 }
      );
    }

    console.log(
      "[B-CODE CREATE] Declared creator:",
      creator
    );

    console.log(
      "[B-CODE CREATE] Recovered signer:",
      recoveredSigner
    );

    // ==================================================
    // CREATOR SIGNATURE MATCH
    // ==================================================

    if (
      recoveredSigner.toLowerCase() !==
      creator.toLowerCase()
    ) {
      console.error(
        "[B-CODE CREATE] SIGNATURE MISMATCH:",
        {
          creator,
          recoveredSigner,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The B-Code signature does not belong to the creator wallet.",
        },
        { status: 400 }
      );
    }

    console.log(
      "[B-CODE CREATE] EIP-712 signature verified successfully."
    );

    // ==================================================
    // CREATOR / RELAYER INFORMATION
    // ==================================================

    if (
      creator.toLowerCase() ===
      relayerAccount.address.toLowerCase()
    ) {
      console.warn(
        "[B-CODE CREATE] Creator and relayer are the same address."
      );
    }

    // ==================================================
    // RELAYER BALANCE CHECK
    // ==================================================

    const relayerBalance =
      await publicClient.getBalance({
        address:
          relayerAccount.address,
      });

    console.log(
      "[B-CODE CREATE] Relayer ETH balance:",
      relayerBalance.toString()
    );

    if (relayerBalance === 0n) {
      console.error(
        "[B-CODE CREATE] Relayer has no ETH for gas."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Relayer is not funded for gas.",
        },
        { status: 503 }
      );
    }

    // ==================================================
    // SIMULATE CONTRACT CALL
    // ==================================================

    console.log(
      "[B-CODE CREATE] Simulating contract call..."
    );

    const {
      request: simulatedRequest,
    } =
      await publicClient.simulateContract({
        address:
          B_CODE_CONTRACT_ADDRESS,

        abi:
          B_CODE_ABI,

        functionName:
          "createBCodeWithSignature",

        args: [
          creator as Address,

          codeHash as `0x${string}`,

          code,

          token as Address,

          amountBigInt,

          nonceBigInt,

          deadlineBigInt,

          signature as `0x${string}`,
        ],

        account:
          relayerAccount,
      });

    console.log(
      "[B-CODE CREATE] Simulation successful."
    );

    // ==================================================
    // SUBMIT TRANSACTION
    // ==================================================

    const txHash =
      await walletClient.writeContract(
        simulatedRequest
      );

    console.log(
      "[B-CODE CREATE] Transaction submitted:",
      txHash
    );

    // ==================================================
    // WAIT FOR CONFIRMATION
    // ==================================================

    const receipt =
      await publicClient.waitForTransactionReceipt(
        {
          hash: txHash,
        }
      );

    // ==================================================
    // CHECK RECEIPT
    // ==================================================

    if (
      receipt.status !==
      "success"
    ) {
      console.error(
        "[B-CODE CREATE] Transaction reverted:",
        txHash
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "B-Code creation transaction reverted.",
          txHash,
        },
        { status: 500 }
      );
    }

    // ==================================================
    // SUCCESS
    // ==================================================

    console.log(
      "[B-CODE CREATE] B-Code created successfully:",
      txHash
    );

    return NextResponse.json({
      success: true,
      txHash,
      relayer:
        relayerAccount.address,
      creator,
    });
  } catch (error) {
    console.error(
      "[B-CODE CREATE ERROR]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}