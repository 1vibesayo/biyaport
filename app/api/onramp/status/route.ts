import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://api.paycrest.io";

export async function GET(request: NextRequest) {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();
  if (!apiKey) {
    console.error("PAYCREST_API_KEY is not configured.");
    return NextResponse.json(
      { success: false, error: "Onramp status is temporarily unavailable." },
      { status: 503 }
    );
  }

  const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: "orderId is required." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/v2/sender/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          "API-Key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("PAYCREST ONRAMP STATUS ERROR:", response.status, payload);
      return NextResponse.json(
        {
          success: false,
          error:
            payload?.message ||
            payload?.error ||
            "Unable to retrieve the order status.",
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const order =
      payload?.data?.order ??
      payload?.order ??
      payload?.data ??
      payload;
    const status = order?.status ?? payload?.status;

    return NextResponse.json({
      success: true,
      ...payload,
      order,
      status: status ? String(status).toLowerCase() : "",
    });
  } catch (error) {
    console.error("ONRAMP STATUS ROUTE ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Unable to check order status. Please try again." },
      { status: 500 }
    );
  }
}
