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

const MIN_SCORE = 70; // the Trust Gate: only agents with reputation >= 70 can be hired

// Which job each candidate agent applies for.
// The planner picks ONE agent per job (the best one that passes the Trust Gate).
const ROLES = {
  flight: "flight",
  flight2: "flight",
  hotel: "hotel",
  budget: "hotel",
  rogue: "hotel",
};
const roleOf = (key) => agents[key].role || ROLES[key];

// TRUST GATE: identity + reputation, both read from the Solana Agent Registry
async function checkAgent(key) {
  const info = agents[key];
  const asset = new PublicKey(info.asset);
  const out = {
    key, name: info.name, role: roleOf(key), address: info.asset,
    registered: false, score: 0, confidence: "none", reviewers: 0,
    passed: false, hired: false, status: "blocked", txSignature: "",
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

  if (out.score >= MIN_SCORE) out.passed = true;
  else out.reason = `Reputation ${out.score} is below ${MIN_SCORE}`;
  return out;
}

// SELECTION: for each job, choose the best agent that passed the Trust Gate.
// Best = highest score; if tied, the one with more distinct reviewers.
function selectBest(results) {
  const roles = [...new Set(results.map((r) => r.role))];
  const selection = {};
  for (const role of roles) {
    const candidates = results.filter((r) => r.role === role);
    const passing = candidates
      .filter((r) => r.passed)
      .sort((a, b) => b.score - a.score || b.reviewers - a.reviewers);

    if (passing.length === 0) {
      selection[role] = null; // nobody trustworthy for this job
      continue;
    }
    const winner = passing[0];
    winner.hired = true;
    winner.status = "chosen";
    winner.reason = `Chosen: best score (${winner.score}) among ${passing.length} trusted ${role} agent(s)`;
    selection[role] = { key: winner.key, name: winner.name, score: winner.score };

    for (const r of passing.slice(1)) {
      r.status = "passed";
      r.reason = `Passed the Trust Gate (score ${r.score}) but not chosen: ${winner.name} ranks higher (${winner.score})`;
    }
  }
  return selection;
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
  // Local transport tips by destination (demo data: typical tips, not live information)
const TRANSPORT = {
  tokyo: {
    best: "Shinkansen (bullet train) between cities, JR trains and Metro inside Tokyo",
    tips: [
      "Airport to city: Narita Express or Keisei Skyliner",
      "Get a Suica or Pasmo card for trains, metro and buses",
      "Day 3 Nikko: Tobu limited express train from Asakusa",
    ],
  },
  china: {
    best: "High-speed rail (G trains) between cities, Metro inside the city",
    tips: [
      "Airport to Beijing centre: Airport Express train, then Metro",
      "The Beijing Subway reaches most sights, such as Tiananmen and the Temple of Heaven",
      "Great Wall at Mutianyu: tour bus or private car from the city (about 1.5 hours)",
    ],
  },
  goa: {
    best: "Rented scooter or taxi (Goa has no metro)",
    tips: [
      "Rent a scooter for the beaches, with a valid licence and a helmet",
      "Use pre-booked or app-based taxis for longer trips",
      "Arrive by Konkan Railway (Madgaon or Thivim) or by air",
    ],
  },
  generic: {
    best: "Metro or train inside the city, taxi when needed",
    tips: [
      "Airport to city: airport train or metro if available, otherwise a taxi",
      "Buy a local transit card for the city",
      "Use trains for trips to nearby cities",
    ],
  },
};

function pickTransport(text = "") {
  const t = String(text).toLowerCase();
  for (const key of ["tokyo", "china", "goa"]) {
    if (t.includes(key)) return TRANSPORT[key];
  }
  for (const alias of Object.keys(ALIASES)) {
    if (t.includes(alias)) return TRANSPORT[ALIASES[alias]];
  }
  return TRANSPORT.generic;
}
  try {
    const itinerary = pickItinerary(req.query.q);
    const ok = itinerary.length === 3; // simple validator: is the plan complete?

    // 1. Check every candidate agent (identity + reputation)
    const keys = Object.keys(agents).filter((k) => roleOf(k));
    const results = await Promise.all(keys.map(checkAgent));

    // 2. Choose the best trusted agent for each job
    const selection = selectBest(results);

    // 3. After the job, the planner writes feedback onchain ONLY for the agents it hired
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

    res.json({ agents: results, selection, itinerary, transport: pickTransport(req.query.q) });
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