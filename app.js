const MOCK = {
  agents: [
    { name: "Flight Search Agent", score: 92, confidence: "high", registered: true, hired: true },
    { name: "Hotel Recommender", score: 88, confidence: "high", registered: true, hired: true },
    { name: "Rogue Agent", score: 0, confidence: "none", registered: false, hired: false, reason: "Unregistered agent" }
  ],
  itinerary: ["Day 1: Asakusa and Ueno", "Day 2: Shibuya and Harajuku", "Day 3: Day trip to Nikko"]
};

document.getElementById("planBtn").addEventListener("click", async () => {
  document.getElementById("agents").innerHTML = "<p>Checking agents on the Solana Agent Registry...</p>";
  document.getElementById("itinerary").innerHTML = "";

  let data = MOCK;
  try {
    const res = await fetch("http://localhost:3000/plan-trip");
    if (!res.ok) throw new Error("backend error");
    data = await res.json();
  } catch (e) {
    console.log("Backend not running, using fake data");
  }

  document.getElementById("agents").innerHTML = data.agents.map(a => `
    <div class="card ${a.hired ? "hired" : "blocked"}">
      <h3>${a.name}</h3>
      <p>Registered: ${a.registered ? "✓" : "✗"}</p>
      <p>Score: ${a.score} · Confidence: ${a.confidence}</p>
      <strong>${a.hired ? "HIRED" : "BLOCKED: " + a.reason}</strong>
      ${a.registered ? `<p><a href="https://solscan.io/account/${a.address}?cluster=devnet" target="_blank">Agent on Solscan</a>${a.txSignature ? ` · <a href="https://solscan.io/tx/${a.txSignature}?cluster=devnet" target="_blank">Feedback tx</a>` : ""}</p>` : ""}
    </div>`).join("");

  document.getElementById("itinerary").innerHTML =
    "<h2>Your itinerary</h2>" + data.itinerary.map(d => `<p>${d}</p>`).join("");
});