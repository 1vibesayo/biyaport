import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://api.paycrest.io";
const SUPPORTED_NETWORKS = new Set([
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "bnb-smart-chain",
]);
const SUPPORTED_TOKENS = new Set(["USDT", "USDC"]);
const SUPPORTED_FIAT = new Set(["NGN"]);
const MIN_USD = 0.5;
const MAX_USD = 2000;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amount = numberFrom(body?.amount);
    const token = String(body?.crypto ?? "").trim().toUpperCase();
    const network = String(body?.network ?? "").trim().toLowerCase();
    const currency = String(body?.currency ?? "NGN").trim().toUpperCase();

    if (amount === null || amount <= 0) {
      return jsonError("Enter a valid crypto amount.");
    }
    if (!SUPPORTED_TOKENS.has(token)) {
      return jsonError("Onramp currently supports USDT and USDC.");
    }
    if (!SUPPORTED_NETWORKS.has(network)) {
      return jsonError("This network is not supported for onramp.");
    }
    if (!SUPPORTED_FIAT.has(currency)) {
      return jsonError("Only NGN is currently supported.");
    }
    if (amount < MIN_USD || amount > MAX_USD) {
      return jsonError(
        amount < MIN_USD ? "amount too small" : "amount too much"
      );
    }

    // Paycrest documents the v2 rate endpoint as public. Buy rate is used
    // for fiat -> stablecoin quotes. Keep the API key server-side for order
    // creation and never expose it to the browser.
    const url =
      `${API_BASE}/v2/rates/${encodeURIComponent(network)}/` +
      `${encodeURIComponent(token)}/${encodeURIComponent(String(amount))}/` +
      `${encodeURIComponent(currency)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("PAYCREST ONRAMP RATE ERROR:", response.status, payload);
      return jsonError(
        payload?.message || payload?.error || "Unable to get a Paycrest quote right now.",
        response.status >= 400 && response.status < 500 ? response.status : 502
      );
    }

    // Paycrest responses may expose the applicable rate under `buy` or
    // `sell`, depending on the route/provider configuration. Prefer `buy`
    // when present, but accept the documented response shape seen in live
    // responses where only `data.sell.rate` is returned.
    const rateSource =
      payload?.data?.buy?.rate != null ? "buy" :
      payload?.data?.sell?.rate != null ? "sell" :
      payload?.data?.buyRate != null ? "buyRate" :
      payload?.data?.rate != null ? "rate" :
      payload?.buy?.rate != null ? "buy" :
      null;
    const rate = numberFrom(
      payload?.data?.buy?.rate ??
      payload?.data?.sell?.rate ??
      payload?.data?.buyRate ??
      payload?.data?.rate ??
      payload?.buy?.rate
    );

    // The returned rate is NGN per unit of the selected stablecoin.
    const localAmount =
      rate !== null && rate > 0 ? amount * rate : null;

    if (rate === null || rate <= 0 || localAmount === null || localAmount <= 0) {
      console.error("PAYCREST ONRAMP RATE SHAPE UNRECOGNIZED:", payload);
      return jsonError("Paycrest returned an invalid quote. Please try again.", 502);
    }

    return NextResponse.json({
      success: true,
      localAmount: Number(localAmount.toFixed(2)),
      fiatAmount: Number(localAmount.toFixed(2)),
      amountToPay: Number(localAmount.toFixed(2)),
      amount,
      usdcAmount: amount,
      usdAmount: amount,
      rate,
      rateSource,
      currency,
      crypto: token,
      network,
      source: "paycrest",
    });
  } catch (error) {
    console.error("ONRAMP QUOTE ROUTE ERROR:", error);
    return jsonError("Unable to get a quote right now. Please try again.", 500);
  }
}
