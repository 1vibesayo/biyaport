import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API = "https://api.paycrest.io/v2/rates";

const SUPPORTED_TOKENS = ["USDT", "USDC"] as const;
const SUPPORTED_NETWORKS = ["base"] as const;

const NETWORK = "base";
const FIAT = "NGN";

type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

function normalizeToken(value: unknown): string {
  if (typeof value === "string") {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+ON\s+BASE$/i, "")
      .replace(/\s+ON\s+BASE\s+NETWORK$/i, "")
      .replace(/-BASE$/i, "")
      .replace(/_BASE$/i, "")
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

function normalizeNetwork(value: unknown): string {
  if (typeof value !== "string") {
    return NETWORK;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+network$/i, "");

  if (normalized === "base mainnet") {
    return "base";
  }

  return normalized;
}

export async function POST(request: NextRequest) {
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
     * IMPORTANT:
     * The crypto amount is now the INPUT.
     *
     * Example:
     *
     * User selects USDT
     * User enters 1
     *
     * cryptoAmount = 1
     * ------------------------------------------------
     */

    const rawCryptoAmount =
      body.cryptoAmount ??
      body.amount ??
      body.tokenAmount ??
      body.amountIn;

    const cryptoAmount = Number(rawCryptoAmount);

    console.log("ONRAMP QUOTE REQUEST:", {
      rawToken,
      normalizedToken: token,
      rawNetwork,
      normalizedNetwork: network,
      rawCryptoAmount,
      cryptoAmount,
    });

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
          error: "Unsupported cryptocurrency.",
          receivedToken: rawToken,
          normalizedToken: token,
          supportedTokens: SUPPORTED_TOKENS,
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
        network as (typeof SUPPORTED_NETWORKS)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported network.",
          receivedNetwork: rawNetwork,
          normalizedNetwork: network,
          supportedNetworks: SUPPORTED_NETWORKS,
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
          error: "Invalid crypto amount.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST BUY RATE
     *
     * For an on-ramp:
     *
     * NGN -> USDT / USDC
     *
     * We ask Paycrest how much NGN is required
     * for the selected crypto amount.
     *
     * Example:
     *
     * 1 USDT -> ₦1,500
     *
     * ------------------------------------------------
     */

    const rateUrl =
      `${PAYCREST_API}/${network}/${token}/${cryptoAmount}/${FIAT}?side=buy`;

    console.log(
      "PAYCREST ONRAMP RATE URL:",
      rateUrl
    );

    const rateResponse = await fetch(rateUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    let rateData: any = null;

    try {
      rateData = await rateResponse.json();
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
          status: rateResponse.status,
          data: rateData,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to get crypto rate.",
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
     * CALCULATE LOCAL CURRENCY AMOUNT
     *
     * cryptoAmount is already the amount the user
     * wants to receive.
     *
     * If Paycrest returns:
     *
     * rate = ₦1,500 per USDT
     *
     * and:
     *
     * cryptoAmount = 1
     *
     * then:
     *
     * localAmount = ₦1,500
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
     *
     * `cryptoAmount`
     * = amount entered by the user
     *
     * `localAmount`
     * = NGN amount calculated from Paycrest
     *
     * `nairaAmount`
     * = compatibility alias
     * ------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      token,
      network,
      fiat: FIAT,

      // Amount entered by the user
      cryptoAmount,

      // NGN equivalent
      localAmount,

      // Compatibility with existing frontend/backend code
      nairaAmount: localAmount,

      // Paycrest rate
      rate,

      // Currency labels
      cryptoCurrency: token,
      localCurrency: FIAT,
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