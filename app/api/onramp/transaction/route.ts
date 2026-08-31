import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/sender/orders";

const SUPPORTED_TOKENS = ["USDT", "USDC"] as const;

const NETWORK = "base";
const FIAT = "NGN";

type SupportedToken =
  (typeof SUPPORTED_TOKENS)[number];

export async function POST(request: NextRequest) {
  try {
    /*
     * ------------------------------------------------
     * API KEY
     * ------------------------------------------------
     */

    const apiKey = process.env.PAYCREST_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "PAYCREST_API_KEY is missing from environment variables."
      );

      return NextResponse.json(
        {
          error:
            "Paycrest API key is not configured.",
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------
     * REQUEST BODY
     * ------------------------------------------------
     */

    const body = await request.json();

    const {
      amount,
      crypto,
      walletAddress,
      reference,

      /*
       * On-ramp refund account details.
       *
       * These are required by Paycrest for the
       * fiat source.
       */
      institution,
      accountNumber,
      accountName,
    } = body;

    /*
     * ------------------------------------------------
     * NORMALIZE VALUES
     * ------------------------------------------------
     */

    const token = String(crypto || "")
      .trim()
      .toUpperCase();

    /*
     * For on-ramp:
     *
     * `amount` is the NGN amount the user is paying.
     */
    const nairaAmount = Number(amount);

    console.log(
      "PAYCREST ONRAMP TRANSACTION REQUEST:",
      {
        token,
        nairaAmount,
        walletAddress,
        reference,
        institution,
        accountNumber,
        accountName,
      }
    );

    /*
     * ------------------------------------------------
     * VALIDATE TOKEN
     * ------------------------------------------------
     */

    if (
      !SUPPORTED_TOKENS.includes(
        token as SupportedToken
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported cryptocurrency.",
          supportedTokens:
            SUPPORTED_TOKENS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * VALIDATE NGN AMOUNT
     * ------------------------------------------------
     */

    if (
      !Number.isFinite(nairaAmount) ||
      nairaAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Naira amount.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * VALIDATE WALLET
     * ------------------------------------------------
     */

    if (
      !walletAddress ||
      typeof walletAddress !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Destination wallet address is required.",
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
            "Invalid wallet address.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * VALIDATE REFERENCE
     * ------------------------------------------------
     */

    if (
      !reference ||
      typeof reference !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Transaction reference is required.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * VALIDATE REFUND ACCOUNT
     *
     * Paycrest requires refundAccount on the
     * fiat source for an on-ramp.
     * ------------------------------------------------
     */

    if (
      !institution ||
      typeof institution !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Refund bank institution is required.",
        },
        { status: 400 }
      );
    }

    if (
      !accountNumber ||
      typeof accountNumber !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Refund account number is required.",
        },
        { status: 400 }
      );
    }

    if (
      !accountName ||
      typeof accountName !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Refund account name is required.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST ON-RAMP ORDER
     *
     * Fiat → Crypto
     *
     * The user deposits NGN into the provider
     * account returned by Paycrest.
     *
     * Paycrest then sends crypto to the user's
     * wallet.
     * ------------------------------------------------
     */

    const payload = {
      amount: String(nairaAmount),

      amountIn: "fiat",

      source: {
        type: "fiat",
        currency: FIAT,

        refundAccount: {
          institution,
          accountIdentifier: accountNumber,
          accountName,
        },
      },

      destination: {
        type: "crypto",
        currency: token,

        recipient: {
          address: walletAddress,
          network: NETWORK,
        },
      },

      reference,
    };

    console.log(
      "PAYCREST ONRAMP ORDER PAYLOAD:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    /*
     * ------------------------------------------------
     * CREATE PAYCREST ORDER
     *
     * IMPORTANT:
     *
     * Paycrest v2 uses:
     *
     * API-Key: YOUR_API_KEY
     *
     * NOT:
     *
     * Authorization: Bearer YOUR_API_KEY
     * ------------------------------------------------
     */

    const orderResponse = await fetch(
      PAYCREST_API,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "API-Key": apiKey,
        },

        body: JSON.stringify(
          payload
        ),

        cache: "no-store",
      }
    );

    /*
     * ------------------------------------------------
     * PAYCREST RAW RESPONSE
     *
     * TEMPORARY DIAGNOSTIC LOGGING
     * ------------------------------------------------
     */

    const responseText =
      await orderResponse.text();

    console.log(
      "PAYCREST RAW HTTP STATUS:",
      orderResponse.status
    );

    console.log(
      "PAYCREST RAW RESPONSE TEXT:",
      responseText
    );

    let orderData: any = null;

    try {
      orderData =
        JSON.parse(responseText);
    } catch {
      orderData = {
        raw: responseText,
      };
    }

    /*
     * ------------------------------------------------
     * PAYCREST PARSED RESPONSE
     *
     * TEMPORARY DIAGNOSTIC LOGGING
     * ------------------------------------------------
     */

    console.log(
      "PAYCREST ONRAMP ORDER RESPONSE:",
      JSON.stringify(
        orderData,
        null,
        2
      )
    );

    /*
     * ------------------------------------------------
     * HANDLE PAYCREST ERROR
     * ------------------------------------------------
     */

    if (
      !orderResponse.ok ||
      orderData?.status !== "success"
    ) {
      console.error(
        "PAYCREST ONRAMP ORDER ERROR:",
        {
          status:
            orderResponse.status,
          response:
            orderData,
        }
      );

      return NextResponse.json(
        {
          error:
            orderData?.message ||
            orderData?.error ||
            "Unable to create Paycrest on-ramp transaction.",

          details:
            orderData?.data ||
            null,
        },
        {
          status:
            orderResponse.status ||
            502,
        }
      );
    }

    /*
     * ------------------------------------------------
     * EXTRACT ORDER
     * ------------------------------------------------
     */

    const order =
      orderData?.data ||
      orderData;

    /*
     * ------------------------------------------------
     * TEMPORARY DIAGNOSTIC:
     * INSPECT THE ORDER SHAPE
     * ------------------------------------------------
     */

    console.log(
      "EXTRACTED PAYCREST ORDER:",
      JSON.stringify(
        order,
        null,
        2
      )
    );

    console.log(
      "EXTRACTED PAYCREST ORDER ID:",
      order?.id
    );

    console.log(
      "EXTRACTED PAYCREST PROVIDER ACCOUNT:",
      JSON.stringify(
        order?.providerAccount,
        null,
        2
      )
    );

    /*
     * ------------------------------------------------
     * BUILD FINAL BIYAPORT RESPONSE
     * ------------------------------------------------
     */

    const finalResponse = {
      success: true,

      order,

      token,
      network: NETWORK,
      fiat: FIAT,

      nairaAmount,

      reference,

      walletAddress,
    };

    /*
     * ------------------------------------------------
     * TEMPORARY DIAGNOSTIC:
     * THIS IS EXACTLY WHAT PAGE.TSX RECEIVES
     * ------------------------------------------------
     */

    console.log(
      "FINAL BIYAPORT ONRAMP RESPONSE:",
      JSON.stringify(
        finalResponse,
        null,
        2
      )
    );

    /*
     * ------------------------------------------------
     * RETURN ORDER TO FRONTEND
     * ------------------------------------------------
     */

    return NextResponse.json(
      finalResponse
    );
  } catch (error) {
    console.error(
      "ONRAMP TRANSACTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create on-ramp transaction.",
      },
      { status: 500 }
    );
  }
}