const MOCK = {
  agents: [
    { name: "Flight Search Agent", score: 92, confidence: "high", registered: true, hired: true },
    { name: "Hotel Recommender", score: 88, confidence: "high", registered: true, hired: true },
    { name: "Rogue Agent", score: 0, confidence: "none", registered: false, hired: false, reason: "Unregistered agent" }
  ],
  itinerary: ["Day 1: Asakusa and Ueno", "Day 2: Shibuya and Harajuku", "Day 3: Day trip to Nikko"]
};

document.getElementById("planBtn").addEventListener("click", () => {
  document.getElementById("agents").innerHTML = MOCK.agents.map(a => `
    <div class="card ${a.hired ? "hired" : "blocked"}">
      <h3>${a.name}</h3>
      <p>Registered: ${a.registered ? "✓" : "✗"}</p>
      <p>Score: ${a.score} · Confidence: ${a.confidence}</p>
      <strong>${a.hired ? "HIRED" : "BLOCKED: " + a.reason}</strong>
    </div>`).join("");

  document.getElementById("itinerary").innerHTML =
    "<h2>Your itinerary</h2>" + MOCK.itinerary.map(d => `<p>${d}</p>`).join("");
});