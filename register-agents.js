const fs = require("fs");
const { Keypair } = require("@solana/web3.js");

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const signer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("wallet.json")))
  );
  const sdk = new SolanaSDK({ cluster: "devnet", signer });

  // Descriptions of the agents (we upload these to GitHub later)
  const base = "https://raw.githubusercontent.com/Priyanka793/agenthive/main/agents/";
  const list = [
    { key: "flight", name: "Flight Search Agent", file: "flight-agent.json", skill: "flight search" },
    { key: "hotel", name: "Hotel Recommender", file: "hotel-agent.json", skill: "hotel recommendation" },
  ];

  fs.mkdirSync("agents", { recursive: true });
  const saved = {};

  for (const a of list) {
    fs.writeFileSync(
      `agents/${a.file}`,
      JSON.stringify({
        type: "agent-registration",
        name: a.name,
        description: `AgentHive demo agent: ${a.skill}`,
        services: [{ name: "A2A", endpoint: "http://localhost:3000/plan-trip" }],
        active: true,
      }, null, 2)
    );

    console.log("Registering", a.name, "...");
    let result;
    try {
      result = await sdk.registerAgent(base + a.file);
    } catch (e) {
      console.log("With link failed:", e.message, "-> retrying without link");
      result = await sdk.registerAgent();
    }
    console.log("Result:", result);
    if (result && result.asset) {
      saved[a.key] = { name: a.name, asset: result.asset.toBase58() };
    }
  }

  // The "rogue" agent is a random address that is never registered
  saved.rogue = { name: "Rogue Agent", asset: Keypair.generate().publicKey.toBase58() };

  fs.writeFileSync("agents.json", JSON.stringify(saved, null, 2));
  console.log("Saved agents.json:", saved);
})().catch((e) => console.log("ERROR:", e));