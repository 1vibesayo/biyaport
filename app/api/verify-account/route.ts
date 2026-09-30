import { NextRequest, NextResponse } from "next/server";

const FIAT_CURRENCY = "NGN" as const;

export async function POST(request: NextRequest) {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Paycrest API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const institution =
      typeof body?.institution === "string"
        ? body.institution.trim()
        : "";

    const accountIdentifier =
      typeof body?.accountIdentifier === "string"
        ? body.accountIdentifier.trim()
        : "";

    // NGN is the only fiat corridor currently exposed by Biyaport.
    // Keep this optional on the request so older frontend calls do not fail.
    const currency =
      typeof body?.currency === "string"
        ? body.currency.trim().toUpperCase()
        : FIAT_CURRENCY;

    if (!institution || !accountIdentifier) {
      return NextResponse.json(
        {
          error:
            "Institution and account number are required.",
        },
        { status: 400 }
      );
    }

    if (currency !== FIAT_CURRENCY) {
      return NextResponse.json(
        {
          error: "Only NGN account verification is currently supported.",
          supportedCurrencies: [FIAT_CURRENCY],
        },
        { status: 400 }
      );
    }

    console.log("PAYCREST VERIFY REQUEST:", {
      currency: FIAT_CURRENCY,
      institution,
      accountIdentifier,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(
        "https://api.paycrest.io/v2/verify-account",
        {
          method: "POST",
          headers: {
            "API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            institution,
            accountIdentifier,
            currency: FIAT_CURRENCY,
          }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const text = await response.text();

      console.log("PAYCREST VERIFY STATUS:", response.status);
      console.log("PAYCREST VERIFY CURRENCY:", FIAT_CURRENCY);
      console.log("PAYCREST VERIFY RESPONSE:", text);

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
              "Paycrest could not verify this account.",
            details: data,
          },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    console.error("VERIFY ACCOUNT ERROR:", error);

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
  }
}
