export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const ZEROX_API =
  "https://api.0x.org";

export const ZEROX_VERSION = "v2";

export const SWAP_FEE_BPS = 25; // 0.25%

export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

/**
 * Networks supported by Biyaport Swap.
 *
 * Default tokens shown in the token selector:
 *
 * - USDC
 * - USDT
 * - Native token
 *
 * Other ERC-20 tokens can be loaded by searching
 * or pasting their contract address.
 */
export const SWAP_NETWORKS = [
  {
    chainId: 8453,
    slug: "base",
    name: "Base",

    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/eth-logo.svg",
      isNative: true,
    },

    featuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        address:
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        logoURI: "usdc-logo.svg",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        address:
          "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        logoURI: "/usdt-logo.svg",
      },
    ],

    coingeckoAssetPlatform: "base",
    coingeckoNetwork: "base",
  },

  {
    chainId: 56,
    slug: "bnb-smart-chain",
    name: "BNB Smart Chain",

    nativeToken: {
      symbol: "BNB",
      name: "BNB",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/bnb-logo.svg",
      isNative: true,
    },

    featuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 18,
        address:
          "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        logoURI: "/usdc-logo.svg",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 18,
        address:
          "0x55d398326f99059fF775485246999027B3197955",
        logoURI: "/usdt-logo.svg",
      },
    ],

    coingeckoAssetPlatform: "binance-smart-chain",
    coingeckoNetwork: "bsc",
  },

  {
    chainId: 1,
    slug: "ethereum",
    name: "Ethereum",

    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/eth-logo.svg",
      isNative: true,
    },

    featuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        address:
          "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        logoURI: "/usdc-logo.svg",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        address:
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        logoURI: "/usdt-logo.svg",
      },
    ],

    coingeckoAssetPlatform: "ethereum",
    coingeckoNetwork: "eth",
  },

  {
    chainId: 137,
    slug: "polygon",
    name: "Polygon",

    nativeToken: {
      symbol: "POL",
      name: "POL",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/pol-logo.svg",
      isNative: true,
    },

    featuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        address:
          "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        logoURI: "/usdc-logo.svg",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        address:
          "0xc2132D05D31c914a87C6611C10748AaCbA9A6D5",
        logoURI: "/usdt-logo.svg",
      },
    ],

    coingeckoAssetPlatform: "polygon-pos",
    coingeckoNetwork: "polygon_pos",
  },
] as const;