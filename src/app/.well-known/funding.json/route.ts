import { NextResponse } from "next/server";
import { EVAL_PRICE, X402_NETWORK, X402_PAY_TO } from "@/lib/x402";

export async function GET() {
  return NextResponse.json(
    {
      network: X402_NETWORK,
      asset: "USDC",
      payTo: X402_PAY_TO,
      evaluationPrice: EVAL_PRICE,
      note: "Evaluation fees settle to this address. Not a token, not equity.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
