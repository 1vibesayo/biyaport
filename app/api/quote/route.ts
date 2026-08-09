import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API = "https://api.paycrest.io/v2/rates";

const SUPPORTED_TOKENS = ["USDT", "USDC"] as const;
const NETWORK = "base";
const FIAT = "NGN";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const token = String(body.token || "").toUpperCase();
    const nairaAmount = Number(body.nairaAmount);

    if (!SUPPORTED_TOKENS.includes(token as (typeof SUPPORTED_TOKENS)[number])) {
      return NextResponse.json(
        { error: "Unsupported cryptocurrency." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(nairaAmount) || nairaAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid Naira amount." },
        { status: 400 }
      );
    }

    /*
     * First quote:
     * Ask Paycrest for the current sell rate for 1 token.
     */
    const initialUrl =
      `${PAYCREST_API}/${NETWORK}/${token}/1/${FIAT}?side=sell`;

    const initialResponse = await fetch(initialUrl, {
      cache: "no-store",
    });

    const initialData = await initialResponse.json();

    if (!initialResponse.ok || initialData?.status !== "success") {
      console.error("PAYCREST INITIAL QUOTE ERROR:", initialData);

      return NextResponse.json(
        { error: "Unable to get crypto rate." },
        { status: 502 }
      );
    }

    const initialRate = Number(initialData?.data?.sell?.rate);

    if (!Number.isFinite(initialRate) || initialRate <= 0) {
      return NextResponse.json(
        { error: "Invalid crypto rate returned by Paycrest." },
        { status: 502 }
      );
    }

    /*
     * Estimate how much crypto is needed for the
     * requested Naira amount.
     */
    let cryptoAmount = nairaAmount / initialRate;

    /*
     * Refine the quote using the estimated crypto amount.
     * This gives Paycrest the transaction notional instead
     * of always asking for a 1-token quote.
     */
    const quoteAmount = Math.max(cryptoAmount, 0.000001);

    const quoteUrl =
      `${PAYCREST_API}/${NETWORK}/${token}/${quoteAmount}/${FIAT}?side=sell`;

    const quoteResponse = await fetch(quoteUrl, {
      cache: "no-store",
    });

    const quoteData = await quoteResponse.json();

    if (!quoteResponse.ok || quoteData?.status !== "success") {
      console.error("PAYCREST QUOTE ERROR:", quoteData);

      return NextResponse.json(
        { error: "Unable to calculate crypto equivalent." },
        { status: 502 }
      );
    }

    const rate = Number(quoteData?.data?.sell?.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "Invalid quote rate returned by Paycrest." },
        { status: 502 }
      );
    }

    cryptoAmount = nairaAmount / rate;

    return NextResponse.json({
      success: true,
      token,
      network: NETWORK,
      fiat: FIAT,
      nairaAmount,
      rate,
      cryptoAmount,
    });
  } catch (error) {
    console.error("QUOTE ERROR:", error);

    return NextResponse.json(
      { error: "Unable to calculate crypto equivalent." },
      { status: 500 }
    );
  }
}