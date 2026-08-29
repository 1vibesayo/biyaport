import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
     * SUPPORTED CRYPTOCURRENCIES
     * ------------------------------------------------
     *
     * Biyaport currently supports:
     *
     * - USDT
     * - USDC
     *
     * Both are currently intended for
     * the Base network.
     */

    const supportedCryptos = ["USDT", "USDC"];

    const normalizedCrypto = String(
      crypto
    ).toUpperCase();

    if (
      !supportedCryptos.includes(
        normalizedCrypto
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported cryptocurrency. Biyaport currently supports USDT and USDC.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * NETWORK VALIDATION
     * ------------------------------------------------
     *
     * USDT and USDC are currently supported
     * on Base in the Biyaport flow.
     */

    const normalizedNetwork = String(
      network
    ).toLowerCase();

    if (normalizedNetwork !== "base") {
      return NextResponse.json(
        {
          error:
            "Unsupported network. Biyaport currently supports USDT and USDC on Base.",
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
      process.env.PAYCREST_API_KEY;

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
     */

    const payload = {
      amount: String(amount),

      source: {
        type: "crypto",
        currency: normalizedCrypto,
        network: normalizedNetwork,
        refundAddress: walletAddress,
      },

      destination: {
        type: "fiat",
        currency: "NGN",

        recipient: {
          institution,
          accountIdentifier: accountNumber,
          accountName,
        },
      },

      reference:
        reference ||
        `biyaport-${Date.now()}`,
    };

    console.log(
      "PAYCREST ORDER REQUEST:",
      JSON.stringify(payload)
    );

    /*
     * ------------------------------------------------
     * CREATE PAYCREST ORDER
     * ------------------------------------------------
     */

    const response = await fetch(
      "https://api.paycrest.io/v2/sender/orders",
      {
        method: "POST",

        headers: {
          "API-Key": apiKey,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    console.log(
      "PAYCREST CREATE ORDER STATUS:",
      response.status
    );

    console.log(
      "PAYCREST CREATE ORDER RESPONSE:",
      JSON.stringify(data)
    );

    /*
     * ------------------------------------------------
     * PAYCREST ERROR
     * ------------------------------------------------
     */

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Paycrest order creation failed.",

          details: data,
        },
        {
          status: response.status,
        }
      );
    }

    /*
     * ------------------------------------------------
     * NORMALIZE ORDER RESPONSE
     * ------------------------------------------------
     */

    const order = data?.data ?? data;

    const providerAccount =
      order?.providerAccount ?? {};

    /*
     * This is the address the user's crypto
     * should be sent to for this Paycrest order.
     */

    const receiveAddress =
      providerAccount?.receiveAddress ||
      providerAccount?.address ||
      null;

    const validUntil =
      providerAccount?.validUntil ||
      null;

    const providerNetwork =
      providerAccount?.network ||
      normalizedNetwork;

    /*
     * ------------------------------------------------
     * RETURN RESPONSE TO CLIENT
     * ------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      orderId:
        order?.id ?? null,

      status:
        order?.status ?? null,

      amount:
        order?.amount ??
        String(amount),

      senderFee:
        order?.senderFee ?? null,

      transactionFee:
        order?.transactionFee ?? null,

      providerAccount,

      receiveAddress,

      validUntil,

      providerNetwork,

      /*
       * Keep these available to page.tsx so
       * the client knows exactly which asset
       * and network were used.
       */

      crypto:
        normalizedCrypto,

      network:
        normalizedNetwork,

      walletAddress,

      source:
        order?.source ?? null,

      destination:
        order?.destination ?? null,

      reference:
        order?.reference ??
        reference ??
        null,
    });
  } catch (error) {
    console.error(
      "PAYCREST CREATE ORDER ERROR:",
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
