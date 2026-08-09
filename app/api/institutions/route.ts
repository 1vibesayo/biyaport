import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.PAYCREST_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Paycrest API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://api.paycrest.io/v2/institutions/NGN",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.message || "Failed to fetch institutions.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to connect to Paycrest." },
      { status: 500 }
    );
  }
}