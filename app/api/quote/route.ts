import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/rates";

const ZEROX_API =
  "https://api.0x.org/swap/allowance-holder/price";

const SUPPORTED_TOKENS = [
  "USDT",
  "USDC",
  "ETH",
  "BNB",
] as const;

const SUPPORTED_NETWORKS = [
  "base",
  "bnb-smart-chain",
] as const;

const FIAT = "NGN";

const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const TOKEN_CONFIG = {
  USDT: {
    type: "direct",
  },

  USDC: {
    type: "direct",
  },

  ETH: {
    type: "swap",
    network: "base",
    chainId: 8453,
    settlementToken: "USDC",
    settlementTokenAddress:
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    settlementDecimals: 6,
    nativeDecimals: 18,
  },

  BNB: {
    type: "swap",
    network: "bnb-smart-chain",
    chainId: 56,
    settlementToken: "USDT",
    settlementTokenAddress: "",
    settlementDecimals: 18,
    nativeDecimals: 18,
  },
} as const;

type SupportedToken =
  (typeof SUPPORTED_TOKENS)[number];

type SupportedNetwork =
  (typeof SUPPORTED_NETWORKS)[number];

/*
 * ------------------------------------------------
 * NORMALIZE NETWORK
 * ------------------------------------------------
 */

function normalizeNetwork(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /\s+network$/i,
        ""
      );

  if (
    normalized === "base" ||
    normalized === "base mainnet"
  ) {
    return "base";
  }

  if (
    normalized === "bnb-smart-chain" ||
    normalized === "bnb smart chain" ||
    normalized === "bnb smart chain mainnet" ||
    normalized === "bsc" ||
    normalized === "bsc mainnet"
  ) {
    return "bnb-smart-chain";
  }

  return normalized;
}

/*
 * ------------------------------------------------
 * CONVERT DECIMAL AMOUNT TO BASE UNITS
 * ------------------------------------------------
 */

function toBaseUnits(
  amount: number,
  decimals: number
): string {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Invalid amount."
    );
  }

  const fixed =
    amount.toFixed(decimals);

  const [whole, fraction = ""] =
    fixed.split(".");

  const paddedFraction =
    fraction
      .padEnd(decimals, "0")
      .slice(0, decimals);

  const result =
    whole +
    paddedFraction;

  return result.replace(
    /^0+(?=\d)/,
    ""
  );
}

/*
 * ------------------------------------------------
 * CONVERT BASE UNITS TO DECIMAL
 * ------------------------------------------------
 */

function fromBaseUnits(
  amount: string,
  decimals: number
): number {
  const normalized =
    String(amount);

  if (decimals === 0) {
    return Number(normalized);
  }

  const padded =
    normalized.padStart(
      decimals + 1,
      "0"
    );

  const splitPosition =
    padded.length - decimals;

  const whole =
    padded.slice(
      0,
      splitPosition
    );

  const fraction =
    padded.slice(
      splitPosition
    );

  return Number(
    `${whole}.${fraction}`
  );
}

/*
 * ------------------------------------------------
 * PAYCREST SENDER FEE
 * ------------------------------------------------
 *
 * Keep this synchronized with the sender fee
 * configured in your Paycrest Sender Dashboard.
 *
 * You can override it with:
 *
 * PAYCREST_SENDER_FEE_PERCENT=5
 *
 * If the env variable is missing, default to 5%.
 */

function getSenderFeePercent(): number {
  const configured =
    Number(
      process.env
        .PAYCREST_SENDER_FEE_PERCENT
    );

  if (
    Number.isFinite(configured) &&
    configured >= 0
  ) {
    return configured;
  }

  return 5;
}

