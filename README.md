# MCP Demo Servers

Five live MCP (Model Context Protocol) demo servers with self-contained dummy backends. Each server is publicly accessible so a prospect can connect it in **ChatGPT** or **Claude** and try it immediately — no signup, no install.

## Servers at a Glance

| # | Server | MCP Endpoint | What it demonstrates |
|---|--------|-------------|---------------------|
| 1 | **Acme Sports** — B2C Commerce | `http://localhost:3001/mcp` | Product search, stock, cart handoff, order support |
| 2 | **Acme Industrial Supply** — B2B Distributor | `http://localhost:3002/mcp` | Reorder, quote building, contract pricing, account data |
| 3 | **Acme Parts Co** — Parts Finder | `http://localhost:3003/mcp` | Compatibility search, fitment, substitutes, local stock |
| 4 | **Acme Home Services** — Service Marketplace | `http://localhost:3004/mcp` | Provider matching, availability, booking, quotes |
| 5 | **Acme Industrial Supply** — Internal Sales Rep | `http://localhost:3005/mcp` | Customer briefing, live quote, order lookup, approvals |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install & Run

```bash
# Install dependencies
pnpm install

# Build all servers
pnpm build

# Run all servers in parallel
pnpm dev:all

# Or run individually
pnpm dev:b2c        # Port 3001
pnpm dev:b2b        # Port 3002
pnpm dev:parts      # Port 3003
pnpm dev:marketplace # Port 3004
pnpm dev:internal   # Port 3005
```

### Docker

```bash
# Run all 5 servers
docker compose up -d

# Run a specific server
docker compose up b2c-commerce -d
```

## Connecting to ChatGPT

1. Go to **Settings → Apps & Connectors → Advanced settings** and enable developer mode
2. Go to **Settings → Connectors → Create**
3. Enter the MCP endpoint URL (e.g., `https://your-host.com/mcp`)
4. Click Create — you'll see the advertised tools

> **Note:** ChatGPT requires HTTPS. Use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) for local development.

## Connecting to Claude

1. Go to **Settings → Connectors**
2. Add a custom connector with the MCP endpoint URL
3. The tools appear automatically in your conversations

## Health & Monitoring

Each server exposes:
- `GET /health` — HTML dashboard with uptime, tool call count, active sessions
- `GET /api/logs` — JSON API of recent tool calls

## Test Prompt Sheet

Copy any of these directly into ChatGPT or Claude once the server is connected.

### Server 1 — Acme Sports (B2C)

1. "Trail running shoes, size 10, waterproof, under €200. I need them by Friday — what have you got?"
2. "Is the Apex Trail Runner X2 in black, size 10 in stock? When would it arrive?"
3. "What goes well with the Summit Hiker Pro for a multi-day hike?"
4. "Where is my order ACM-2024-08812?"
5. "I want to return the jacket from order ACM-2024-07543. What do I do?"
6. "Add two Apex Trail Runner X2 in size 10 black to my cart"

### Server 2 — Acme Industrial Supply (B2B buyer)

7. "Show me my account status and any open orders"
8. "Reorder everything from our last order in April"
9. "What is our contract price for BRG-6205-ZZ and BRG-6304-2RS? Quote me 150 of each."
10. "BRG-6205-ZZ is showing out of stock in Manchester — what is the best substitute and is it in stock?"
11. "Create a quote for 200x BRG-6205-ZZ, 100x SEAL-V-25x42, and 50x BELT-A-1250 for delivery to our Birmingham site"
12. "I need to discuss a volume deal for Q3 — can you loop in my rep?"

### Server 3 — Acme Parts Co (parts finder)

13. "My 2019 VW Golf 1.6 TDI makes a grinding noise when braking — what parts do I need?"
14. "Front brake pads for a 2019 VW Golf 1.6 TDI — compare OEM vs aftermarket"
15. "Look up part number 1J0615301E — is it in stock in Manchester?"
16. "Part 1J0615301E is out of stock — what is the best substitute with the highest fitment confidence?"
17. "Give me a full front and rear brake service parts list for a 2019 Golf and add it all to my cart"
18. "What do I need to replace the timing belt on a 2021 Ford Focus 2.0 EcoBlue?"

### Server 4 — Acme Home Services (marketplace)

19. "I need a plumber in Manchester this weekend, budget around £150 — what have you got?"
20. "Tell me more about Dave's Plumbing Services"
21. "What slots does Dave's Plumbing have this Saturday or Sunday?"
22. "How much should a boiler service normally cost in Manchester?"
23. "Book Dave's Plumbing for Saturday 10am"
24. "Can I move booking BK-20045 to Sunday afternoon instead?"
25. "I need some electrical work — not sure exactly what, can you help me figure out what I need?"

### Server 5 — Acme Industrial Supply internal (sales rep)

26. "I have a call with Hargreaves Engineering in 10 minutes. They want to reorder the April order but need delivery by Thursday. What can I tell them?"
27. "Show me Hargreaves Engineering's last 6 orders and any outstanding quotes"
28. "Is Hargreaves Engineering within their credit limit? Any payment issues I should know about?"
29. "Quote Hargreaves 150x BRG-6205-ZZ and 80x SEAL-V-25x42 at their contract price — can we deliver to Birmingham by Thursday?"
30. "BRG-6205-ZZ is short at Manchester — what can I offer them instead, and what is the price impact?"
31. "Request 8% discount for Hargreaves — they are placing a £14k Q3 blanket order"
32. "Show me my full pipeline and open quotes for this month"

## Architecture

```
mcp-demos/
  packages/shared/          # Shared infrastructure (DB, transport, logging, health)
  servers/
    b2c-commerce/           # Server 1 — 7 tools
    b2b-distributor/        # Server 2 — 8 tools
    parts-finder/           # Server 3 — 8 tools
    service-marketplace/    # Server 4 — 8 tools
    internal-sales-rep/     # Server 5 — 8 tools
```

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- **Database:** SQLite via `better-sqlite3` (in-memory seeded data)
- **HTTP:** Express with CORS and rate limiting
- **Monorepo:** pnpm workspaces
- **Testing:** Vitest

## All data is fictional

Company names follow the pattern "Acme [Vertical]". No real brands, people, or addresses are used.

## License

MIT
