import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  parseEventLogs,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";

const CONTRACT_ADDRESS =
  process.env.BCODE_CONTRACT_ADDRESS as Address;

const RPC_URL = process.env.BASE_RPC_URL;

const DEPLOYMENT_BLOCK = BigInt(
  process.env.BCODE_CONTRACT_DEPLOYMENT_BLOCK || "46477579"
);

const LOG_CHUNK_SIZE = 10n;

const B_CODE_ABI = [
  {
    type: "event",
    name: "BCodeCreated",
    inputs: [
      {
        indexed: true,
        name: "codeHash",
        type: "bytes32",
      },
      {
        indexed: true,
        name: "creator",
        type: "address",
      },
      {
        indexed: false,
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        name: "fee",
        type: "uint256",
      },
      {
        indexed: false,
        name: "code",
        type: "string",
      },
    ],
  },
  {
    type: "event",
    name: "BCodeRedeemed",
    inputs: [
      {
        indexed: true,
        name: "codeHash",
        type: "bytes32",
      },
      {
        indexed: true,
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
  },
  {
    type: "event",
    name: "BCodeCancelled",
    inputs: [
      {
        indexed: true,
        name: "codeHash",
        type: "bytes32",
      },
      {
        indexed: true,
        name: "creator",
        type: "address",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
    ],
  },
] as const;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required",
        },
        { status: 400 }
      );
    }

    const normalizedWallet = wallet.toLowerCase();

    const latestBlock = await client.getBlockNumber();

    const events: Array<{
      type: "created" | "redeemed" | "cancelled";
      codeHash: string;
      code?: string;
      creator?: string;
      recipient?: string;
      token?: string;
      amount: string;
      fee?: string;
      txHash: string;
      blockNumber: string;
      timestamp: string;
    }> = [];

    // Cache timestamps so we don't request the same block twice.
    const blockTimestampCache = new Map<bigint, string>();

    for (
      let fromBlock = DEPLOYMENT_BLOCK;
      fromBlock <= latestBlock;
      fromBlock += LOG_CHUNK_SIZE
    ) {
      const toBlock =
        fromBlock + LOG_CHUNK_SIZE - 1n > latestBlock
          ? latestBlock
          : fromBlock + LOG_CHUNK_SIZE - 1n;

      console.log(
        `[B-CODE HISTORY] Scanning ${fromBlock}-${toBlock}`
      );

      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock,
        toBlock,
      });

      if (!logs.length) {
        continue;
      }

      const decoded = parseEventLogs({
        abi: B_CODE_ABI,
        logs,
        strict: false,
      });

      for (const event of decoded) {
        if (event.blockNumber === undefined) {
          continue;
        }

        let timestamp =
          blockTimestampCache.get(event.blockNumber);

        if (!timestamp) {
          const block = await client.getBlock({
            blockNumber: event.blockNumber,
          });

          timestamp = new Date(
            Number(block.timestamp) * 1000
          ).toISOString();

          blockTimestampCache.set(
            event.blockNumber,
            timestamp
          );
        }

        // ============================================
        // B-CODE CREATED
        // ============================================

        if (event.eventName === "BCodeCreated") {
          const {
            codeHash,
            creator,
            token,
            amount,
            fee,
            code,
          } = event.args;

          // Explicitly make sure all required event
          // arguments exist before using them.
          if (
            !codeHash ||
            !creator ||
            !token ||
            amount === undefined ||
            fee === undefined ||
            !code
          ) {
            continue;
          }

          if (
            creator.toLowerCase() !== normalizedWallet
          ) {
            continue;
          }

          events.push({
            type: "created",
            codeHash,
            code,
            creator,
            token,
            amount: amount.toString(),
            fee: fee.toString(),
            txHash: event.transactionHash,
            blockNumber:
              event.blockNumber.toString(),
            timestamp,
          });
        }

        // ============================================
        // B-CODE REDEEMED
        // ============================================

        if (event.eventName === "BCodeRedeemed") {
          const {
            codeHash,
            recipient,
            amount,
          } = event.args;

          if (
            !codeHash ||
            !recipient ||
            amount === undefined
          ) {
            continue;
          }

          if (
            recipient.toLowerCase() !==
            normalizedWallet
          ) {
            continue;
          }

          events.push({
            type: "redeemed",
            codeHash,
            recipient,
            amount: amount.toString(),
            txHash: event.transactionHash,
            blockNumber:
              event.blockNumber.toString(),
            timestamp,
          });
        }

        // ============================================
        // B-CODE CANCELLED
        // ============================================

        if (event.eventName === "BCodeCancelled") {
          const {
            codeHash,
            creator,
            amount,
          } = event.args;

          if (
            !codeHash ||
            !creator ||
            amount === undefined
          ) {
            continue;
          }

          if (
            creator.toLowerCase() !== normalizedWallet
          ) {
            continue;
          }

          events.push({
            type: "cancelled",
            codeHash,
            creator,
            amount: amount.toString(),
            txHash: event.transactionHash,
            blockNumber:
              event.blockNumber.toString(),
            timestamp,
          });
        }
      }
    }

    // Newest activity first.
    events.sort((a, b) => {
      const blockA = BigInt(a.blockNumber);
      const blockB = BigInt(b.blockNumber);

      if (blockA !== blockB) {
        return blockA > blockB ? -1 : 1;
      }

      return b.txHash.localeCompare(a.txHash);
    });

    return NextResponse.json({
      success: true,
      wallet,
      events,
      count: events.length,
      fromBlock: DEPLOYMENT_BLOCK.toString(),
      toBlock: latestBlock.toString(),
    });
  } catch (error) {
    console.error(
      "[B-CODE HISTORY ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch B-Code history",
      },
      { status: 500 }
    );
  }
}