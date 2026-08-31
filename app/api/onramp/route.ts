import { NextResponse } from "next/server";

const PAYCREST_API = "https://api.paycrest.io/v2/sender/orders";

const SUPPORTED_TOKENS = ["USDT", "USDC"] as const;
const SUPPORTED_NETWORKS = ["base"] as const;

// Your Biyaport fee.
// Example: 1% = "1"
const SENDER_FEE_PERCENT = "1";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      amount,
      crypto,
      network,
      walletAddress,
      refundInstitution,
      refundAccountNumber,
      refundAccountName,
      reference,
    } = body;

    /*
     * --------------------------------------------
     * VALIDATION
     * --------------------------------------------
     */

    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    if (!crypto || !SUPPORTED_TOKENS.includes(crypto)) {
      return NextResponse.json(
        { error: "Unsupported crypto" },
        { status: 400 }
      );
    }

    if (!network || !SUPPORTED_NETWORKS.includes(network)) {
      return NextResponse.json(
        { error: "Unsupported network" },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    if (
      !refundInstitution ||
      !refundAccountNumber ||
      !refundAccountName
    ) {
      return NextResponse.json(
        { error: "Refund account details are required" },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------
     * PAYCREST API KEY
     * --------------------------------------------
     */

    const apiKey = process.env.PAYCREST_API_KEY;

    if (!apiKey) {
      console.error("PAYCREST_API_KEY is missing");

      return NextResponse.json(
        { error: "Paycrest configuration is missing" },
        { status: 500 }
      );
    }

    /*
     * --------------------------------------------
     * CREATE ONRAMP ORDER
     * --------------------------------------------
     */

    const paycrestPayload = {
      amount: String(amount),

      // The amount above is NGN.
      amountIn: "fiat",

      source: {
        type: "fiat",
        currency: "NGN",

        // Where Paycrest should refund the user
        // if the order needs to be refunded.
        refundAccount: {
          institution: refundInstitution,
          accountIdentifier: refundAccountNumber,
          accountName: refundAccountName,
        },
      },

      destination: {
        type: "crypto",
        currency: crypto,

        recipient: {
          address: walletAddress,
          network,
        },
      },

      // Biyaport's internal order/reference ID
      reference,

      // Biyaport's fee
      senderFeePercent: SENDER_FEE_PERCENT,
    };

    console.log("Creating Paycrest onramp order:", paycrestPayload);

    const response = await fetch(PAYCREST_API, {
      method: "POST",

      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(paycrestPayload),
    });

    const data = await response.json();

    /*
     * --------------------------------------------
     * HANDLE PAYCREST ERROR
     * --------------------------------------------
     */

    if (!response.ok) {
      console.error("Paycrest onramp error:", data);

      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Failed to create Paycrest onramp order",
        },
        { status: response.status }
      );
    }

    const order = data?.data;

    if (!order) {
      return NextResponse.json(
        { error: "Invalid response from Paycrest" },
        { status: 502 }
      );
    }

    /*
     * --------------------------------------------
     * RETURN ORDER TO BIYAPORT
     * --------------------------------------------
     */

    return NextResponse.json({
      success: true,

      orderId: order.id,
      status: order.status,

      reference: order.reference,

      amount: order.amount,
      amountIn: order.amountIn,

      rate: order.rate,

      senderFee: order.senderFee,
      senderFeePercent: order.senderFeePercent,

      transactionFee: order.transactionFee,

      providerAccount: order.providerAccount,

      source: order.source,
      destination: order.destination,

      validUntil: order.providerAccount?.validUntil,
    });
  } catch (error) {
    console.error("Onramp route error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}