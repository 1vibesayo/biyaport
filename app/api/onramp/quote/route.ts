import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API = "https://api.paycrest.io/v2/rates";

const SUPPORTED_TOKENS = ["USDT", "USDC"] as const;
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
 * TOKEN NORMALIZATION
 * ------------------------------------------------
 */

function normalizeToken(value: unknown): string {
  if (typeof value === "string") {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+ON\s+BASE$/i, "")
      .replace(/\s+ON\s+BASE\s+NETWORK$/i, "")
      .replace(/\s+ON\s+BNB\s+SMART\s+CHAIN$/i, "")
      .replace(/\s+ON\s+BSC$/i, "")
      .replace(/-BASE$/i, "")
      .replace(/_BASE$/i, "")
      .replace(/-BSC$/i, "")
      .replace(/_BSC$/i, "")
      .trim();
  }

  if (value && typeof value === "object") {
    const crypto = value as {
      symbol?: unknown;
      token?: unknown;
      name?: unknown;
      currency?: unknown;
    };

    if (typeof crypto.symbol === "string") {
      return normalizeToken(crypto.symbol);
    }

    if (typeof crypto.token === "string") {
      return normalizeToken(crypto.token);
    }

    if (typeof crypto.currency === "string") {
      return normalizeToken(crypto.currency);
    }

    if (typeof crypto.name === "string") {
      return normalizeToken(crypto.name);
    }
  }

  return "";
}

/*
 * ------------------------------------------------
 * NETWORK NORMALIZATION
 * ------------------------------------------------
 */

function normalizeNetwork(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+network$/i, "");

  /*
   * Base aliases
   */
  if (
    normalized === "base mainnet" ||
    normalized === "base"
  ) {
    return "base";
  }

  /*
   * BNB Smart Chain aliases
   *
   * Frontend can send:
   * - bnb-smart-chain
   * - bnb smart chain
   * - bnb smart chain mainnet
   * - bsc
   * - bsc mainnet
   */
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
 * POST
 * ------------------------------------------------
 */

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    /*
     * ------------------------------------------------
     * TOKEN
     * ------------------------------------------------
     */

    const rawToken =
      body.token ??
      body.crypto ??
      body.symbol ??
      body.selectedCrypto;

    const token = normalizeToken(rawToken);

    /*
     * ------------------------------------------------
     * NETWORK
     * ------------------------------------------------
     */

    const rawNetwork =
      body.network ??
      body.chain ??
      body.selectedNetwork;

    const network = normalizeNetwork(rawNetwork);

    /*
     * ------------------------------------------------
     * CRYPTO AMOUNT
     *
     * The crypto amount is the INPUT.
     *
     * Example:
     *
     * User selects:
     * USDT
     * BNB Smart Chain
     * 1 USDT
     *
     * cryptoAmount = 1
     * ------------------------------------------------
     */

    const rawCryptoAmount =
      body.cryptoAmount ??
      body.amount ??
      body.tokenAmount ??
      body.amountIn;

    const cryptoAmount = Number(
      rawCryptoAmount
    );

    console.log(
      "ONRAMP QUOTE REQUEST:",
      {
        rawToken,
        normalizedToken: token,

        rawNetwork,
        normalizedNetwork: network,

        rawCryptoAmount,
        cryptoAmount,
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
          success: false,
          error:
            "Unsupported cryptocurrency.",

          receivedToken: rawToken,
          normalizedToken: token,

          supportedTokens:
            SUPPORTED_TOKENS,
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * VALIDATE NETWORK
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
            "Unsupported network.",

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
     * VALIDATE CRYPTO AMOUNT
     * ------------------------------------------------
     */

    if (
      !Number.isFinite(cryptoAmount) ||
      cryptoAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid crypto amount.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST BUY RATE
     *
     * Fiat -> Crypto
     *
     * Example:
     *
     * 1 USDT = ₦1,500
     *
     * 1 USDT on Base:
     *
     * /base/USDT/1/NGN
     *
     * 1 USDT on BNB Smart Chain:
     *
     * /bnb-smart-chain/USDT/1/NGN
     * ------------------------------------------------
     */

    const rateUrl =
      `${PAYCREST_API}/${network}/${token}/${cryptoAmount}/${FIAT}?side=buy`;

    console.log(
      "PAYCREST ONRAMP RATE URL:",
      rateUrl
    );

    const rateResponse = await fetch(
      rateUrl,
      {
        cache: "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

    let rateData: any = null;

    try {
      rateData =
        await rateResponse.json();
    } catch {
      rateData = null;
    }

    /*
     * ------------------------------------------------
     * PAYCREST RESPONSE VALIDATION
     * ------------------------------------------------
     */

    if (
      !rateResponse.ok ||
      rateData?.status !== "success"
    ) {
      console.error(
        "PAYCREST ONRAMP RATE ERROR:",
        {
          status:
            rateResponse.status,

          data:
            rateData,
        }
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Unable to get crypto rate.",

          details:
            rateData?.message ||
            rateData?.error ||
            "Paycrest rate request failed.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * EXTRACT BUY RATE
     * ------------------------------------------------
     */

    const rate = Number(
      rateData?.data?.buy?.rate
    );

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      console.error(
        "INVALID PAYCREST ONRAMP RATE:",
        rateData
      );

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
     * CALCULATE NGN AMOUNT
     * ------------------------------------------------
     */

    const localAmount =
      cryptoAmount * rate;

    if (
      !Number.isFinite(localAmount) ||
      localAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Unable to calculate local currency amount.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * RESPONSE
     * ------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      token,

      network,

      fiat: FIAT,

      /*
       * Amount the user wants to receive
       */
      cryptoAmount,

      /*
       * NGN equivalent
       */
      localAmount,

      /*
       * Compatibility alias
       */
      nairaAmount:
        localAmount,

      /*
       * Paycrest rate
       */
      rate,

      /*
       * Currency labels
       */
      cryptoCurrency:
        token,

      localCurrency:
        FIAT,
    });
  } catch (error) {
    console.error(
      "ONRAMP QUOTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to calculate on-ramp quote.",
      },
      { status: 500 }
    );
  }
}