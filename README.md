# AgentHive

An open-source **Agent-to-Agent hiring network** built on the [Solana Agent Registry](https://solana.com/agent-registry).

> VectorFlow Club Hackathon, Track 2, Challenge A: Best Use of the Solana Agent Registry

## The problem

Planning a trip needs several specialized tasks: finding flights, recommending hotels within a budget, and building a day-by-day itinerary. One AI agent may not do all of them reliably, so agents need to hire other agents. Today they have no trusted way to discover other agents, verify their identity, check their reputation, or judge the quality of their work. That makes agent-to-agent collaboration unsafe.

## The solution

AgentHive's **Trip Planner Agent** hires only agents it can verify. For a request like *"Plan a 3-day budget trip to Tokyo"*:

1. It looks up each candidate agent in the **Solana Agent Registry** (onchain identity).
2. It reads the agent's **reputation** (onchain feedback from past jobs).
3. The **Trust Gate** hires only registered agents with a reputation of 70 or more. Everything else is blocked.
4. It combines the results into a day-by-day itinerary.
5. After the job, it **writes feedback onchain** for every agent it hired, so reputation is earned and visible.

## How the Registry is used

The code lives in [`backend/server.js`](backend/server.js), using the [`8004-solana`](https://www.npmjs.com/package/8004-solana) SDK on **Solana devnet**.

| Step | SDK call | Where |
|------|----------|-------|
| Register agents | `sdk.registerAgent(uri)` | `backend/register-agents.js` |
| Verify identity | `sdk.loadAgent(asset)` | `checkAgent()` in `server.js` |
| Read reputation | `sdk.readAllFeedback(asset)` | `checkAgent()` in `server.js` |
| Write feedback after a job | `sdk.giveFeedback(asset, {...})` | `handler()` in `server.js` |

An agent that is not found in the Registry (the demo "Rogue Agent") is blocked automatically. The UI shows every decision with links to the agent and the feedback transaction on Solscan.

## Project structure

```
frontend/            web UI (HTML, CSS, JavaScript)
backend/server.js    Trip Planner API with the Trust Gate
backend/register-agents.js   registers the demo agents on devnet
backend/seed-feedback.js     creates the planner wallet and first reviews
backend/agents.json  addresses of the demo agents
agents/              agent description files linked from the Registry
```

## Run it locally

Requires Node.js 18 or newer.

```bash
cd backend
npm install
node make-wallet.js          # creates wallet.json (keep it private!)
# get free devnet SOL for the printed address at https://faucet.solana.com
node register-agents.js      # registers Flight + Hotel agents on devnet
node seed-feedback.js        # creates planner wallet + first reviews
node server.js               # starts the API on http://localhost:3000
```

Then open `frontend/index.html` (for example with the VS Code Live Server extension) and click **Plan my trip**.

> Never commit `wallet.json` or `planner-wallet.json`. They are in `.gitignore`.

## Honest limits

- The flight, hotel and itinerary results are demo data. The Registry parts (identity, reputation, feedback) are real and onchain.
- Reputation is a plain average of onchain feedback scores. A production version should weight reviewers, count distinct clients, and resist fake reviews (for example with the SDK's ATOM engine and ProofPass).
- Devnet only.

## Licence

MIT. See [LICENSE](LICENSE).
