import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.PAYCREST_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Paycrest API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const { institution, accountIdentifier } = body;

    if (!institution || !accountIdentifier) {
      return NextResponse.json(
        {
          error: "Institution and account number are required.",
        },
        { status: 400 }
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const response = await fetch(
        "https://api.paycrest.io/v2/verify-account",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            institution,
            accountIdentifier,
          }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const text = await response.text();

      console.log("PAYCREST VERIFY STATUS:", response.status);
      console.log("PAYCREST VERIFY RESPONSE:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          {
            error: "Paycrest returned an invalid response.",
          },
          { status: 502 }
        );
      }

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              data?.message ||
              data?.error ||
              "Paycrest could not verify this account.",
          },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    console.error("VERIFY ACCOUNT ERROR:", error);

    if (
      error?.name === "AbortError" ||
      error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
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
      {
        error: "Unable to connect to Paycrest.",
      },
      { status: 502 }
    );
  }
}