const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const result = {
  agents: [
    { name: "Flight Search Agent", score: 99, confidence: "high", registered: true, hired: true, address: "", txSignature: "" },
    { name: "Hotel Recommender", score: 88, confidence: "high", registered: true, hired: true, address: "", txSignature: "" },
    { name: "Rogue Agent", score: 0, confidence: "none", registered: false, hired: false, reason: "Unregistered agent" }
  ],
  itinerary: ["Day 1: Asakusa and Ueno", "Day 2: Shibuya and Harajuku", "Day 3: Day trip to Nikko"]
};

app.get("/plan-trip", (req, res) => res.json(result));
app.post("/plan-trip", (req, res) => res.json(result));

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));