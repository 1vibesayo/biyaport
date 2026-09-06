import { NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/sender/orders";

const ZEROX_API =
  "https://api.0x.org/swap/allowance-holder/quote";

const SUPPORTED_TOKENS = [
  "USDT",
  "USDC",
  "ETH",
] as const;

const SUPPORTED_NETWORKS = [
  "base",
  "bnb-smart-chain",
] as const;

const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const BASE_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
  if (
    typeof value !== "string"
  ) {
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

  /*
   * BASE
   */

  if (
    normalized === "base" ||
    normalized === "base mainnet"
  ) {
    return "base";
  }

  /*
   * BNB SMART CHAIN
   */

  if (
    normalized ===
      "bnb-smart-chain" ||
    normalized ===
      "bnb smart chain" ||
    normalized ===
      "bnb smart chain mainnet" ||
    normalized === "bsc" ||
    normalized ===
      "bsc mainnet"
  ) {
    return "bnb-smart-chain";
  }

  return normalized;
}

/*
 * ------------------------------------------------
 * CONVERT DECIMAL TO BASE UNITS
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

  return (
    whole +
    paddedFraction
  ).replace(
    /^0+(?=\d)/,
    ""
  );
}

/*
 * ------------------------------------------------
 * POST
 * ------------------------------------------------
 */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const {
      amount,
      crypto,
      network,
      walletAddress,

      institution,
      accountNumber,
      accountName,

      reference,

      /*
       * Used by native-asset swaps.
       *
       * This is the Paycrest settlement
       * amount calculated by /api/quote.
       */
      settlementAmount,
    } = body;

    /*
     * ------------------------------------------------
     * REQUIRED FIELDS
     * ------------------------------------------------
     */

    if (
      !amount ||
      !crypto ||
      !network ||
      !walletAddress ||
      !institution ||
      !accountNumber ||
      !accountName
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required transaction details.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * CRYPTO NORMALIZATION
     * ------------------------------------------------
     */

    const normalizedCrypto =
      String(
        crypto
      )
        .trim()
        .toUpperCase();

    /*
     * ------------------------------------------------
     * CRYPTO VALIDATION
     * ------------------------------------------------
     */

    if (
      !SUPPORTED_TOKENS.includes(
        normalizedCrypto as SupportedToken
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported cryptocurrency. Biyaport currently supports USDT, USDC and ETH.",

          receivedCrypto:
            crypto,

          normalizedCrypto,

          supportedTokens:
            SUPPORTED_TOKENS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * NETWORK NORMALIZATION
     * ------------------------------------------------
     */

    const normalizedNetwork =
      normalizeNetwork(
        network
      );

    /*
     * ------------------------------------------------
     * NETWORK VALIDATION
     * ------------------------------------------------
     */

    if (
      !SUPPORTED_NETWORKS.includes(
        normalizedNetwork as SupportedNetwork
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported network. Biyaport currently supports Base and BNB Smart Chain.",

          receivedNetwork:
            network,

          normalizedNetwork,

          supportedNetworks:
            SUPPORTED_NETWORKS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * ETH NETWORK VALIDATION
     * ------------------------------------------------
     */

    if (
      normalizedCrypto === "ETH" &&
      normalizedNetwork !== "base"
    ) {
      return NextResponse.json(
        {
          error:
            "ETH is currently supported only on Base.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * WALLET VALIDATION
     * ------------------------------------------------
     */

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        walletAddress
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid wallet address.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST API KEY
     * ------------------------------------------------
     */

    const apiKey =
      process.env
        .PAYCREST_API_KEY
        ?.trim();

    if (!apiKey) {
      console.error(
        "PAYCREST_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "Paycrest API configuration is missing.",
        },
        { status: 500 }
      );
    }

    /*
     * =================================================
     * DIRECT TOKENS
     * =================================================
     *
     * Existing USDT / USDC flow.
     *
     * DO NOT CHANGE THE EXISTING BEHAVIOUR.
     */

    if (
      normalizedCrypto === "USDT" ||
      normalizedCrypto === "USDC"
    ) {
      const payload = {
        amount:
          String(amount),

        source: {
          type:
            "crypto",

          currency:
            normalizedCrypto,

          network:
            normalizedNetwork,

          refundAddress:
            walletAddress,
        },

        destination: {
          type:
            "fiat",

          currency:
            "NGN",

          recipient: {
            institution,

            accountIdentifier:
              accountNumber,

            accountName,
          },
        },

        reference:
          reference ||
          `biyaport-${Date.now()}`,
      };

      console.log(
        "PAYCREST OFFRAMP ORDER REQUEST:",
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      const response =
        await fetch(
          PAYCREST_API,
          {
            method:
              "POST",

            headers: {
              "API-Key":
                apiKey,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),

            cache:
              "no-store",
          }
        );

      const responseText =
        await response.text();

      console.log(
        "PAYCREST CREATE ORDER STATUS:",
        response.status
      );

      console.log(
        "PAYCREST CREATE ORDER RESPONSE:",
        responseText
      );

      let data: any =
        null;

      try {
        data =
          JSON.parse(
            responseText
          );
      } catch {
        data = {
          raw:
            responseText,
        };
      }

      if (!response.ok) {
        console.error(
          "PAYCREST OFFRAMP ORDER ERROR:",
          data
        );

        return NextResponse.json(
          {
            error:
              data?.message ||
              data?.error ||
              "Paycrest order creation failed.",

            details:
              data,
          },
          {
            status:
              response.status,
          }
        );
      }

      const order =
        data?.data ??
        data;

      const providerAccount =
        order?.providerAccount ??
        {};

      const receiveAddress =
        providerAccount
          ?.receiveAddress ||
        providerAccount
          ?.address ||
        null;

      const validUntil =
        providerAccount
          ?.validUntil ||
        null;

      const providerNetwork =
        providerAccount
          ?.network ||
        normalizedNetwork;

      return NextResponse.json(
        {
          success:
            true,

          orderId:
            order?.id ??
            null,

          status:
            order?.status ??
            null,

          amount:
            order?.amount ??
            String(amount),

          senderFee:
            order?.senderFee ??
            null,

          transactionFee:
            order?.transactionFee ??
            null,

          providerAccount,

          receiveAddress,

          validUntil,

          providerNetwork,

          crypto:
            normalizedCrypto,

          network:
            normalizedNetwork,

          walletAddress,

          source:
            order?.source ??
            null,

          destination:
            order?.destination ??
            null,

          reference:
            order?.reference ??
            reference ??
            null,
        }
      );
    }

    /*
     * =================================================
     * ETH → USDC → PAYCREST
     * =================================================
     */

    if (
      normalizedCrypto === "ETH"
    ) {
      /*
       * ------------------------------------------------
       * BASE ONLY
       * ------------------------------------------------
       */

      if (
        normalizedNetwork !==
        "base"
      ) {
        return NextResponse.json(
          {
            error:
              "ETH offramp is currently available only on Base.",
          },
          { status: 400 }
        );
      }

      /*
       * ------------------------------------------------
       * VALIDATE SETTLEMENT AMOUNT
       * ------------------------------------------------
       *
       * This value comes from /api/quote.
       *
       * It represents the Paycrest principal
       * amount in USDC.
       */

      const principalUSDC =
        Number(
          settlementAmount
        );

      if (
        !Number.isFinite(
          principalUSDC
        ) ||
        principalUSDC <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "A valid USDC settlement amount is required for ETH transactions.",
          },
          { status: 400 }
        );
      }

      /*
       * ------------------------------------------------
       * CREATE PAYCREST ORDER
       * ------------------------------------------------
       *
       * IMPORTANT:
       *
       * Paycrest is receiving USDC, not ETH.
       *
       * The user holds ETH, so 0x will swap:
       *
       * ETH → USDC
       *
       * The resulting USDC goes directly to
       * Paycrest's receiveAddress.
       */

      const payload = {
        amount:
          principalUSDC.toFixed(6),

        source: {
          type:
            "crypto",

          currency:
            "USDC",

          network:
            "base",

          refundAddress:
            walletAddress,
        },

        destination: {
          type:
            "fiat",

          currency:
            "NGN",

          recipient: {
            institution,

            accountIdentifier:
              accountNumber,

            accountName,
          },
        },

        reference:
          reference ||
          `biyaport-${Date.now()}`,
      };

      console.log(
        "PAYCREST ETH→USDC ORDER REQUEST:",
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      const paycrestResponse =
        await fetch(
          PAYCREST_API,
          {
            method:
              "POST",

            headers: {
              "API-Key":
                apiKey,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),

            cache:
              "no-store",
          }
        );

      const paycrestText =
        await paycrestResponse.text();

      console.log(
        "PAYCREST ETH ORDER STATUS:",
        paycrestResponse.status
      );

      console.log(
        "PAYCREST ETH ORDER RESPONSE:",
        paycrestText
      );

      let paycrestData: any =
        null;

      try {
        paycrestData =
          JSON.parse(
            paycrestText
          );
      } catch {
        paycrestData = {
          raw:
            paycrestText,
        };
      }

      /*
       * ------------------------------------------------
       * PAYCREST ERROR
       * ------------------------------------------------
       */

      if (
        !paycrestResponse.ok
      ) {
        console.error(
          "PAYCREST ETH ORDER ERROR:",
          paycrestData
        );

        return NextResponse.json(
          {
            error:
              paycrestData?.message ||
              paycrestData?.error ||
              "Paycrest order creation failed.",

            details:
              paycrestData,
          },
          {
            status:
              paycrestResponse.status,
          }
        );
      }

      /*
       * ------------------------------------------------
       * NORMALIZE PAYCREST ORDER
       * ------------------------------------------------
       */

      const order =
        paycrestData?.data ??
        paycrestData;

      const providerAccount =
        order?.providerAccount ??
        {};

      const receiveAddress =
        providerAccount
          ?.receiveAddress ||
        providerAccount
          ?.address ||
        null;

      const validUntil =
        providerAccount
          ?.validUntil ||
        null;

      if (
        !receiveAddress ||
        !/^0x[a-fA-F0-9]{40}$/.test(
          receiveAddress
        )
      ) {
        console.error(
          "PAYCREST DID NOT RETURN A VALID RECEIVE ADDRESS:",
          order
        );

        return NextResponse.json(
          {
            error:
              "Paycrest did not return a valid settlement address.",

            details:
              order,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * PAYCREST FEES
       * ------------------------------------------------
       */

      const paycrestAmount =
        Number(
          order?.amount
        );

      const senderFee =
        Number(
          order?.senderFee ||
          0
        );

      const transactionFee =
        Number(
          order?.transactionFee ||
          0
        );

      if (
        !Number.isFinite(
          paycrestAmount
        ) ||
        paycrestAmount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Paycrest returned an invalid settlement amount.",

            details:
              order,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * TOTAL USDC REQUIRED
       * ------------------------------------------------
       *
       * This is the authoritative amount that
       * needs to be delivered to Paycrest.
       *
       * amount
       * + senderFee
       * + transactionFee
       */

      const totalUSDC =
        paycrestAmount +
        senderFee +
        transactionFee;

      const totalUSDCBaseUnits =
        toBaseUnits(
          totalUSDC,
          6
        );

      console.log(
        "PAYCREST ETH SETTLEMENT:",
        {
          amount:
            paycrestAmount,

          senderFee,

          transactionFee,

          totalUSDC,

          totalUSDCBaseUnits,

          receiveAddress,
        }
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
            error:
              "Swap API configuration is missing.",
          },
          { status: 500 }
        );
      }

      /*
       * ------------------------------------------------
       * 0x EXACT BUY
       * ------------------------------------------------
       *
       * We ask 0x:
       *
       * "Take ETH from this wallet and acquire
       * exactly this amount of USDC, sending
       * the USDC directly to Paycrest."
       */

      const zeroXParams =
        new URLSearchParams({
          chainId:
            "8453",

          sellToken:
            NATIVE_TOKEN_ADDRESS,

          buyToken:
            BASE_USDC_ADDRESS,

          buyAmount:
            totalUSDCBaseUnits,

          taker:
            walletAddress,

          recipient:
            receiveAddress,
        });

      const zeroXUrl =
        `${ZEROX_API}?${zeroXParams.toString()}`;

      console.log(
        "0x ETH EXACT BUY REQUEST:",
        {
          chainId:
            "8453",

          sellToken:
            NATIVE_TOKEN_ADDRESS,

          buyToken:
            BASE_USDC_ADDRESS,

          buyAmount:
            totalUSDCBaseUnits,

          recipient:
            receiveAddress,
        }
      );

      /*
       * ------------------------------------------------
       * REQUEST FIRM QUOTE
       * ------------------------------------------------
       */

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

      console.log(
        "0x ETH QUOTE STATUS:",
        zeroXResponse.status
      );

      console.log(
        "0x ETH QUOTE RESPONSE:",
        zeroXText
      );

      let zeroXData: any =
        null;

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

      /*
       * ------------------------------------------------
       * 0x ERROR
       * ------------------------------------------------
       */

      if (
        !zeroXResponse.ok
      ) {
        console.error(
          "0x ETH QUOTE ERROR:",
          zeroXData
        );

        return NextResponse.json(
          {
            error:
              "Unable to prepare the ETH swap.",

            details:
              zeroXData,

            paycrestOrderId:
              order?.id ??
              null,
          },
          {
            status:
              502,
          }
        );
      }

      /*
       * ------------------------------------------------
       * EXTRACT TRANSACTION
       * ------------------------------------------------
       *
       * In 0x v2 the executable transaction
       * fields live under:
       *
       * quote.transaction
       */

      const transaction =
        zeroXData?.transaction;

      if (
        !transaction?.to ||
        !transaction?.data
      ) {
        console.error(
          "0x QUOTE DID NOT RETURN A VALID TRANSACTION:",
          zeroXData
        );

        return NextResponse.json(
          {
            error:
              "0x did not return a valid swap transaction.",

            details:
              zeroXData,

            paycrestOrderId:
              order?.id ??
              null,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * EXTRACT MAX ETH
       * ------------------------------------------------
       */

      const maxSellAmount =
        zeroXData
          ?.maxSellAmount ??
        zeroXData
          ?.sellAmount ??
        null;

      if (
        !maxSellAmount
      ) {
        return NextResponse.json(
          {
            error:
              "0x did not return the required ETH amount.",

            details:
              zeroXData,

            paycrestOrderId:
              order?.id ??
              null,
          },
          { status: 502 }
        );
      }

      /*
       * ------------------------------------------------
       * RETURN EVERYTHING FRONTEND NEEDS
       * ------------------------------------------------
       */

      return NextResponse.json(
        {
          success:
            true,

          /*
           * Paycrest
           */

          orderId:
            order?.id ??
            null,

          status:
            order?.status ??
            null,

          paycrestAmount:
            order?.amount ??
            null,

          senderFee:
            order?.senderFee ??
            null,

          transactionFee:
            order?.transactionFee ??
            null,

          totalUSDC,

          receiveAddress,

          validUntil,

          providerAccount,

          /*
           * Asset
           */

          crypto:
            "ETH",

          network:
            "base",

          walletAddress,

          /*
           * 0x
           */

          swap: {
            sellToken:
              NATIVE_TOKEN_ADDRESS,

            buyToken:
              BASE_USDC_ADDRESS,

            buyAmount:
              totalUSDCBaseUnits,

            recipient:
              receiveAddress,

            taker:
              walletAddress,

            chainId:
              8453,

            maxSellAmount,

            estimatedETH:
              zeroXData
                ?.estimatedGas ??
              null,
          },

          /*
           * The actual transaction the
           * wallet needs to sign.
           */

          transaction: {
            to:
              transaction.to,

            data:
              transaction.data,

            value:
              transaction.value ??
              "0",

            gas:
              transaction.gas ??
              undefined,

            gasPrice:
              transaction.gasPrice ??
              undefined,

            chainId:
              8453,
          },

          /*
           * Raw 0x response is useful while
           * we're testing.
           */

          zeroXQuote:
            zeroXData,
        }
      );
    }

    /*
     * ------------------------------------------------
     * FALLBACK
     * ------------------------------------------------
     */

    return NextResponse.json(
      {
        error:
          "Unsupported transaction type.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "PAYCREST CREATE OFFRAMP ORDER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create Paycrest transaction.",
      },
      { status: 500 }
    );
  }
}