export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const ZEROX_API =
  "https://api.0x.org";

export const ZEROX_VERSION = "v2";

export const SWAP_FEE_BPS = 25; // 0.25%

export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export const SWAP_NETWORKS = [
  {
    chainId: 8453,
    slug: "base",
    name: "Base",
    symbol: "ETH",
    nativeToken: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/tokens/eth.svg",
      isNative: true,
    },
    coingeckoAssetPlatform: "base",
    coingeckoNetwork: "base",
  },
  {
    chainId: 56,
    slug: "bnb-smart-chain",
    name: "BNB Smart Chain",
    symbol: "BNB",
    nativeToken: {
      symbol: "BNB",
      name: "BNB",
      decimals: 18,
      address: NATIVE_TOKEN_ADDRESS,
      logoURI: "/tokens/bnb.svg",
      isNative: true,
    },
    coingeckoAssetPlatform: "binance-smart-chain",
    coingeckoNetwork: "bsc",
  },
] as const;

/**
 * These are only used to prioritize tokens in the dropdown.
 *
 * They do NOT define the complete supported token list.
 *
 * CoinGecko supplies the larger token catalog.
 */
export const FEATURED_SYMBOLS: Record<string, string[]> = {
  base: ["ETH", "USDC", "USDT", "WETH"],
  "bnb-smart-chain": ["BNB", "USDT", "USDC", "WBNB"],
};