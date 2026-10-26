const fs = require("fs");
const {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

const load = (f) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f))));

(async () => {
  const { SolanaSDK } = await import("8004-solana");
  const owner = load("wallet.json");
  const agents = JSON.parse(fs.readFileSync("agents.json"));
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");

  // Two independent reviewers with their own wallets
  const reviewers = [
    { file: "reviewer1-wallet.json", scores: { flight: 95, hotel: 85, budget: 30 } },
    { file: "reviewer2-wallet.json", scores: { flight: 90, hotel: 88, budget: 40 } },
  ];

  for (const r of reviewers) {
    let kp;
    if (fs.existsSync(r.file)) {
      kp = load(r.file);
    } else {
      kp = Keypair.generate();
      fs.writeFileSync(r.file, JSON.stringify(Array.from(kp.secretKey)));
    }
    console.log("Reviewer wallet:", kp.publicKey.toBase58());

    const bal = await conn.getBalance(kp.publicKey);
    if (bal < 0.03 * LAMPORTS_PER_SOL) {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: owner.publicKey,
          toPubkey: kp.publicKey,
          lamports: 0.05 * LAMPORTS_PER_SOL,
        })
      );
      await sendAndConfirmTransaction(conn, tx, [owner]);
      console.log("  funded with 0.05 SOL");
    }

    const sdk = new SolanaSDK({ cluster: "devnet", signer: kp });
    for (const key of Object.keys(r.scores)) {
      const res = await sdk.giveFeedback(new PublicKey(agents[key].asset), {
        value: String(r.scores[key]),
        score: r.scores[key],
        tag1: "starred",
      });
      console.log("  ", agents[key].name, "score", r.scores[key], "->", res.success);
    }
  }
})().catch((e) => console.log("ERROR:", e));
