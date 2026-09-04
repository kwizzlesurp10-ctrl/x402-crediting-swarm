import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(buildOpenApiDocument(origin), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
