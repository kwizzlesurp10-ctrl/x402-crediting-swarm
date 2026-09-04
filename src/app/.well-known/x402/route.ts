import { NextRequest, NextResponse } from "next/server";
import { catalogEntry } from "@/lib/x402";
import { publicOrigin } from "@/lib/public-origin";

export async function GET(req: NextRequest) {
  const resourceUrl = `${publicOrigin(req)}/api/swarm`;
  return NextResponse.json(
    {
      x402Version: 2,
      items: [catalogEntry(resourceUrl)],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
