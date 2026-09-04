import { NextRequest, NextResponse } from "next/server";
import { buildLlmsTxt } from "@/lib/openapi";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return new NextResponse(buildLlmsTxt(origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
