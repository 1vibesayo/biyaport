import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/rates";

const SUPPORTED_TOKENS = [
  "USDT",
  "USDC",
] as const;

const SUPPORTED_NETWORKS = [
  "base",
  "bnb-smart-chain",
] as const;

const FIAT = "NGN";

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
   *
   * Accept common frontend aliases:
   *
   * - bnb-smart-chain
   * - bnb smart chain
   * - bnb smart chain mainnet
   * - bsc
   * - bsc mainnet
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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

          error:
            "Invalid Naira amount.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * FIRST PAYCREST QUOTE
     * ------------------------------------------------
     *
     * Ask Paycrest for the current SELL rate
     * for 1 token on the selected network.
     *
     * Example:
     *
     * Base:
     * /base/USDT/1/NGN?side=sell
     *
     * BNB Smart Chain:
     * /bnb-smart-chain/USDT/1/NGN?side=sell
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
          success:
            false,

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
     * EXTRACT INITIAL RATE
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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

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
        success:
          true,

        token,

        network,

        fiat:
          FIAT,

        nairaAmount,

        rate,

        cryptoAmount,
      }
    );
  } catch (error) {
    console.error(
      "OFFRAMP QUOTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unable to calculate crypto equivalent.",
      },
      { status: 500 }
    );
  }
}