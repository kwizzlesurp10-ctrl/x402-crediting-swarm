/**
 * The landing-page demo can send `fee_paid: true` or a "simulated" payment
 * header to skip x402. That must never work in production, otherwise any
 * caller gets free evaluations. Allowed only when explicitly enabled AND the
 * deployment is not Vercel production.
 */
export function simulatedPaymentsAllowed(env: {
  allow?: string;
  vercelEnv?: string;
  nodeEnv?: string;
}): boolean {
  if (env.vercelEnv === "production") return false;
  if (env.allow === "true") return true;
  // Local `next dev` keeps the demo working without extra config.
  return env.nodeEnv === "development" && !env.vercelEnv;
}

export function isSimulatedPaymentRequest(
  body: unknown,
  paymentHeader: string | null,
): boolean {
  const b = (body ?? {}) as { fee_paid?: unknown; feePaid?: unknown };
  return (
    b.fee_paid === true ||
    b.feePaid === true ||
    Boolean(paymentHeader && paymentHeader.includes("simulated"))
  );
}
