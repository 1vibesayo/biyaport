import { NextResponse } from "next/server";
import {
  NATIVE_TOKEN_ADDRESS,
  SWAP_NETWORKS,
} from "../_config";

type Token = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  isNative: boolean;
};

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getNetwork(chainId: number) {
  return SWAP_NETWORKS.find(
    (network) => network.chainId === chainId
  );
}

function getDefaultTokens(network: (typeof SWAP_NETWORKS)[number]): Token[] {
  return [
    {
      chainId: network.chainId,
      address: network.nativeToken.address,
      name: network.nativeToken.name,
      symbol: network.nativeToken.symbol,
      decimals: network.nativeToken.decimals,
      logoURI: network.nativeToken.logoURI,
      isNative: true,
    },
    ...network.featuredTokens.map((token) => ({
      chainId: network.chainId,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.logoURI,
      isNative: false,
    })),
  ];
}

function getCoinGeckoPlatform(chainId: number) {
  switch (chainId) {
    case 1:
      return "ethereum";

    case 56:
      return "binance-smart-chain";

    case 137:
      return "polygon-pos";

    case 8453:
      return "base";

    default:
      return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const chainIdParam = searchParams.get("chainId");
  const search = searchParams.get("search")?.trim() || "";

  const chainId = Number(chainIdParam);

  if (!Number.isInteger(chainId)) {
    return NextResponse.json(
      {
        error: "Invalid chainId",
      },
      { status: 400 }
    );
  }

  const network = getNetwork(chainId);

  if (!network) {
    return NextResponse.json(
      {
        error: "Unsupported network",
      },
      { status: 400 }
    );
  }

  /*
   * No search:
   * Return only Biyaport's 3 default tokens for this network.
   */
  if (!search) {
    return NextResponse.json({
      tokens: getDefaultTokens(network),
    });
  }

  /*
   * Text search:
   * Search only Biyaport's default tokens.
   *
   * Arbitrary contract addresses are handled separately below.
   */
  if (!isAddress(search)) {
    const query = search.toLowerCase();

    const tokens = getDefaultTokens(network).filter((token) => {
      return (
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase() === query
      );
    });

    return NextResponse.json({
      tokens,
    });
  }

  /*
   * Contract-address lookup.
   *
   * First check Biyaport's known tokens. This avoids an external
   * request for USDC, USDT, or the native token.
   */
  const knownToken = getDefaultTokens(network).find(
    (token) =>
      token.address.toLowerCase() === search.toLowerCase()
  );

  if (knownToken) {
    return NextResponse.json({
      tokens: [knownToken],
    });
  }

  const apiKey = process.env.COINGECKO_API_KEY;

  if (!apiKey) {
    console.error(
      "[SWAP TOKENS] COINGECKO_API_KEY is not configured"
    );

    return NextResponse.json(
      {
        error: "Token lookup is temporarily unavailable",
      },
      { status: 503 }
    );
  }

  const platform = getCoinGeckoPlatform(chainId);

  if (!platform) {
    return NextResponse.json(
      {
        error: "Token lookup is not supported on this network",
      },
      { status: 400 }
    );
  }

  try {
    /*
     * CoinGecko standard API contract lookup.
     */
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${search}`,
      {
        headers: {
          accept: "application/json",
          "x-cg-demo-api-key": apiKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          tokens: [],
        });
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: "Token lookup is temporarily unavailable",
          },
          { status: 429 }
        );
      }

      console.error(
        "[SWAP TOKENS] CoinGecko error:",
        response.status
      );

      return NextResponse.json(
        {
          error: "Token lookup is temporarily unavailable",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const token: Token = {
      chainId,
      address: search,
      name: data.name || data.symbol || "Unknown token",
      symbol: data.symbol
        ? String(data.symbol).toUpperCase()
        : "UNKNOWN",
      decimals: Number.isInteger(data.detail_platforms?.[platform]?.decimal_place)
        ? data.detail_platforms[platform].decimal_place
        : 18,
      logoURI:
        data.image?.large ||
        data.image?.small ||
        data.image?.thumb ||
        null,
      isNative: false,
    };

    return NextResponse.json({
      tokens: [token],
      metadata: {
        coingeckoId: data.id || null,
        marketCapRank: data.market_cap_rank ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[SWAP TOKENS] CoinGecko request failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Token lookup is temporarily unavailable",
      },
      { status: 502 }
    );
  }
}