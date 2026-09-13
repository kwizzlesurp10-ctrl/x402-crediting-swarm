const PORT = process.env.PORT || 3009;
const BASE_URL = `http://localhost:${PORT}`;

async function testApi() {
  console.log("Starting Endpoint Verification against", BASE_URL);

  // 1. Test GET /api/swarm
  try {
    const res = await fetch(`${BASE_URL}/api/swarm`);
    const data = await res.json();
    console.log("✓ GET /api/swarm Response Status:", res.status);
    console.log("  Swarm Name:", data.name, "| Network:", data.network);
    if (res.status !== 200) throw new Error("GET /api/swarm failed");
  } catch (e) {
    console.error("❌ GET /api/swarm failed:", e.message);
    process.exit(1);
  }

  // 2. Test POST /api/swarm without payment (Should return HTTP 402 with PAYMENT-REQUIRED header)
  try {
    const res = await fetch(`${BASE_URL}/api/swarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { endpoint_url: "https://test.market" } })
    });
    console.log("✓ POST /api/swarm (Unpaid) Status:", res.status);
    if (res.status !== 402) throw new Error("Expected HTTP 402");
  } catch (e) {
    console.error("❌ POST /api/swarm 402 test failed:", e.message);
    process.exit(1);
  }

  // 3. Test AgentMail GET /api/mailrail
  try {
    const res = await fetch(`${BASE_URL}/api/mailrail`);
    const data = await res.json();
    console.log("✓ GET /api/mailrail Status:", res.status, "| Inbox count:", data.count);
    if (res.status !== 200) throw new Error("GET /api/mailrail failed");
  } catch (e) {
    console.error("❌ GET /api/mailrail failed:", e.message);
    process.exit(1);
  }

  // 4. Test AgentMail POST /api/mailrail
  try {
    const res = await fetch(`${BASE_URL}/api/mailrail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'agent_target',
        subject: 'Integration Test Mail',
        body: 'Testing AgentMail message dispatch'
      })
    });
    const data = await res.json();
    console.log("✓ POST /api/mailrail Status:", res.status, "| Mail ID:", data.message?.id);
    if (res.status !== 200 || !data.message?.id) throw new Error("POST /api/mailrail failed");
  } catch (e) {
    console.error("❌ POST /api/mailrail failed:", e.message);
    process.exit(1);
  }

  // 5. Test OpenAPI Spec GET /openapi.json
  try {
    const res = await fetch(`${BASE_URL}/openapi.json`);
    const data = await res.json();
    console.log("✓ GET /openapi.json Status:", res.status, "| Title:", data.info?.title);
    if (res.status !== 200 || !data.paths) throw new Error("OpenAPI spec failed");
  } catch (e) {
    console.error("❌ GET /openapi.json failed:", e.message);
    process.exit(1);
  }

  // 6. Test MCP Manifest GET /.well-known/mcp.json
  try {
    const res = await fetch(`${BASE_URL}/.well-known/mcp.json`);
    const data = await res.json();
    console.log("✓ GET /.well-known/mcp.json Status:", res.status, "| Tools:", data.tools?.length);
    if (res.status !== 200 || !data.tools) throw new Error("MCP manifest failed");
  } catch (e) {
    console.error("❌ GET /.well-known/mcp.json failed:", e.message);
    process.exit(1);
  }

  console.log("\n✨ ALL ENDPOINT INTEGRATION TESTS PASSED CLEANLY! ✨");
}

testApi();