/*
 * ------------------------------------------------
 * POST
 * ------------------------------------------------
 */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    /*
     * ------------------------------------------------
     * TOKEN
     * ------------------------------------------------
     */

    const token =
      String(
        body.token || ""
      )
        .trim()
        .toUpperCase();

    /*
     * ------------------------------------------------
     * NETWORK
     * ------------------------------------------------
     */

    const rawNetwork =
      body.network ??
      body.chain ??
      body.selectedNetwork ??
      "base";

    const network =
      normalizeNetwork(
        rawNetwork
      );

    /*
     * ------------------------------------------------
     * WALLET ADDRESS
     * ------------------------------------------------
     */

    const walletAddress =
      String(
        body.walletAddress ||
          body.taker ||
          ""
      ).trim();

    /*
     * ------------------------------------------------
     * NAIRA AMOUNT
     * ------------------------------------------------
     */

    const nairaAmount =
      Number(
        body.nairaAmount
      );

    console.log(
      "OFFRAMP QUOTE REQUEST:",
      {
        token,
        rawNetwork,
        normalizedNetwork:
          network,
        nairaAmount,
        walletAddress,
      }
    );

    /*
     * ------------------------------------------------
     * TOKEN VALIDATION
     * ------------------------------------------------
     */

    if (
      !SUPPORTED_TOKENS.includes(
        token as SupportedToken
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Unsupported cryptocurrency.",

          receivedToken:
            body.token,

          normalizedToken:
            token,

          supportedTokens:
            SUPPORTED_TOKENS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * NETWORK VALIDATION
     * ------------------------------------------------
     */

    if (
      !SUPPORTED_NETWORKS.includes(
        network as SupportedNetwork
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Unsupported network. Biyaport currently supports Base and BNB Smart Chain.",

          receivedNetwork:
            rawNetwork,

          normalizedNetwork:
            network,

          supportedNetworks:
            SUPPORTED_NETWORKS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * NETWORK / TOKEN COMPATIBILITY
     * ------------------------------------------------
     */

    if (
      token === "ETH" &&
      network !== "base"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "ETH is currently supported only on Base.",
        },
        { status: 400 }
      );
    }

    if (
      token === "BNB" &&
      network !==
        "bnb-smart-chain"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "BNB is currently supported only on BNB Smart Chain.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * NAIRA AMOUNT VALIDATION
     * ------------------------------------------------
     */

    if (
      !Number.isFinite(
        nairaAmount
      ) ||
      nairaAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid Naira amount.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * TOKEN CONFIG
     * ------------------------------------------------
     */

    const tokenConfig =
      TOKEN_CONFIG[
        token as keyof typeof TOKEN_CONFIG
      ];

    /*
     * =================================================
     * DIRECT PAYCREST TOKENS
     * =================================================
     *
     * USDT and USDC keep the existing flow.
     */

    if (
      tokenConfig.type ===
      "direct"
    ) {
      /*
       * ------------------------------------------------
       * FIRST PAYCREST QUOTE
       * ------------------------------------------------
       */

      const initialUrl =
        `${PAYCREST_API}/${network}/${token}/1/${FIAT}?side=sell`;

      console.log(
        "PAYCREST INITIAL QUOTE URL:",
        initialUrl
      );

      const initialResponse =
        await fetch(
          initialUrl,
          {
            cache:
              "no-store",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      let initialData: any =
        null;

      try {
        initialData =
          await initialResponse.json();
      } catch {
        initialData =
          null;
      }

      if (
        !initialResponse.ok ||
        initialData?.status !==
          "success"
      ) {
        console.error(
          "PAYCREST INITIAL QUOTE ERROR:",
          {
            status:
              initialResponse.status,

            data:
              initialData,
          }
        );

        return NextResponse.json(
          {
            success: false,

            error:
              "Unable to get crypto rate.",

            details:
              initialData,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * INITIAL RATE
       * ------------------------------------------------
       */

      const initialRate =
        Number(
          initialData
            ?.data
            ?.sell
            ?.rate
        );

      if (
        !Number.isFinite(
          initialRate
        ) ||
        initialRate <= 0
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Invalid crypto rate returned by Paycrest.",
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * ESTIMATE CRYPTO AMOUNT
       * ------------------------------------------------
       */

      let cryptoAmount =
        nairaAmount /
        initialRate;

      /*
       * ------------------------------------------------
       * REFINE QUOTE
       * ------------------------------------------------
       */

      const quoteAmount =
        Math.max(
          cryptoAmount,
          0.000001
        );

      const quoteUrl =
        `${PAYCREST_API}/${network}/${token}/${quoteAmount}/${FIAT}?side=sell`;

      console.log(
        "PAYCREST FINAL QUOTE URL:",
        quoteUrl
      );

      const quoteResponse =
        await fetch(
          quoteUrl,
          {
            cache:
              "no-store",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      let quoteData: any =
        null;

      try {
        quoteData =
          await quoteResponse.json();
      } catch {
        quoteData =
          null;
      }

      if (
        !quoteResponse.ok ||
        quoteData?.status !==
          "success"
      ) {
        console.error(
          "PAYCREST QUOTE ERROR:",
          {
            status:
              quoteResponse.status,

            data:
              quoteData,
          }
        );

        return NextResponse.json(
          {
            success: false,

            error:
              "Unable to calculate crypto equivalent.",

            details:
              quoteData,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * FINAL RATE
       * ------------------------------------------------
       */

      const rate =
        Number(
          quoteData
            ?.data
            ?.sell
            ?.rate
        );

      if (
        !Number.isFinite(
          rate
        ) ||
        rate <= 0
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Invalid quote rate returned by Paycrest.",
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * FINAL CRYPTO AMOUNT
       * ------------------------------------------------
       */

      cryptoAmount =
        nairaAmount /
        rate;

      /*
       * ------------------------------------------------
       * RESPONSE
       * ------------------------------------------------
       */

      return NextResponse.json(
        {
          success: true,

          token,

          network,

          fiat:
            FIAT,

          nairaAmount,

          rate,

          cryptoAmount,

          requiresSwap:
            false,
        }
      );
    }

    /*
     * =================================================
     * NATIVE ASSET SWAP
     * =================================================
     *
     * ETH → USDC on Base
     *
     * BNB → USDT on BSC
     */

    if (
      !walletAddress ||
      !/^0x[a-fA-F0-9]{40}$/.test(
        walletAddress
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "A valid wallet address is required for ETH and BNB quotes.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * SWAP CONFIG
     * ------------------------------------------------
     */

    if (
      tokenConfig.type !==
      "swap"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid swap configuration.",
        },
        { status: 500 }
      );
    }

    if (
      tokenConfig.network !==
      network
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "The selected native asset is not available on this network.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST SETTLEMENT TOKEN
     * ------------------------------------------------
     */

    const settlementToken =
      tokenConfig.settlementToken;

    /*
     * ------------------------------------------------
     * SETTLEMENT TOKEN ADDRESS
     * ------------------------------------------------
     */

    let settlementTokenAddress: string =
      tokenConfig
        .settlementTokenAddress;

    let settlementDecimals: number =
      tokenConfig
        .settlementDecimals;

    if (
      token === "BNB"
    ) {
      settlementTokenAddress =
        process.env
          .BSC_USDT_ADDRESS
          ?.trim() || "";

      /*
       * IMPORTANT:
       * Verify the actual decimals of the
       * BSC USDT contract before enabling BNB.
       */

      settlementDecimals = 18;
    }

    if (
      !settlementTokenAddress
    ) {
      console.error(
        `Settlement token address is missing for ${token}.`
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `Biyaport is not fully configured for ${token} yet.`,
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST INITIAL SETTLEMENT RATE
     * ------------------------------------------------
     */

    const settlementInitialUrl =
      `${PAYCREST_API}/${network}/${settlementToken}/1/${FIAT}?side=sell`;

    console.log(
      "PAYCREST NATIVE SWAP INITIAL RATE:",
      settlementInitialUrl
    );

    const settlementInitialResponse =
      await fetch(
        settlementInitialUrl,
        {
          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

    let settlementInitialData:
      any = null;

    try {
      settlementInitialData =
        await settlementInitialResponse.json();
    } catch {
      settlementInitialData =
        null;
    }

    if (
      !settlementInitialResponse.ok ||
      settlementInitialData?.status !==
        "success"
    ) {
      console.error(
        "PAYCREST SETTLEMENT INITIAL RATE ERROR:",
        {
          status:
            settlementInitialResponse.status,

          data:
            settlementInitialData,
        }
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `Unable to get the ${settlementToken} rate.`,
        },
        { status: 502 }
      );
    }

    const settlementInitialRate =
      Number(
        settlementInitialData
          ?.data
          ?.sell
          ?.rate
      );

    if (
      !Number.isFinite(
        settlementInitialRate
      ) ||
      settlementInitialRate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Invalid ${settlementToken} rate returned by Paycrest.`,
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * ESTIMATE SETTLEMENT TOKEN AMOUNT
     * ------------------------------------------------
     */

    let settlementAmount =
      nairaAmount /
      settlementInitialRate;

    /*
     * ------------------------------------------------
     * REFINE SETTLEMENT TOKEN QUOTE
     * ------------------------------------------------
     */

    const settlementQuoteAmount =
      Math.max(
        settlementAmount,
        0.000001
      );

    const settlementQuoteUrl =
      `${PAYCREST_API}/${network}/${settlementToken}/${settlementQuoteAmount}/${FIAT}?side=sell`;

    console.log(
      "PAYCREST NATIVE SWAP FINAL RATE:",
      settlementQuoteUrl
    );

    const settlementQuoteResponse =
      await fetch(
        settlementQuoteUrl,
        {
          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

    let settlementQuoteData:
      any = null;

    try {
      settlementQuoteData =
        await settlementQuoteResponse.json();
    } catch {
      settlementQuoteData =
        null;
    }

    if (
      !settlementQuoteResponse.ok ||
      settlementQuoteData?.status !==
        "success"
    ) {
      console.error(
        "PAYCREST SETTLEMENT QUOTE ERROR:",
        {
          status:
            settlementQuoteResponse.status,

          data:
            settlementQuoteData,
        }
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `Unable to calculate ${settlementToken} equivalent.`,
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * FINAL SETTLEMENT RATE
     * ------------------------------------------------
     */

    const settlementRate =
      Number(
        settlementQuoteData
          ?.data
          ?.sell
          ?.rate
      );

    if (
      !Number.isFinite(
        settlementRate
      ) ||
      settlementRate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Invalid ${settlementToken} quote rate returned by Paycrest.`,
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * NET SETTLEMENT AMOUNT
     * ------------------------------------------------
     *
     * This is the Paycrest principal amount
     * corresponding to the requested NGN amount.
     */

    settlementAmount =
      nairaAmount /
      settlementRate;

    /*
     * ------------------------------------------------
     * PAYCREST SENDER FEE
     * ------------------------------------------------
     *
     * Paycrest documentation states that the
     * total crypto sent for an offramp is:
     *
     * amount + senderFee + transactionFee
     *
     * The public rate endpoint does not give us
     * the final transactionFee before the order
     * is created.
     *
     * Therefore this quote includes the configured
     * sender fee, but transactionFee is still
     * finalized during order creation.
     */

    const senderFeePercent =
      getSenderFeePercent();

    const senderFee =
      settlementAmount *
      (senderFeePercent / 100);

    /*
     * ------------------------------------------------
     * TOTAL SETTLEMENT AMOUNT
     * ------------------------------------------------
     *
     * This is the amount we ask 0x to acquire.
     *
     * settlementAmount
     * + senderFee
     *
     * Transaction fee is not added here because
     * Paycrest only gives the exact transaction fee
     * on the created order.
     */

    const totalSettlementAmount =
      settlementAmount +
      senderFee;

    /*
     * ------------------------------------------------
     * CONVERT TO BASE UNITS
     * ------------------------------------------------
     */

    const buyAmount =
      toBaseUnits(
        totalSettlementAmount,
        settlementDecimals
      );

    /*
     * ------------------------------------------------
     * 0x API KEY
     * ------------------------------------------------
     */

    const zeroXApiKey =
      process.env
        .ZEROX_API_KEY
        ?.trim();

    if (!zeroXApiKey) {
      console.error(
        "ZEROX_API_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Swap API configuration is missing.",
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------
     * 0x EXACT BUY PRICE
     * ------------------------------------------------
     *
     * We ask:
     *
     * "How much ETH/BNB is required to obtain
     * exactly the total amount of USDC/USDT that
     * Paycrest will require, including our sender fee?"
     */

    const zeroXParams =
      new URLSearchParams({
        chainId:
          String(
            tokenConfig.chainId
          ),

        sellToken:
          NATIVE_TOKEN_ADDRESS,

        buyToken:
          settlementTokenAddress,

        buyAmount,

        taker:
          walletAddress,
      });

    const zeroXUrl =
      `${ZEROX_API}?${zeroXParams.toString()}`;

    console.log(
      "0x NATIVE SWAP PRICE REQUEST:",
      {
        token,

        settlementToken,

        chainId:
          tokenConfig.chainId,

        settlementAmount,

        senderFeePercent,

        senderFee,

        totalSettlementAmount,

        buyAmount,
      }
    );

    const zeroXResponse =
      await fetch(
        zeroXUrl,
        {
          method:
            "GET",

          headers: {
            "0x-api-key":
              zeroXApiKey,

            "0x-version":
              "v2",

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    const zeroXText =
      await zeroXResponse.text();

    let zeroXData:
      any = null;

    try {
      zeroXData =
        JSON.parse(
          zeroXText
        );
    } catch {
      zeroXData = {
        raw:
          zeroXText,
      };
    }

    if (
      !zeroXResponse.ok
    ) {
      console.error(
        "0x NATIVE SWAP PRICE ERROR:",
        {
          status:
            zeroXResponse.status,

          data:
            zeroXData,
        }
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Unable to calculate the native token swap.",

          details:
            zeroXData,
        },
        {
          status:
            502,
        }
      );
    }

    /*
     * ------------------------------------------------
     * LIQUIDITY CHECK
     * ------------------------------------------------
     */

    if (
      zeroXData?.liquidityAvailable ===
      false
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Insufficient ${token} liquidity for this transaction.`,
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * EXTRACT NATIVE TOKEN AMOUNT
     * ------------------------------------------------
     */

    const nativeAmountBaseUnits =
      zeroXData
        ?.maxSellAmount ??
      zeroXData
        ?.sellAmount;

    if (
      !nativeAmountBaseUnits
    ) {
      console.error(
        "0x response did not contain maxSellAmount/sellAmount:",
        zeroXData
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Invalid native-token swap quote returned by 0x.",
        },
        { status: 502 }
      );
    }

    const nativeAmount =
      fromBaseUnits(
        nativeAmountBaseUnits,
        tokenConfig.nativeDecimals
      );

    /*
     * ------------------------------------------------
     * RESPONSE
     * ------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        token,

        network,

        fiat:
          FIAT,

        nairaAmount,

        /*
         * Amount of native ETH/BNB the user
         * approximately needs to send.
         */

        cryptoAmount:
          nativeAmount,

        requiresSwap:
          true,

        /*
         * Paycrest principal amount that
         * corresponds to the requested NGN.
         */

        settlementAmount,

        /*
         * Biyaport's sender fee.
         */

        senderFeePercent,

        senderFee,

        /*
         * Principal + sender fee.
         *
         * This is the amount 0x is currently
         * targeting.
         */

        totalSettlementAmount,

        swap: {
          sellToken:
            token,

          buyToken:
            settlementToken,

          sellTokenAddress:
            NATIVE_TOKEN_ADDRESS,

          buyTokenAddress:
            settlementTokenAddress,

          chainId:
            tokenConfig.chainId,

          /*
           * Principal only.
           */

          settlementAmount,

          /*
           * Principal + sender fee.
           */

          totalSettlementAmount,

          settlementAmountBaseUnits:
            buyAmount,

          nativeAmount,

          nativeAmountBaseUnits,

          indicative:
            true,
        },

        rate:
          settlementRate,

        settlementToken,
      }
    );
  } catch (error) {
    console.error(
      "OFFRAMP QUOTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to calculate crypto equivalent.",
      },
      { status: 500 }
    );
  }
}