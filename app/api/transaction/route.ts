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
            "Unsupported cryptocurrency. Biyaport currently supports USDT and USDC.",

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
      process.env.PAYCREST_API_KEY?.trim();

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
     * ------------------------------------------------
     * PAYCREST ORDER PAYLOAD
     * ------------------------------------------------
     *
     * Crypto -> Fiat
     */

    const payload = {
      amount:
        String(amount),

      source: {
        type:
          "crypto",

        currency:
          normalizedCrypto,

        /*
         * IMPORTANT:
         *
         * Paycrest receives:
         *
         * base
         *
         * or:
         *
         * bnb-smart-chain
         */

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

    /*
     * ------------------------------------------------
     * CREATE PAYCREST ORDER
     * ------------------------------------------------
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
              payload
            ),

          cache:
            "no-store",
        }
      );

    /*
     * ------------------------------------------------
     * RAW RESPONSE
     * ------------------------------------------------
     */

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

    /*
     * ------------------------------------------------
     * PAYCREST ERROR
     * ------------------------------------------------
     */

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

    /*
     * ------------------------------------------------
     * NORMALIZE ORDER RESPONSE
     * ------------------------------------------------
     */

    const order =
      data?.data ??
      data;

    const providerAccount =
      order?.providerAccount ??
      {};

    /*
     * This is the address where the user's
     * crypto must be sent for the order.
     */

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

    /*
     * ------------------------------------------------
     * RETURN RESPONSE
     * ------------------------------------------------
     */

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

        /*
         * Selected crypto
         * and network.
         */

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