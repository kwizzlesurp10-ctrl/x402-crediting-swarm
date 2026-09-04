import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";
import { publicOrigin } from "@/lib/public-origin";

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return NextResponse.json(buildOpenApiDocument(origin), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
