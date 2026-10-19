import { X402_PAY_TO } from "@/lib/x402";
import { HomeClient } from "./home-client";

export default function Home() {
  return <HomeClient x402PayTo={X402_PAY_TO} />;
}
