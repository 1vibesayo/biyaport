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

function normalizeNetwork(
  value: unknown
): string {
  const network = String(
    value || ""
  )
    .trim()
    .toLowerCase();

  if (
    network === "bsc" ||
    network === "bnb" ||
    network === "binance-smart-chain"
  ) {
    return "bnb-smart-chain";
  }

  if (network === "ethereum") {
    return "ethereum";
  }

  if (network === "polygon") {
    return "polygon";
  }

  if (network === "arbitrum") {
    return "arbitrum";
  }

  if (network === "base") {
    return "base";
  }

  return network;
}

function toBaseUnits(
  amount: number,
  decimals: number
): string {
  const [whole, fraction = ""] =
    amount
      .toFixed(decimals)
      .split(".");

  const paddedFraction =
    fraction.padEnd(
      decimals,
      "0"
    );

  return `${whole}${paddedFraction}`.replace(
    /^0+(?=\d)/,
    ""
  );
}

function fromBaseUnits(
  amount: string,
  decimals: number
): number {
  if (!amount) {
    return 0;
  }

  const raw = BigInt(amount);

  if (decimals === 0) {
    return Number(raw);
  }

  const divisor =
    10 ** decimals;

  return Number(raw) / divisor;
}

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

async function getPaycrestRate(
  network: string,
  token: string,
  amount: number
) {
  const safeAmount = Math.max(
    amount,
    0.000001
  );

  const url =
    `${PAYCREST_API}/` +
    `${network}/` +
    `${token}/` +
    `${safeAmount}/` +
    `${FIAT}` +
    `?side=sell`;

  const response =
    await fetch(url, {
      cache: "no-store",
      headers: {
        Accept:
          "application/json",
      },
    });

  let data: any = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (
    !response.ok ||
    data?.status !== "success"
  ) {
    console.error(
      "PAYCREST RATE ERROR:",
      {
        status:
          response.status,
        data,
      }
    );

    throw new Error(
      "Unable to get crypto rate."
    );
  }

  const rate =
    Number(
      data?.data?.sell?.rate
    );

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(
      "Invalid crypto rate returned by Paycrest."
    );
  }

  return {
    rate,
    data,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const token =
      String(
        body.token || ""
      )
        .trim()
        .toUpperCase();

    const rawNetwork =
      body.network ??
      body.chain ??
      body.selectedNetwork ??
      "base";

    const network =
      normalizeNetwork(
        rawNetwork
      );

    const inputMode =
      body.inputMode ===
      "crypto"
        ? "crypto"
        : "naira";

    const walletAddress =
      String(
        body.walletAddress ||
          body.taker ||
          ""
      ).trim();

    const nairaAmount =
      Number(
        body.nairaAmount
      );

    const cryptoAmountInput =
      Number(
        body.cryptoAmount
      );

    const senderFeePercent =
      getSenderFeePercent();

    console.log(
      "OFFRAMP QUOTE REQUEST:",
      {
        token,
        rawNetwork,
        normalizedNetwork:
          network,
        inputMode,
        nairaAmount,
        cryptoAmountInput,
        senderFeePercent,
        walletAddress,
      }
    );

    /*
     * ------------------------------------------------
     * VALIDATION
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
            "Unsupported crypto.",
        },
        { status: 400 }
      );
    }

    if (
      !SUPPORTED_NETWORKS.includes(
        network as SupportedNetwork
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported network.",
        },
        { status: 400 }
      );
    }

    if (
      token === "ETH" &&
      network !== "base"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ETH offramp is currently available on Base only.",
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
            "BNB offramp is currently available on BSC only.",
        },
        { status: 400 }
      );
    }

    if (
      inputMode === "naira" &&
      (!Number.isFinite(
        nairaAmount
      ) ||
        nairaAmount <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid Naira amount.",
        },
        { status: 400 }
      );
    }

    if (
      inputMode === "crypto" &&
      (!Number.isFinite(
        cryptoAmountInput
      ) ||
        cryptoAmountInput <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid crypto amount.",
        },
        { status: 400 }
      );
    }

    const tokenConfig =
      TOKEN_CONFIG[
        token as keyof typeof TOKEN_CONFIG
      ];

    /*
     * ==================================================
     * DIRECT TOKENS
     * USDT / USDC
     * ==================================================
     */

    if (
      tokenConfig.type ===
      "direct"
    ) {
      /*
       * ------------------------------------------------
       * CRYPTO INPUT
       *
       * The user's entered amount is the TOTAL amount
       * they want to spend.
       *
       * Example:
       *
       * User enters 100 USDT
       * Sender fee = 5%
       *
       * Paycrest receives:
       *
       * 100 / 1.05
       * = 95.238095 USDT
       *
       * The remaining 4.761905 USDT is the sender fee.
       * ------------------------------------------------
       */

      if (
        inputMode === "crypto"
      ) {
        const totalCryptoAmount =
          cryptoAmountInput;

        const settlementAmount =
          totalCryptoAmount /
          (1 +
            senderFeePercent /
              100);

        if (
          !Number.isFinite(
            settlementAmount
          ) ||
          settlementAmount <= 0
        ) {
          throw new Error(
            "Unable to calculate the crypto amount after fees."
          );
        }

        const {
          rate,
        } =
          await getPaycrestRate(
            network,
            token,
            settlementAmount
          );

        const calculatedNairaAmount =
          settlementAmount *
          rate;

        if (
          !Number.isFinite(
            calculatedNairaAmount
          ) ||
          calculatedNairaAmount <= 0
        ) {
          throw new Error(
            "Unable to calculate the Naira equivalent."
          );
        }

        return NextResponse.json(
          {
            success: true,

            token,

            network,

            fiat: FIAT,

            inputMode:
              "crypto",

            /*
             * Total amount the user entered
             * and will pay from their wallet.
             */
            cryptoAmount:
              totalCryptoAmount,

            /*
             * Amount actually sent through
             * Paycrest after the sender fee
             * is removed.
             */
            settlementAmount,

            /*
             * Amount charged as the sender fee.
             */
            senderFeePercent,

            senderFee:
              totalCryptoAmount -
              settlementAmount,

            /*
             * Naira payout is based on the
             * post-fee amount.
             */
            nairaAmount:
              calculatedNairaAmount,

            rate,

            requiresSwap:
              false,
          }
        );
      }

      /*
       * ------------------------------------------------
       * NAIRA INPUT
       * ------------------------------------------------
       */

      const {
        rate: initialRate,
      } =
        await getPaycrestRate(
          network,
          token,
          1
        );

      let cryptoAmount =
        nairaAmount /
        initialRate;

      const {
        rate,
      } =
        await getPaycrestRate(
          network,
          token,
          cryptoAmount
        );

      cryptoAmount =
        nairaAmount /
        rate;

      return NextResponse.json(
        {
          success: true,

          token,

          network,

          fiat: FIAT,

          inputMode:
            "naira",

          nairaAmount,

          rate,

          cryptoAmount,

          requiresSwap:
            false,
        }
      );
    }

    /*
     * ==================================================
     * NATIVE TOKENS
     * ETH / BNB
     * ==================================================
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

    const settlementToken =
      tokenConfig
        .settlementToken;

    /*
     * ------------------------------------------------
     * CRYPTO INPUT
     *
     * The entered native crypto amount is the
     * user's TOTAL wallet spend.
     *
     * We first convert that total amount into
     * its post-fee settlement value.
     * ------------------------------------------------
     */

    if (
      inputMode === "crypto"
    ) {
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
              "A valid wallet address is required.",
          },
          { status: 400 }
        );
      }

      const zeroXApiKey =
        process.env
          .ZEROX_API_KEY
          ?.trim();

      if (!zeroXApiKey) {
        return NextResponse.json(
          {
            success: false,
            error:
              "0x API key is not configured.",
          },
          { status: 500 }
        );
      }

      /*
       * First determine how much settlement
       * token the user's FULL native amount
       * represents.
       */
      const totalNativeAmount =
        cryptoAmountInput;

      const sellAmount =
        toBaseUnits(
          totalNativeAmount,
          tokenConfig.nativeDecimals
        );

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

          sellAmount,

          taker:
            walletAddress,
        });

      const zeroXUrl =
        `${ZEROX_API}?${zeroXParams.toString()}`;

      const zeroXResponse =
        await fetch(
          zeroXUrl,
          {
            method: "GET",

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

      let zeroXData: any =
        null;

      try {
        zeroXData =
          JSON.parse(
            zeroXText
          );
      } catch {
        zeroXData = {
          raw: zeroXText,
        };
      }

      if (
        !zeroXResponse.ok
      ) {
        console.error(
          "0X QUOTE ERROR:",
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
              zeroXData?.reason ||
              zeroXData?.message ||
              "Unable to calculate the crypto conversion.",
          },
          {
            status:
              zeroXResponse.status,
          }
        );
      }

      if (
        zeroXData?.liquidityAvailable ===
        false
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Insufficient liquidity for this conversion.",
          },
          { status: 400 }
        );
      }

      const totalSettlementAmountBaseUnits =
        zeroXData?.buyAmount;

      if (
        !totalSettlementAmountBaseUnits
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to calculate the settlement amount.",
          },
          { status: 400 }
        );
      }

      const totalSettlementAmount =
        fromBaseUnits(
          totalSettlementAmountBaseUnits,
          settlementDecimals
        );

      /*
       * Remove the sender fee from the settlement
       * value while keeping the user's total native
       * payment unchanged.
       *
       * Example:
       *
       * 100 USDT equivalent
       * / 1.05
       * = 95.238095 USDT equivalent
       */
      const settlementAmount =
        totalSettlementAmount /
        (1 +
          senderFeePercent /
            100);

      const senderFee =
        totalSettlementAmount -
        settlementAmount;

      const {
        rate:
          settlementRate,
      } =
        await getPaycrestRate(
          network,
          settlementToken,
          settlementAmount
        );

      const calculatedNairaAmount =
        settlementAmount *
        settlementRate;

      if (
        !Number.isFinite(
          calculatedNairaAmount
        ) ||
        calculatedNairaAmount <= 0
      ) {
        throw new Error(
          "Unable to calculate the Naira equivalent."
        );
      }

      return NextResponse.json(
        {
          success: true,

          token,

          network,

          fiat: FIAT,

          inputMode:
            "crypto",

          /*
           * Full amount the user will pay.
           */
          cryptoAmount:
            totalNativeAmount,

          /*
           * Settlement amount after
           * sender fee.
           */
          settlementAmount,

          senderFeePercent,

          senderFee,

          /*
           * Naira payout is calculated
           * from the post-fee settlement.
           */
          nairaAmount:
            calculatedNairaAmount,

          rate:
            settlementRate,

          requiresSwap:
            true,

          settlementToken,

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

            settlementAmount,

            nativeAmount:
              totalNativeAmount,

            nativeAmountBaseUnits:
              sellAmount,

            indicative:
              true,
          },
        }
      );
    }

    /*
     * ------------------------------------------------
     * NAIRA INPUT
     *
     * Existing behaviour remains unchanged.
     * ------------------------------------------------
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
            "A valid wallet address is required.",
        },
        { status: 400 }
      );
    }

    const {
      rate:
        settlementInitialRate,
    } =
      await getPaycrestRate(
        network,
        settlementToken,
        1
      );

    let settlementAmount =
      nairaAmount /
      settlementInitialRate;

    const {
      rate:
        settlementRate,
    } =
      await getPaycrestRate(
        network,
        settlementToken,
        settlementAmount
      );

    settlementAmount =
      nairaAmount /
      settlementRate;

    const senderFee =
      settlementAmount *
      (senderFeePercent /
        100);

    const totalSettlementAmount =
      settlementAmount +
      senderFee;

    const buyAmount =
      toBaseUnits(
        totalSettlementAmount,
        settlementDecimals
      );

    const zeroXApiKey =
      process.env
        .ZEROX_API_KEY
        ?.trim();

    if (!zeroXApiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "0x API key is not configured.",
        },
        { status: 500 }
      );
    }

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

    const zeroXResponse =
      await fetch(
        zeroXUrl,
        {
          method: "GET",

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

    let zeroXData: any =
      null;

    try {
      zeroXData =
        JSON.parse(
          zeroXText
        );
    } catch {
      zeroXData = {
        raw: zeroXText,
      };
    }

    if (
      !zeroXResponse.ok
    ) {
      console.error(
        "0X QUOTE ERROR:",
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
            zeroXData?.reason ||
            zeroXData?.message ||
            "Unable to calculate the crypto conversion.",
        },
        {
          status:
            zeroXResponse.status,
        }
      );
    }

    if (
      zeroXData?.liquidityAvailable ===
      false
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Insufficient liquidity for this conversion.",
        },
        { status: 400 }
      );
    }

    const nativeAmountBaseUnits =
      zeroXData?.maxSellAmount ??
      zeroXData?.sellAmount;

    if (
      !nativeAmountBaseUnits
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to calculate the native crypto amount.",
        },
        { status: 400 }
      );
    }

    const nativeAmount =
      fromBaseUnits(
        nativeAmountBaseUnits,
        tokenConfig.nativeDecimals
      );

    return NextResponse.json(
      {
        success: true,

        token,

        network,

        fiat: FIAT,

        inputMode:
          "naira",

        nairaAmount,

        cryptoAmount:
          nativeAmount,

        requiresSwap:
          true,

        settlementAmount,

        senderFeePercent,

        senderFee,

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

          settlementAmount,

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
          error instanceof
          Error
            ? error.message
            : "Unable to calculate crypto equivalent.",
      },
      { status: 500 }
    );
  }
}