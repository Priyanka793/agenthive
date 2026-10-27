// Fake data, only used when the backend is not running
const MOCK = {
  agents: [
    { name: "Flight Search Agent", role: "flight", score: 92, confidence: "high", reviewers: 3, registered: true, status: "chosen", reason: "Chosen: best score (92) among 2 trusted flight agent(s)" },
    { name: "Budget Flights Agent", role: "flight", score: 80, confidence: "high", reviewers: 3, registered: true, status: "passed", reason: "Passed the Trust Gate (score 80) but not chosen: Flight Search Agent ranks higher (92)" },
    { name: "Hotel Recommender", role: "hotel", score: 88, confidence: "high", reviewers: 3, registered: true, status: "chosen", reason: "Chosen: best score (88) among 1 trusted hotel agent(s)" },
    { name: "Budget Hotel Agent", role: "hotel", score: 35, confidence: "high", reviewers: 3, registered: true, status: "blocked", reason: "Reputation 35 is below 70" },
    { name: "Rogue Agent", role: "hotel", score: 0, confidence: "none", reviewers: 0, registered: false, status: "blocked", reason: "Not found in the Solana Agent Registry" }
  ],
  itinerary: ["Day 1: Asakusa and Ueno", "Day 2: Shibuya and Harajuku", "Day 3: Day trip to Nikko"]
};

const ROLE_TITLES = { flight: "Flights", hotel: "Hotels" };
const STATUS_ORDER = { chosen: 0, passed: 1, blocked: 2 };

function statusOf(a) {
  return a.status || (a.hired ? "chosen" : "blocked");
}

function cardHtml(a) {
  const status = statusOf(a);
  const css = status === "chosen" ? "hired" : status === "passed" ? "passed" : "blocked";
  const label =
    status === "chosen" ? "CHOSEN (hired)" :
    status === "passed" ? "TRUSTED, NOT CHOSEN" : "BLOCKED";
  const short = (w) => w.slice(0, 4) + "…" + w.slice(-4);
  const evidence = a.evidence && a.evidence.length
    ? `<p><em>Onchain reviews (latest per reviewer):</em></p>` +
      a.evidence.map(e => `<p class="review">Reviewer <a href="https://explorer.solana.com/address/${e.reviewer}?cluster=devnet" target="_blank">${short(e.reviewer)}</a> gave ${e.score}</p>`).join("")
    : "";
  const links = a.registered
    ? `<p><a href="https://explorer.solana.com/address/${a.address}?cluster=devnet" target="_blank">Agent on Solscan</a>${
        a.txSignature
          ? ` · <a href="https://explorer.solana.com/tx/${a.txSignature}?cluster=devnet" target="_blank">Feedback written onchain</a>`
          : ""
      }</p>`
    : "";
  return `
    <div class="card ${css}">
      <h3>${a.name}</h3>
      <p>Registered in the Registry: ${a.registered ? "✓ yes" : "✗ no"}</p>
      <p>Score: ${a.score} · Confidence: ${a.confidence} · Reviewers: ${a.reviewers ?? 0}</p>
      ${evidence}
      <strong>${label}</strong>
      <p>${a.reason || ""}</p>
      ${links}
    </div>`;
}

function renderAgents(data) {
  const roles = [...new Set(data.agents.map(a => a.role || "agents"))];

  const chosen = data.agents.filter(a => statusOf(a) === "chosen").map(a => `${a.name} (${a.score})`);
  const summary = chosen.length
    ? `<p class="summary">Hired: ${chosen.join(" + ")}</p>`
    : `<p class="summary">No trusted agent was found.</p>`;

  const steps = `
    <div class="steps">
      <span>1. Candidates found</span> →
      <span>2. Verified in the Solana Agent Registry (identity + reputation)</span> →
      <span>3. Best trusted agent chosen for each job</span> →
      <span>4. Feedback written onchain</span>
    </div>`;

  const groups = roles.map(role => {
    const list = data.agents
      .filter(a => (a.role || "agents") === role)
      .sort((x, y) => STATUS_ORDER[statusOf(x)] - STATUS_ORDER[statusOf(y)] || y.score - x.score);
    return `<h2 class="role-title">${ROLE_TITLES[role] || role}: ${list.length} candidate(s)</h2>` +
      list.map(cardHtml).join("");
  });

  return steps + summary + groups.join("");
}

document.getElementById("planBtn").addEventListener("click", async () => {
  document.getElementById("agents").innerHTML = "<p>Checking agents on the Solana Agent Registry...</p>";
  document.getElementById("itinerary").innerHTML = "";

  let data = MOCK;
  try {
    const res = await fetch("http://localhost:3000/plan-trip?q=" + encodeURIComponent(document.getElementById("tripInput").value));
    if (!res.ok) throw new Error("backend error");
    data = await res.json();
  } catch (e) {
    console.log("Backend not running, using fake data");
  }

  document.getElementById("agents").innerHTML = renderAgents(data);

      const t = data.transport;
  const v = data.validation;
  const validationHtml = v
    ? "<h2>Validation</h2>" +
      v.checks.map(c => `<p>${c.pass ? "✓" : "✗"} ${c.label}</p>`).join("") +
      `<p><strong>${v.ok ? "Plan accepted" : "Plan failed validation"}. Feedback score written for hired agents: ${v.feedbackScore}</strong></p>`
    : "";
  document.getElementById("itinerary").innerHTML =
    "<h2>Your itinerary</h2>" + data.itinerary.map(d => `<p>${d}</p>`).join("") +
    (t ? `<h2>Getting around</h2><p><strong>Best way: ${t.best}</strong></p>` + t.tips.map(x => `<p>${x}</p>`).join("") : "") +
    validationHtml;
});
