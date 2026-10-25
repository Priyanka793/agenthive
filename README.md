# AgentHive

An open-source **Agent-to-Agent hiring network** built on the [Solana Agent Registry](https://solana.com/agent-registry).

> VectorFlow Club Hackathon, Track 2, Challenge A: Best Use of the Solana Agent Registry

## The problem

Complex tasks such as planning a trip need several specialized agents (flights, hotels, itinerary). Today an agent has no trusted way to discover other agents, verify their identity, assess their reputation, or validate the quality of their work. That makes agent-to-agent collaboration unsafe and unreliable.

## The solution

AgentHive lets an orchestrator agent hire only agents it can verify.

When a user asks "Plan a 3-day budget trip to Tokyo":

1. The **Trip Planner Agent** splits the request into flights, hotels, and itinerary.
2. It **discovers** candidate agents through the Solana Agent Registry.
3. It **verifies** each candidate's onchain identity, reputation, and validation records.
4. It **hires** only agents that pass a trust threshold, calling their A2A / MCP endpoints.
5. It **combines** the results into a complete itinerary.
6. It **records feedback onchain** for every agent it hired, so reputation reflects real work.

## How the Registry is used

| Step | Registry interaction |
|------|----------------------|
| Register worker agents | Register Flight and Hotel agents with service type and endpoint |
| Verify identity | Load the agent's onchain record and check its endpoint matches |
| Assess reputation | Read feedback summary (average score, feedback count, confidence) |
| Check validation | Use validator results and any available validation records |
| Close the loop | Write feedback onchain after each job |

## Planned structure

```
packages/registry-client   thin wrapper around the 8004-solana SDK
agents/trip-planner        orchestrator with the trust gate
agents/flight-*            demo flight agents (good / mediocre / untrusted)
agents/hotel-*             demo hotel agents
agents/validator           checks outputs against user constraints
web/                       UI showing each trust check and the hiring decision
scripts/seed-devnet.ts     registers demo agents and seeds feedback
```

## Status

Work in progress. Network: Solana devnet.

## Licence

MIT. See [LICENSE](LICENSE).
