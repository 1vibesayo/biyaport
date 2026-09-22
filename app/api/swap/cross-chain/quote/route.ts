import { NextResponse } from "next/server";

const ZEROX_API = "https://api.0x.org";

function isAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      originChain,
      destinationChain,
      sellToken,
      buyToken,
      sellAmount,
      originAddress,
      destinationAddress,
    } = body ?? {};

    const apiKey = process.env.ZEROX_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Swap service is not configured." },
        { status: 500 }
      );
    }

    if (!Number.isInteger(Number(originChain)) || !Number.isInteger(Number(destinationChain))) {
      return NextResponse.json({ error: "Invalid swap networks." }, { status: 400 });
    }

    if (Number(originChain) === Number(destinationChain)) {
      return NextResponse.json(
        { error: "Cross-chain swaps require different networks." },
        { status: 400 }
      );
    }

    if (!isAddress(sellToken) || !isAddress(buyToken)) {
      return NextResponse.json({ error: "Invalid token address." }, { status: 400 });
    }

    if (!isAddress(originAddress) || !isAddress(destinationAddress)) {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }

    if (!/^\d+$/.test(String(sellAmount)) || BigInt(String(sellAmount)) <= 0n) {
      return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
    }

    const params = new URLSearchParams({
      originChain: String(originChain),
      destinationChain: String(destinationChain),
      sellToken: String(sellToken),
      buyToken: String(buyToken),
      sellAmount: String(sellAmount),
      originAddress: String(originAddress),
      destinationAddress: String(destinationAddress),
      sortQuotesBy: "price",
      maxNumQuotes: "1",
    });

    const response = await fetch(`${ZEROX_API}/cross-chain/quotes?${params.toString()}`, {
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
        "Unable to get a cross-chain quote.";

      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("CROSS-CHAIN QUOTE ERROR:", error);
    return NextResponse.json(
      { error: "Unable to get a cross-chain quote." },
      { status: 500 }
    );
  }
}
