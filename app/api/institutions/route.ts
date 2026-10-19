import { NextRequest, NextResponse } from "next/server";

const FIAT_CURRENCY = "NGN" as const;

export async function GET(request: NextRequest) {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Paycrest API key is not configured." },
      { status: 500 }
    );
  }

  // Accept the query for clarity, but default to NGN so the page can never
  // fail simply because a currency parameter was omitted.
  const requestedCurrency =
    request.nextUrl.searchParams
      .get("currency")
      ?.trim()
      .toUpperCase() || FIAT_CURRENCY;

  if (requestedCurrency !== FIAT_CURRENCY) {
    return NextResponse.json(
      {
        error: "Only NGN institutions are currently supported.",
        supportedCurrencies: [FIAT_CURRENCY],
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `https://api.paycrest.io/v2/institutions/${FIAT_CURRENCY}`,
      {
        method: "GET",
        headers: {
          "API-Key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    const text = await response.text();

    console.log("PAYCREST INSTITUTIONS STATUS:", response.status);
    console.log("PAYCREST INSTITUTIONS CURRENCY:", FIAT_CURRENCY);

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Paycrest returned an invalid response." },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorData = data as {
        message?: string;
        error?: string;
      } | null;

      return NextResponse.json(
        {
          error:
            errorData?.message ||
            errorData?.error ||
            "Paycrest could not load institutions.",
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("INSTITUTIONS ERROR:", error);

    const errorName =
      error instanceof Error ? error.name : "";
    const errorCause =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause
        : undefined;

    if (
      errorName === "AbortError" ||
      errorCause?.code === "UND_ERR_CONNECT_TIMEOUT"
    ) {
      return NextResponse.json(
        {
          error:
            "Paycrest is taking too long to respond. Please try again.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Unable to connect to Paycrest." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
