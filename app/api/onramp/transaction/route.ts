import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amountNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.PAYCREST_API_KEY?.trim();
  if (!apiKey) {
    console.error("PAYCREST_API_KEY is not configured.");
    return jsonError("Onramp is temporarily unavailable. Please try again later.", 503);
  }

  try {
    const body = await request.json();

    const amount = amountNumber(body?.amount);
    const currency = text(body?.currency || "NGN").toUpperCase();
    const crypto = text(body?.crypto).toUpperCase();
    const network = text(body?.network).toLowerCase();
    const walletAddress = text(body?.walletAddress);
    const institution = text(body?.institution);
    const accountNumber = text(body?.accountNumber);
    const accountName = text(body?.accountName);
    const reference = text(body?.reference) || `biyaport-onramp-${Date.now()}`;

    if (amount === null || amount <= 0) {
      return jsonError("Enter a valid fiat amount.");
    }
    if (currency !== "NGN" || !SUPPORTED_FIAT.has(currency)) {
      return jsonError("Only NGN is currently supported.");
    }
    if (!SUPPORTED_TOKENS.has(crypto)) {
      return jsonError("Onramp currently supports USDT and USDC.");
    }
    if (!SUPPORTED_NETWORKS.has(network)) {
      return jsonError("This network is not supported for onramp.");
    }
    if (!isAddress(walletAddress)) {
      return jsonError("Enter a valid EVM wallet address.");
    }
    if (!institution || !/^\d{10}$/.test(accountNumber) || !accountName) {
      return jsonError("Provide a valid refund bank account and account name.");
    }

    // Onramp amount limits are stablecoin-equivalent limits. The client sends
    // the quoted fiat amount, so re-fetch the quote to validate the equivalent
    // amount rather than trusting a client-supplied crypto amount.
    const quotedCryptoAmount = amountNumber(body?.cryptoAmount ?? body?.amountCrypto);
    if (
      quotedCryptoAmount !== null &&
      (quotedCryptoAmount < MIN_USD || quotedCryptoAmount > MAX_USD)
    ) {
      return jsonError(
        quotedCryptoAmount < MIN_USD ? "amount too small" : "amount too much"
      );
    }

    const payload = {
      amount: String(amount),
      amountIn: "fiat",
      source: {
        type: "fiat",
        currency,
        refundAccount: {
          institution,
          accountIdentifier: accountNumber,
          accountName,
        },
      },
      destination: {
        type: "crypto",
        currency: crypto,
        recipient: {
          address: walletAddress,
          network,
        },
      },
      reference,
    };

    const response = await fetch(`${API_BASE}/v2/sender/orders`, {
      method: "POST",
      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const providerPayload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(
        "PAYCREST ONRAMP ORDER ERROR:",
        response.status,
        providerPayload
      );
      const message =
        providerPayload?.message ||
        providerPayload?.error ||
        "Paycrest could not create the order.";
      return jsonError(message, response.status >= 400 && response.status < 500 ? response.status : 502);
    }

    // The Sender API commonly wraps the order in `data`; tolerate a wrapped
    // `order` shape as well for compatibility with provider response changes.
    const order =
      providerPayload?.data?.order ??
      providerPayload?.order ??
      providerPayload?.data ??
      providerPayload;

    const orderId = order?.id ?? order?.orderId ?? providerPayload?.orderId;
    const providerAccount =
      order?.providerAccount ??
      order?.paymentAccount ??
      order?.paymentDetails ??
      order?.source?.paymentAccount ??
      providerPayload?.providerAccount ??
      providerPayload?.paymentAccount;

    if (!orderId) {
      console.error("PAYCREST ORDER RESPONSE MISSING ID:", providerPayload);
      return jsonError("Paycrest did not return an order ID. Please try again.", 502);
    }

    // Keep the client response shape it already expects.
    return NextResponse.json({
      success: true,
      order: {
        ...order,
        id: String(orderId),
        providerAccount: providerAccount ?? null,
      },
      data: order,
    });
  } catch (error) {
    console.error("ONRAMP TRANSACTION ROUTE ERROR:", error);
    return jsonError("Unable to start your transaction. Please try again.", 500);
  }
}
