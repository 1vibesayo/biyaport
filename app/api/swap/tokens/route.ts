import { NextRequest, NextResponse } from "next/server";
import {
  FEATURED_SYMBOLS,
  NATIVE_TOKEN_ADDRESS,
  SWAP_NETWORKS,
} from "../_config";

type CoinGeckoToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

type Token = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  isNative: boolean;
};

function getNetwork(chainId: number) {
  return SWAP_NETWORKS.find(
    (network) => network.chainId === chainId
  );
}

function normalizeToken(token: CoinGeckoToken): Token {
  return {
    chainId: token.chainId,
    address: token.address,
    name: token.name,
    symbol: token.symbol.toUpperCase(),
    decimals: token.decimals,
    logoURI: token.logoURI ?? null,
    isNative: false,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const chainIdParam = searchParams.get("chainId");
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

  const limitParam = Number(
    searchParams.get("limit") ?? "100"
  );

  const limit = Math.min(
    Math.max(
      Number.isFinite(limitParam) ? limitParam : 100,
      1
    ),
    200
  );

  if (!chainIdParam) {
    return NextResponse.json(
      {
        error: "chainId is required",
      },
      { status: 400 }
    );
  }

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
        error: "Unsupported swap network",
      },
      { status: 400 }
    );
  }

  try {
    /*
     * CoinGecko publishes chain-specific token lists through
     * tokens.coingecko.com.
     *
     * Examples:
     * Base:
     * https://tokens.coingecko.com/base/all.json
     *
     * BNB Smart Chain:
     * https://tokens.coingecko.com/binance-smart-chain/all.json
     */
    const tokenListUrl =
      `https://tokens.coingecko.com/` +
      `${network.coingeckoAssetPlatform}/all.json`;

    const response = await fetch(tokenListUrl, {
      headers: {
        Accept: "application/json",
      },

      /*
       * Token lists do not need to be fetched on every request.
       * Cache the server-side result for 5 minutes.
       */
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "[COINGECKO TOKEN LIST]",
        response.status,
        tokenListUrl,
        errorText
      );

      return NextResponse.json(
        {
          error: "Failed to fetch token list",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const externalTokens: CoinGeckoToken[] =
      Array.isArray(data?.tokens)
        ? data.tokens
        : [];

    /*
     * Always include the native token manually.
     */
    const tokens: Token[] = [
      {
        chainId,
        address: NATIVE_TOKEN_ADDRESS,
        name: network.nativeToken.name,
        symbol: network.nativeToken.symbol,
        decimals: network.nativeToken.decimals,
        logoURI: network.nativeToken.logoURI,
        isNative: true,
      },
    ];

    /*
     * Normalize CoinGecko tokens.
     */
    for (const token of externalTokens) {
      if (token.chainId !== chainId) {
        continue;
      }

      if (
        !token.address ||
        !token.symbol ||
        !token.name ||
        !Number.isInteger(token.decimals)
      ) {
        continue;
      }

      tokens.push(normalizeToken(token));
    }

    /*
     * Remove duplicate contract addresses.
     */
    const uniqueTokens = Array.from(
      new Map(
        tokens.map((token) => [
          token.address.toLowerCase(),
          token,
        ])
      ).values()
    );

    /*
     * Search by:
     * - symbol
     * - name
     * - contract address
     */
    const filteredTokens = search
      ? uniqueTokens.filter((token) => {
          const symbol = token.symbol.toLowerCase();
          const name = token.name.toLowerCase();
          const address = token.address.toLowerCase();

          return (
            symbol.includes(search) ||
            name.includes(search) ||
            address.includes(search)
          );
        })
      : uniqueTokens;

    /*
     * Featured tokens are always displayed first.
     */
    const featured =
      FEATURED_SYMBOLS[network.slug] ?? [];

    const featuredSet = new Set(
      featured.map((symbol) =>
        symbol.toLowerCase()
      )
    );

    filteredTokens.sort((a, b) => {
      const aFeatured = featuredSet.has(
        a.symbol.toLowerCase()
      );

      const bFeatured = featuredSet.has(
        b.symbol.toLowerCase()
      );

      if (aFeatured && !bFeatured) {
        return -1;
      }

      if (!aFeatured && bFeatured) {
        return 1;
      }

      return a.symbol.localeCompare(b.symbol);
    });

    const result = filteredTokens.slice(0, limit);

    return NextResponse.json({
      network: {
        chainId: network.chainId,
        slug: network.slug,
        name: network.name,
      },

      search,

      total: filteredTokens.length,

      tokens: result,
    });
  } catch (error) {
    console.error(
      "[SWAP TOKENS]",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load swap tokens",
      },
      { status: 500 }
    );
  }
}