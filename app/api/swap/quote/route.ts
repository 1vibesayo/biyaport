import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SLIPPAGE_BPS,
  NATIVE_TOKEN_ADDRESS,
  SWAP_FEE_BPS,
  SWAP_NETWORKS,
  ZEROX_API,
  ZEROX_VERSION,
} from "../_config";

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isValidTokenAddress(value: string) {
  return (
    value.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    isHexAddress(value)
  );
}

function isValidChain(chainId: number) {
  return SWAP_NETWORKS.some(
    (network) => network.chainId === chainId
  );
}

function getSwapFeeToken(
  sellToken: string,
  buyToken: string
) {
  if (
    sellToken.toLowerCase() ===
    NATIVE_TOKEN_ADDRESS.toLowerCase()
  ) {
    return buyToken;
  }

  return sellToken;
}

function isValidBps(value: unknown) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 10000
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ZEROX_API_KEY;
  const feeRecipient = process.env.SWAP_FEE_RECIPIENT;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ZEROX_API_KEY is not configured",
      },
      { status: 500 }
    );
  }

  if (!feeRecipient || !isHexAddress(feeRecipient)) {
    return NextResponse.json(
      {
        error:
          "SWAP_FEE_RECIPIENT is missing or invalid",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const {
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      buyAmount,
      taker,
      recipient,
      slippageBps,
    } = body;

    const numericChainId = Number(chainId);

    if (
      !Number.isInteger(numericChainId) ||
      !isValidChain(numericChainId)
    ) {
      return NextResponse.json(
        {
          error: "Unsupported swap network",
        },
        { status: 400 }
      );
    }

    if (
      typeof sellToken !== "string" ||
      !isValidTokenAddress(sellToken)
    ) {
      return NextResponse.json(
        {
          error: "Invalid sell token",
        },
        { status: 400 }
      );
    }

    if (
      typeof buyToken !== "string" ||
      !isValidTokenAddress(buyToken)
    ) {
      return NextResponse.json(
        {
          error: "Invalid buy token",
        },
        { status: 400 }
      );
    }

    if (
      sellToken.toLowerCase() ===
      buyToken.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "Sell token and buy token must be different",
        },
        { status: 400 }
      );
    }

    /**
     * Exactly one amount is allowed.
     */
    const hasSellAmount =
      typeof sellAmount === "string" &&
      sellAmount.length > 0;

    const hasBuyAmount =
      typeof buyAmount === "string" &&
      buyAmount.length > 0;

    if (hasSellAmount === hasBuyAmount) {
      return NextResponse.json(
        {
          error:
            "Provide exactly one of sellAmount or buyAmount",
        },
        { status: 400 }
      );
    }

    const amount = hasSellAmount
      ? sellAmount
      : buyAmount;

    if (!/^\d+$/.test(amount)) {
      return NextResponse.json(
        {
          error:
            "Amount must be an integer string in token base units",
        },
        { status: 400 }
      );
    }

    if (amount === "0") {
      return NextResponse.json(
        {
          error: "Amount must be greater than zero",
        },
        { status: 400 }
      );
    }

    /**
     * taker is REQUIRED for /quote.
     *
     * 0x needs the user's wallet address to generate
     * the executable transaction and validate the quote.
     */
    if (
      typeof taker !== "string" ||
      !isHexAddress(taker)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid taker wallet address is required",
        },
        { status: 400 }
      );
    }

    if (
      recipient !== undefined &&
      recipient !== null &&
      !isHexAddress(recipient)
    ) {
      return NextResponse.json(
        {
          error: "Invalid recipient address",
        },
        { status: 400 }
      );
    }

    const finalSlippageBps =
      slippageBps === undefined
        ? DEFAULT_SLIPPAGE_BPS
        : Number(slippageBps);

    if (!isValidBps(finalSlippageBps)) {
      return NextResponse.json(
        {
          error: "Invalid slippageBps",
        },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();

    params.set(
      "chainId",
      String(numericChainId)
    );

    params.set(
      "sellToken",
      sellToken
    );

    params.set(
      "buyToken",
      buyToken
    );

    if (hasSellAmount) {
      params.set(
        "sellAmount",
        sellAmount
      );
    } else {
      params.set(
        "buyAmount",
        buyAmount
      );
    }

    params.set(
      "taker",
      taker
    );

    if (recipient) {
      params.set(
        "recipient",
        recipient
      );
    }

    /**
     * Biyaport fee
     */
    params.set(
      "swapFeeRecipient",
      feeRecipient
    );

    params.set(
      "swapFeeBps",
      String(SWAP_FEE_BPS)
    );

    params.set(
      "swapFeeToken",
      getSwapFeeToken(
        sellToken,
        buyToken
      )
    );

    params.set(
      "slippageBps",
      String(finalSlippageBps)
    );

    const url =
      `${ZEROX_API}/swap/allowance-holder/quote?` +
      params.toString();

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "0x-api-key": apiKey,
        "0x-version": ZEROX_VERSION,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "[0X QUOTE ERROR]",
        response.status,
        data
      );

      return NextResponse.json(
        {
          error:
            data?.reason ||
            data?.message ||
            "Unable to get swap quote",
          details: data,
        },
        {
          status:
            response.status >= 400 &&
            response.status < 500
              ? response.status
              : 502,
        }
      );
    }

    if (data?.liquidityAvailable === false) {
      return NextResponse.json(
        {
          error:
            "No liquidity available for this token pair",
          liquidityAvailable: false,
        },
        { status: 422 }
      );
    }

    const transaction = data?.transaction;

    if (
      !transaction?.to ||
      !transaction?.data
    ) {
      console.error(
        "[0X QUOTE] Missing transaction",
        data
      );

      return NextResponse.json(
        {
          error:
            "0x returned a quote without executable transaction data",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,

      chainId: numericChainId,

      sellToken,
      buyToken,

      quoteType: hasSellAmount
        ? "sell"
        : "buy",

      sellAmount:
        data?.sellAmount ?? null,

      buyAmount:
        data?.buyAmount ?? null,

      minBuyAmount:
        data?.minBuyAmount ?? null,

      fees:
        data?.fees ?? null,

      issues:
        data?.issues ?? null,

      allowanceTarget:
        data?.allowanceTarget ??
        data?.issues?.allowance?.spender ??
        null,

      transaction: {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value ?? "0",
        gas: transaction.gas ?? null,
        gasPrice:
          transaction.gasPrice ?? null,
      },

      raw: data,
    });
  } catch (error) {
    console.error(
      "[SWAP QUOTE]",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to get swap quote",
      },
      { status: 500 }
    );
  }
}