import { NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/sender/orders";

const SUPPORTED_TOKENS = [
  "USDT",
  "USDC",
] as const;

const SUPPORTED_NETWORKS = [
  "base",
  "bnb-smart-chain",
] as const;

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
   * Base
   */
  if (
    normalized === "base" ||
    normalized === "base mainnet"
  ) {
    return "base";
  }

  /*
   * BNB Smart Chain
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

      /*
       * Refund account details.
       */
      institution,
      accountNumber,
      accountName,

      reference,
    } = body;

    /*
     * --------------------------------------------
     * NORMALIZE
     * --------------------------------------------
     */

    const token =
      String(
        crypto || ""
      )
        .trim()
        .toUpperCase();

    const normalizedNetwork =
      normalizeNetwork(
        network
      );

    /*
     * --------------------------------------------
     * VALIDATION
     * --------------------------------------------
     */

    if (!amount) {
      return NextResponse.json(
        {
          error:
            "Amount is required",
        },
        { status: 400 }
      );
    }

    if (
      !SUPPORTED_TOKENS.includes(
        token as SupportedToken
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported crypto",

          receivedCrypto:
            crypto,

          normalizedCrypto:
            token,

          supportedTokens:
            SUPPORTED_TOKENS,
        },
        { status: 400 }
      );
    }

    if (
      !SUPPORTED_NETWORKS.includes(
        normalizedNetwork as SupportedNetwork
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported network",

          receivedNetwork:
            network,

          normalizedNetwork,

          supportedNetworks:
            SUPPORTED_NETWORKS,
        },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        {
          error:
            "Wallet address is required",
        },
        { status: 400 }
      );
    }

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        walletAddress
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid wallet address",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------
     * REFUND ACCOUNT VALIDATION
     * --------------------------------------------
     */

    if (
      !institution ||
      !accountNumber ||
      !accountName
    ) {
      console.error(
        "Missing refund account details:",
        {
          institution,
          accountNumber,
          accountName,
        }
      );

      return NextResponse.json(
        {
          error:
            "Refund account details are required",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------
     * PAYCREST API KEY
     * --------------------------------------------
     */

    const apiKey =
      process.env.PAYCREST_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "PAYCREST_API_KEY is missing"
      );

      return NextResponse.json(
        {
          error:
            "Paycrest configuration is missing",
        },
        { status: 500 }
      );
    }

    /*
     * --------------------------------------------
     * CREATE PAYCREST ONRAMP ORDER
     *
     * Fiat -> Crypto
     *
     * IMPORTANT:
     *
     * Biyaport does NOT define senderFeePercent.
     *
     * Paycrest determines the applicable
     * sender fee and returns it in the order.
     * --------------------------------------------
     */

    const paycrestPayload = {
      amount:
        String(amount),

      /*
       * The amount above is NGN.
       */
      amountIn:
        "fiat",

      source: {
        type:
          "fiat",

        currency:
          "NGN",

        refundAccount: {
          institution:
            institution,

          accountIdentifier:
            accountNumber,

          accountName:
            accountName,
        },
      },

      destination: {
        type:
          "crypto",

        currency:
          token,

        recipient: {
          address:
            walletAddress,

          /*
           * Paycrest network ID.
           *
           * Base:
           * "base"
           *
           * BNB Smart Chain:
           * "bnb-smart-chain"
           */
          network:
            normalizedNetwork,
        },
      },

      /*
       * Biyaport internal reference.
       */
      reference,
    };

    console.log(
      "Creating Paycrest onramp order:",
      JSON.stringify(
        paycrestPayload,
        null,
        2
      )
    );

    /*
     * --------------------------------------------
     * PAYCREST REQUEST
     * --------------------------------------------
     */

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
              paycrestPayload
            ),

          cache:
            "no-store",
        }
      );

    /*
     * --------------------------------------------
     * RAW RESPONSE
     * --------------------------------------------
     */

    const responseText =
      await response.text();

    console.log(
      "PAYCREST ONRAMP HTTP STATUS:",
      response.status
    );

    console.log(
      "PAYCREST ONRAMP RAW RESPONSE:",
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

    /*
     * --------------------------------------------
     * HANDLE PAYCREST ERROR
     * --------------------------------------------
     */

    if (!response.ok) {
      console.error(
        "Paycrest onramp error:",
        data
      );

      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Failed to create Paycrest onramp order",

          details:
            data?.data ||
            null,
        },
        {
          status:
            response.status,
        }
      );
    }

    /*
     * --------------------------------------------
     * EXTRACT ORDER
     * --------------------------------------------
     */

    const order =
      data?.data;

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Invalid response from Paycrest",
        },
        { status: 502 }
      );
    }

    console.log(
      "PAYCREST ONRAMP ORDER:",
      JSON.stringify(
        order,
        null,
        2
      )
    );

    /*
     * --------------------------------------------
     * RETURN ORDER
     *
     * Paycrest is the source of truth for:
     *
     * - senderFee
     * - senderFeePercent
     * - transactionFee
     *
     * Biyaport does not calculate or override
     * any of these values.
     * --------------------------------------------
     */

    return NextResponse.json(
      {
        success:
          true,

        orderId:
          order.id,

        status:
          order.status,

        reference:
          order.reference,

        amount:
          order.amount,

        amountIn:
          order.amountIn,

        rate:
          order.rate,

        /*
         * Paycrest-calculated sender fee.
         */
        senderFee:
          order.senderFee,

        /*
         * Paycrest-calculated sender fee percentage,
         * when provided by Paycrest.
         */
        senderFeePercent:
          order.senderFeePercent,

        /*
         * Paycrest transaction/network fee,
         * when provided by Paycrest.
         */
        transactionFee:
          order.transactionFee,

        providerAccount:
          order.providerAccount,

        source:
          order.source,

        destination:
          order.destination,

        /*
         * Explicit network returned
         * to the frontend.
         */
        network:
          normalizedNetwork,

        token,

        validUntil:
          order
            .providerAccount
            ?.validUntil,
      }
    );
  } catch (error) {
    console.error(
      "Onramp route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error",
      },
      { status: 500 }
    );
  }
}