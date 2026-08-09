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

    const payload = {
      amount: String(amount),

      source: {
        type: "crypto",
        currency: crypto,
        network,
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
      network;

    return NextResponse.json({
      success: true,

      orderId: order?.id ?? null,

      status: order?.status ?? null,

      amount: order?.amount ?? String(amount),

      senderFee:
        order?.senderFee ?? null,

      transactionFee:
        order?.transactionFee ?? null,

      providerAccount,

      receiveAddress,

      validUntil,

      providerNetwork,

      /*
       * Keep these available to the client so
       * page.tsx knows exactly what was used
       * to create the order.
       */
      crypto,

      network,

      walletAddress,

      source: order?.source ?? null,

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