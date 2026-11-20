import { NextResponse } from "next/server";

const TOKEN =
  "x402-trust-verification=v1:MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES7UjJ9XFU1xMwtXSfsSyOnBoTxMBdKTvypTHDwxiWeIzJ5k3JLtJRDtBo435MFhItcelm_1GFzzsF3ltaL6tjA\n";

export async function GET() {
  return new NextResponse(TOKEN, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
