const fs = require("fs");
const { Keypair } = require("@solana/web3.js");

const load = (f) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f))));

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const owner = load("wallet.json");
  const agents = JSON.parse(fs.readFileSync("agents.json"));

  if (agents.flight2) {
    console.log("flight2 is already in agents.json. Stopping so we don't register twice.");
    return;
  }

  // 1. The owner registers the second flight agent
  const ownerSdk = new SolanaSDK({ cluster: "devnet", signer: owner });
  const uri =
    "https://raw.githubusercontent.com/Priyanka793/agenthive/main/agents/budget-flights-agent.json";
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
  console.log("Registered Budget Flights Agent:", result.asset.toBase58());

  // 2. Save it right away, so it is never registered twice
  agents.flight2 = { name: "Budget Flights Agent", asset: result.asset.toBase58() };
  fs.writeFileSync("agents.json", JSON.stringify(agents, null, 2));
  console.log("Saved to agents.json");

  // 3. Three different reviewers each leave a decent (not great) review
  const reviewers = [
    ["planner-wallet.json", 80],
    ["reviewer1-wallet.json", 82],
    ["reviewer2-wallet.json", 78],
  ];
  for (const [file, score] of reviewers) {
    try {
      const sdk = new SolanaSDK({ cluster: "devnet", signer: load(file) });
      const fb = await sdk.giveFeedback(result.asset, {
        value: String(score),
        score,
        tag1: "starred",
      });
      console.log(file, "gave", score, "->", fb.success, fb.signature || fb.error);
    } catch (e) {
      console.log(file, "failed:", e.message);
    }
  }
  console.log("Done. Restart the backend (node server.js).");
})().catch((e) => console.log("ERROR:", e));