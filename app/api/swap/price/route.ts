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

function isValidBps(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }

  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 10000
  );
}

function getSwapFeeToken(
  sellToken: string,
  buyToken: string
) {
  /**
   * 0x requires swapFeeToken to be an ERC-20 contract address.
   *
   * If the sell token is native ETH/BNB, use the buy token
   * for the Biyaport fee.
   */
  if (
    sellToken.toLowerCase() ===
    NATIVE_TOKEN_ADDRESS.toLowerCase()
  ) {
    return buyToken;
  }

  return sellToken;
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
     * Exactly one amount must be supplied.
     *
     * sellAmount = exact input
     * buyAmount  = exact output
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

    if (
      taker !== undefined &&
      taker !== null &&
      !isHexAddress(taker)
    ) {
      return NextResponse.json(
        {
          error: "Invalid taker address",
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

    if (!isValidBps(slippageBps)) {
      return NextResponse.json(
        {
          error: "Invalid slippageBps",
        },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();

    params.set("chainId", String(numericChainId));
    params.set("sellToken", sellToken);
    params.set("buyToken", buyToken);

    if (hasSellAmount) {
      params.set("sellAmount", sellAmount);
    } else {
      params.set("buyAmount", buyAmount);
    }

    if (taker) {
      params.set("taker", taker);
    }

    if (recipient) {
      params.set("recipient", recipient);
    }

    /**
     * Biyaport fee:
     *
     * 25 BPS = 0.25%
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
      getSwapFeeToken(sellToken, buyToken)
    );

    /**
     * Price endpoint doesn't require slippage,
     * but including the user's configured value allows
     * the API response to remain consistent with quote.
     */
    if (slippageBps !== undefined) {
      params.set(
        "slippageBps",
        String(Number(slippageBps))
      );
    } else {
      params.set(
        "slippageBps",
        String(DEFAULT_SLIPPAGE_BPS)
      );
    }

    const url =
      `${ZEROX_API}/swap/allowance-holder/price?` +
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
        "[0X PRICE ERROR]",
        response.status,
        data
      );

      return NextResponse.json(
        {
          error:
            data?.reason ||
            data?.message ||
            "Unable to get swap price",
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

    /**
     * liquidityAvailable is the important 0x signal.
     */
    if (data?.liquidityAvailable === false) {
      return NextResponse.json(
        {
          error:
            "No liquidity available for this token pair",
          liquidityAvailable: false,
          data,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,

      chainId: numericChainId,

      sellToken,
      buyToken,

      /**
       * Indicates which side the user supplied.
       */
      quoteType: hasSellAmount
        ? "sell"
        : "buy",

      /**
       * Exact-input:
       *   sellAmount = supplied amount
       *   buyAmount  = calculated output
       *
       * Exact-output:
       *   buyAmount      = supplied amount
       *   maxSellAmount  = maximum calculated input
       *   sellAmount     = usually null from 0x price response
       */
      sellAmount: data?.sellAmount ?? null,
      buyAmount: data?.buyAmount ?? null,
      maxSellAmount: data?.maxSellAmount ?? null,

      liquidityAvailable:
        data?.liquidityAvailable ?? null,

      allowanceTarget:
        data?.allowanceTarget ?? null,

      fees: data?.fees ?? null,

      issues: data?.issues ?? null,

      tokens: data?.tokens ?? null,

      tokenMetadata:
        data?.tokenMetadata ?? null,

      raw: data,
    });
  } catch (error) {
    console.error(
      "[SWAP PRICE]",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to get swap price",
      },
      { status: 500 }
    );
  }
}