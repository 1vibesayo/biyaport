import { NextResponse } from "next/server";
import {
  SWAP_NETWORKS,
  ZEROX_API,
  ZEROX_VERSION,
} from "../_config";

export async function GET() {
  const apiKey = process.env.ZEROX_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ZEROX_API_KEY is not configured",
      },
      { status: 500 }
    );
  }

  try {
    const results = await Promise.all(
      SWAP_NETWORKS.map(async (network) => {
        try {
          const response = await fetch(
            `${ZEROX_API}/sources?chainId=${network.chainId}`,
            {
              headers: {
                "0x-api-key": apiKey,
                "0x-version": ZEROX_VERSION,
              },
              cache: "no-store",
            }
          );

          return {
            ...network,
            available: response.ok,
          };
        } catch {
          return {
            ...network,
            available: false,
          };
        }
      })
    );

    const networks = results
      .filter((network) => network.available)
      .map(({ nativeToken, ...network }) => ({
        ...network,
        nativeToken,
      }));

    return NextResponse.json({
      networks,
    });
  } catch (error) {
    console.error("[SWAP NETWORKS]", error);

    return NextResponse.json(
      {
        error: "Failed to load swap networks",
      },
      { status: 500 }
    );
  }
}