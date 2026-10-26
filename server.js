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
    registered: false, score: 0, confidence: "none", reviewers: 0,
    hired: false, txSignature: "",
  };

  const account = await readSdk.loadAgent(asset); // identity
  if (!account) {
    out.reason = "Not found in the Solana Agent Registry";
    return out;
  }
  out.registered = true;

  const all = await readSdk.readAllFeedback(asset); // reputation
  const valid = all.filter((f) => !f.revoked && typeof f.score === "number");

  // Anti-spam: only each reviewer's LATEST review counts,
  // so one wallet cannot inflate a score by reviewing many times
  const latest = new Map();
  for (const f of valid) {
    const who = f.client.toBase58();
    const prev = latest.get(who);
    if (!prev || f.feedbackIndex > prev.feedbackIndex) latest.set(who, f);
  }
  const reviews = [...latest.values()];
  out.reviewers = reviews.length;

  if (reviews.length === 0) {
    out.reason = "No reputation yet";
    return out;
  }
  out.score = Math.round(reviews.reduce((s, f) => s + f.score, 0) / reviews.length);
  out.confidence = reviews.length >= 3 ? "high" : reviews.length === 2 ? "medium" : "low";

  if (out.score >= MIN_SCORE) out.hired = true;
  else out.reason = `Reputation ${out.score} is below ${MIN_SCORE}`;
  return out;
}

// Demo itineraries by destination (demo data)
const ITINERARIES = {
  tokyo: [
    "Day 1: Asakusa and Ueno",
    "Day 2: Shibuya and Harajuku",
    "Day 3: Day trip to Nikko",
  ],
  china: [
    "Day 1: Forbidden City and Tiananmen Square (Beijing)",
    "Day 2: Great Wall at Mutianyu",
    "Day 3: Temple of Heaven and a hutong food walk",
  ],
  goa: [
    "Day 1: Baga and Calangute beaches",
    "Day 2: Old Goa churches and Fontainhas",
    "Day 3: Fort Aguada and a sunset at Chapora",
  ],
};
const ALIASES = { japan: "tokyo", beijing: "china", shanghai: "china" };
const GENERIC = [
  "Day 1: Arrive and explore the city centre",
  "Day 2: Top sights and local food",
  "Day 3: Relax, shop and head home",
];

function pickItinerary(text = "") {
  const t = String(text).toLowerCase();
  for (const key of Object.keys(ITINERARIES)) {
    if (t.includes(key)) return ITINERARIES[key];
  }
  for (const alias of Object.keys(ALIASES)) {
    if (t.includes(alias)) return ITINERARIES[ALIASES[alias]];
  }
  return GENERIC;
}

async function handler(req, res) {
  try {
    const itinerary = pickItinerary(req.query.q);
    const ok = itinerary.length === 3; // simple validator: is the plan complete?

    const results = await Promise.all(
      ["flight", "hotel", "budget", "rogue"].map(checkAgent)
    );

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