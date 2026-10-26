const fs = require("fs");
const {
  Connection, Keypair, SystemProgram, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

const load = (f) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f))));

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const owner = load("wallet.json");
  const agents = JSON.parse(fs.readFileSync("agents.json"));
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");

  // 1. Make the Trip Planner's own wallet (a different wallet from the agents' owner)
  let planner;
  if (fs.existsSync("planner-wallet.json")) {
    planner = load("planner-wallet.json");
  } else {
    planner = Keypair.generate();
    fs.writeFileSync("planner-wallet.json", JSON.stringify(Array.from(planner.secretKey)));
  }
  console.log("Planner wallet:", planner.publicKey.toBase58());

  // 2. Give it a little SOL for fees
  const bal = await conn.getBalance(planner.publicKey);
  if (bal < 0.05 * LAMPORTS_PER_SOL) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: planner.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      })
    );
    await sendAndConfirmTransaction(conn, tx, [owner]);
    console.log("Sent 0.1 SOL to the planner wallet");
  }

  // 3. The planner leaves feedback on each agent
  const sdk = new SolanaSDK({ cluster: "devnet", signer: planner });
  const { PublicKey } = require("@solana/web3.js");
  const scores = { flight: 92, hotel: 88 };

  for (const key of Object.keys(scores)) {
    const asset = new PublicKey(agents[key].asset);
    console.log("Feedback for", agents[key].name, "...");
    const res = await sdk.giveFeedback(asset, {
      value: String(scores[key]),
      score: scores[key],
      tag1: "starred",
    });
    console.log("  result:", res.success, res.signature || res.error);
  }

  // 4. Read the registry back
  for (const key of ["flight", "hotel", "rogue"]) {
    const asset = new PublicKey(agents[key].asset);
    const acct = await sdk.loadAgent(asset);
    console.log(agents[key].name, "-> registered:", acct !== null);
    if (acct) {
      try {
        const s = await sdk.getSummary(asset);
        console.log("   summary:", s);
      } catch (e) {
        console.log("   summary not available yet:", e.message);
      }
    }
  }
})().catch((e) => console.log("ERROR:", e));