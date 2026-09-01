import { NextRequest, NextResponse } from "next/server";

const PAYCREST_API =
  "https://api.paycrest.io/v2/sender/orders";

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * ------------------------------------------------
     * ORDER ID
     * ------------------------------------------------
     */

    const orderId =
      request.nextUrl.searchParams.get(
        "orderId"
      );

    if (!orderId) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Missing orderId.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------
     * API KEY
     * ------------------------------------------------
     */

    const apiKey =
      process.env.PAYCREST_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "PAYCREST STATUS ERROR: PAYCREST_API_KEY is missing."
      );

      return NextResponse.json(
        {
          success:
            false,

          error:
            "Paycrest API key is not configured.",
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------
     * PAYCREST STATUS URL
     * ------------------------------------------------
     */

    const url =
      `${PAYCREST_API}/${encodeURIComponent(
        orderId
      )}`;

    console.log(
      "PAYCREST ONRAMP STATUS REQUEST:",
      {
        orderId,
        url,
      }
    );

    /*
     * ------------------------------------------------
     * GET PAYCREST ORDER
     * ------------------------------------------------
     */

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            "API-Key":
              apiKey,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    /*
     * ------------------------------------------------
     * RAW RESPONSE
     * ------------------------------------------------
     */

    const responseText =
      await response.text();

    console.log(
      "PAYCREST STATUS RAW HTTP STATUS:",
      response.status
    );

    console.log(
      "PAYCREST STATUS RAW RESPONSE TEXT:",
      responseText
    );

    let paycrestData: any;

    try {
      paycrestData =
        JSON.parse(
          responseText
        );
    } catch {
      console.error(
        "PAYCREST STATUS RESPONSE WAS NOT VALID JSON."
      );

      return NextResponse.json(
        {
          success:
            false,

          error:
            "Paycrest returned an invalid response.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------
     * HANDLE PAYCREST ERROR
     * ------------------------------------------------
     */

    if (!response.ok) {
      console.error(
        "PAYCREST STATUS REQUEST FAILED:",
        {
          status:
            response.status,

          response:
            paycrestData,
        }
      );

      return NextResponse.json(
        {
          success:
            false,

          error:
            paycrestData?.message ||
            paycrestData?.error ||
            "Unable to retrieve Paycrest order status.",

          details:
            paycrestData?.data ||
            null,
        },
        {
          status:
            response.status,
        }
      );
    }

    /*
     * ------------------------------------------------
     * EXTRACT ORDER
     * ------------------------------------------------
     */

    const order =
      paycrestData?.data ||
      paycrestData?.order ||
      paycrestData;

    const status =
      String(
        order?.status ||
          ""
      )
        .trim()
        .toLowerCase();

    console.log(
      "EXTRACTED PAYCREST ONRAMP ORDER:",
      JSON.stringify(
        order,
        null,
        2
      )
    );

    console.log(
      "EXTRACTED PAYCREST ONRAMP STATUS:",
      status
    );

    /*
     * ------------------------------------------------
     * RETURN STATUS
     * ------------------------------------------------
     */

    return NextResponse.json(
      {
        success:
          true,

        orderId,

        status,

        order,

        /*
         * Useful when frontend needs to know
         * which network the order belongs to.
         */
        network:
          order?.destination?.recipient?.network ||
          order?.destination?.network ||
          order?.network ||
          null,

        message:
          paycrestData?.message ||
          "Order status retrieved successfully.",
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "ONRAMP STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to check onramp order status.",
      },
      { status: 500 }
    );
  }
}