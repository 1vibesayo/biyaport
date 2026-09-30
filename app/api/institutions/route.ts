import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_FIAT_CURRENCIES = [
  "NGN",
  "KES",
  "UGX",
  "TZS",
] as const;

type SupportedFiatCurrency =
  (typeof SUPPORTED_FIAT_CURRENCIES)[number];

export async function GET(request: NextRequest) {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();

  if (!apiKey) {
    console.error("PAYCREST_API_KEY is missing.");

    return NextResponse.json(
      {
        error: "Paycrest API key is not configured.",
      },
      { status: 500 }
    );
  }

  const currency = request.nextUrl.searchParams
    .get("currency")
    ?.trim()
    .toUpperCase();

  if (!currency) {
    return NextResponse.json(
      {
        error: "Fiat currency is required.",
      },
      { status: 400 }
    );
  }

  if (
    !SUPPORTED_FIAT_CURRENCIES.includes(
      currency as SupportedFiatCurrency
    )
  ) {
    return NextResponse.json(
      {
        error: "Unsupported fiat currency.",
        supportedCurrencies:
          SUPPORTED_FIAT_CURRENCIES,
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.paycrest.io/v2/institutions/${currency}`,
      {
        headers: {
          "API-Key": apiKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const responseText =
      await response.text();

    console.log(
      "PAYCREST INSTITUTIONS STATUS:",
      response.status
    );

    console.log(
      "PAYCREST INSTITUTIONS CURRENCY:",
      currency
    );

    console.log(
      "PAYCREST INSTITUTIONS RESPONSE:",
      responseText
    );

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        raw: responseText,
      };
    }

    if (!response.ok) {
      console.error(
        "PAYCREST INSTITUTIONS ERROR:",
        data
      );

      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Failed to fetch institutions.",
          details: data,
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "INSTITUTIONS FETCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to connect to Paycrest.",
      },
      { status: 500 }
    );
  }
}