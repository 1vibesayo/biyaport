import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();

  if (!apiKey) {
    console.error(
      "PAYCREST_API_KEY is missing."
    );

    return NextResponse.json(
      {
        error:
          "Paycrest API key is not configured.",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://api.paycrest.io/v2/institutions/NGN",
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
        error:
          "Unable to connect to Paycrest.",
      },
      { status: 500 }
    );
  }
}