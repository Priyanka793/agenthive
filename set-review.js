const fs = require("fs");
const { Keypair, PublicKey } = require("@solana/web3.js");

const [key, scoreArg, who] = process.argv.slice(2);
const score = Number(scoreArg);

if (!["flight", "hotel", "budget"].includes(key) ||
    !Number.isInteger(score) || score < 0 || score > 100 ||
    !["reviewer1", "reviewer2"].includes(who)) {
  console.log("Usage: node set-review.js <flight|hotel|budget> <score 0-100> <reviewer1|reviewer2>");
  process.exit(1);
}

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(`${who}-wallet.json`)))
  );
  const agents = JSON.parse(fs.readFileSync("agents.json"));
  const sdk = new SolanaSDK({ cluster: "devnet", signer: kp });

  const res = await sdk.giveFeedback(new PublicKey(agents[key].asset), {
    value: String(score),
    score,
    tag1: "starred",
  });
  console.log(`${who} gave ${agents[key].name} a score of ${score}:`, res.success);
  if (res.signature) {
    console.log("Proof: https://solscan.io/tx/" + res.signature + "?cluster=devnet");
  }
})().catch((e) => console.log("ERROR:", e));