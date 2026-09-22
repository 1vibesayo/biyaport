import { NextResponse } from "next/server";

const ZEROX_API = "https://api.0x.org";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { originChain, originTxHash, quoteId } = body ?? {};
    const apiKey = process.env.ZEROX_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Swap service is not configured." },
        { status: 500 }
      );
    }

    if (!originChain || !originTxHash) {
      return NextResponse.json(
        { error: "Missing cross-chain transaction details." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      originChain: String(originChain),
      originTxHash: String(originTxHash),
    });

    if (quoteId) params.set("quoteId", String(quoteId));

    const response = await fetch(`${ZEROX_API}/cross-chain/status?${params.toString()}`, {
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.reason ||
        data?.message ||
        data?.error ||
        "Unable to track the cross-chain swap.";

      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("CROSS-CHAIN STATUS ERROR:", error);
    return NextResponse.json(
      { error: "Unable to track the cross-chain swap." },
      { status: 500 }
    );
  }
}
