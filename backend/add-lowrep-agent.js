const fs = require("fs");
const { Keypair } = require("@solana/web3.js");

const load = (f) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f))));

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const owner = load("wallet.json");
  const planner = load("planner-wallet.json");
  const agents = JSON.parse(fs.readFileSync("agents.json"));

  fs.mkdirSync("agents", { recursive: true });
  fs.writeFileSync(
    "agents/budget-hotel-agent.json",
    JSON.stringify({
      type: "agent-registration",
      name: "Budget Hotel Agent",
      description: "AgentHive demo agent: cheap hotels, poor track record",
      services: [{ name: "A2A", endpoint: "http://localhost:3000/plan-trip" }],
      active: true,
    }, null, 2)
  );

  // 1. The owner registers the agent
  const ownerSdk = new SolanaSDK({ cluster: "devnet", signer: owner });
  const uri =
    "https://raw.githubusercontent.com/Priyanka793/agenthive/main/agents/budget-hotel-agent.json";
  let result;
  try {
    result = await ownerSdk.registerAgent(uri);
  } catch (e) {
    console.log("With link failed:", e.message, "-> retrying without link");
    result = await ownerSdk.registerAgent();
  }
  if (!result || !result.asset) {
    console.log("Registration result:", result);
    return;
  }
  console.log("Registered Budget Hotel Agent:", result.asset.toBase58());

  // 2. The planner leaves a bad review (score 35)
  const plannerSdk = new SolanaSDK({ cluster: "devnet", signer: planner });
  const fb = await plannerSdk.giveFeedback(result.asset, {
    value: "35",
    score: 35,
    tag1: "starred",
  });
  console.log("Feedback written:", fb.success, fb.signature || fb.error);

  // 3. Save it
  agents.budget = { name: "Budget Hotel Agent", asset: result.asset.toBase58() };
  fs.writeFileSync("agents.json", JSON.stringify(agents, null, 2));
  console.log("Saved to agents.json");
})().catch((e) => console.log("ERROR:", e));
