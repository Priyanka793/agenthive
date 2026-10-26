const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { Keypair, PublicKey } = require("@solana/web3.js");

const app = express();
app.use(cors());
app.use(express.json());

const agents = JSON.parse(fs.readFileSync("agents.json"));
const planner = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("planner-wallet.json")))
);

let readSdk, writeSdk;
async function init() {
  const { SolanaSDK } = await import("8004-solana");
  readSdk = new SolanaSDK({ cluster: "devnet" });
  writeSdk = new SolanaSDK({ cluster: "devnet", signer: planner });
}

const MIN_SCORE = 70; // the Trust Gate: hire only agents with reputation >= 70

// TRUST GATE: identity + reputation, both read from the Solana Agent Registry
async function checkAgent(key) {
  const info = agents[key];
  const asset = new PublicKey(info.asset);
  const out = {
    key, name: info.name, address: info.asset,
    registered: false, score: 0, confidence: "none", hired: false, txSignature: "",
  };

  const account = await readSdk.loadAgent(asset); // identity
  if (!account) {
    out.reason = "Not found in the Solana Agent Registry";
    return out;
  }
  out.registered = true;

  const all = await readSdk.readAllFeedback(asset); // reputation
  const valid = all.filter((f) => !f.revoked && typeof f.score === "number");
  if (valid.length === 0) {
    out.reason = "No reputation yet";
    return out;
  }
  out.score = Math.round(valid.reduce((s, f) => s + f.score, 0) / valid.length);
  out.confidence = valid.length >= 5 ? "high" : valid.length >= 2 ? "medium" : "low";

  if (out.score >= MIN_SCORE) out.hired = true;
  else out.reason = `Reputation ${out.score} is below ${MIN_SCORE}`;
  return out;
}

const itinerary = [
  "Day 1: Asakusa and Ueno",
  "Day 2: Shibuya and Harajuku",
  "Day 3: Day trip to Nikko",
];

// Simple validator: is the plan complete (3 days)?
const validate = () => itinerary.length === 3;

async function handler(req, res) {
  try {
    const results = await Promise.all(["flight", "hotel", "budget", "rogue"].map(checkAgent));
    const ok = validate();

    // After the job, the planner writes feedback onchain for each agent it hired
    await Promise.all(
      results.filter((r) => r.hired).map(async (r) => {
        try {
          const fb = await writeSdk.giveFeedback(new PublicKey(r.address), {
            value: ok ? "90" : "30",
            score: ok ? 90 : 30,
            tag1: "starred",
            endpoint: "/plan-trip",
          });
          r.txSignature = fb.signature || "";
        } catch (e) {
          console.log("Feedback failed for", r.name, e.message);
        }
      })
    );

    res.json({ agents: results, itinerary });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e.message });
  }
}

app.get("/plan-trip", handler);
app.post("/plan-trip", handler);

init().then(() =>
  app.listen(3000, () => console.log("Backend running on http://localhost:3000"))
);