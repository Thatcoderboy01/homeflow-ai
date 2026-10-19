# Architecture

Diagrams are Mermaid (rendered by GitHub and most Markdown viewers).

## 1. System context

```mermaid
flowchart LR
  user([Family member]) -->|browser| web[HomeFlow Web<br/>React + Vite]
  web -->|REST /api/v1| api[HomeFlow API<br/>Express]
  api -->|MCP Streamable HTTP| mcp[HomeFlow MCP Server]
  api -->|Google Gen AI API, optional| gemini[(Google Gemini)]
  api --> db[(MySQL)]
  mcp --> db
  alexa[[Alexa+ experience<br/>NOT connected in this starter]] -.->|future MCP client| mcp
```

The dotted line is a **planned** integration path, not something this repository implements or tests.

## 2. Components

```mermaid
flowchart TB
  subgraph Browser
    ui[Chat panel · Plan preview · Task list · Grocery list]
  end
  subgraph API["apps/api (Express)"]
    routes[Routes + Zod validation] --> agentSvc[agentService<br/>PLAN ONLY]
    routes --> apprSvc[approvalService<br/>approve / reject / execute]
    routes --> reads[Read endpoints]
  end
  subgraph Agent["packages/agent"]
    planner[runPlanner loop] --> provider{{LlmProvider}}
    provider --> mock[MockProvider]
    provider --> gemini[GeminiProvider]
    mcpClient[McpToolClient]
  end
  subgraph MCP["apps/mcp-server"]
    http[Streamable HTTP · bearer auth · Origin check] --> tools[Tool handlers<br/>get_household_context · create_task · update_grocery_list]
  end
  subgraph DB["packages/database"]
    svc[Services: household · tasks · groceries · approvals] --> prisma[Prisma 7 + MariaDB adapter] --> mysql[(MySQL)]
  end
  ui --> routes
  agentSvc --> planner
  planner --> mcpClient
  apprSvc --> mcpClient
  mcpClient --> http
  tools --> svc
  reads --> svc
  agentSvc --> svc
  apprSvc --> svc
```

| Component                              | Responsibility                                                                                              | Must NOT do                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Express API**                        | Validation, CORS, rate limiting, error shaping, resolving the household, orchestrating plan/approve/reject. | Let the model or browser pick the household or run state-changing tools directly.             |
| **Agent orchestration** (`runPlanner`) | Tool-calling loop with the LLM; injects `householdId`; validates the proposed plan.                         | Expose write tools to the model.                                                              |
| **LLM provider**                       | Translate to/from the Google Gemini API (or the deterministic mock).                                         | Hold household data or fall back silently to mock.                                             |
| **MCP client** (`McpToolClient`)       | Calls MCP tools over Streamable HTTP with a bearer token.                                                   | Bypass the MCP server to write data.                                                          |
| **MCP server**                         | Exposes three explicit tools; validates input; verifies approvals for write tools.                          | Replace the API (no sessions, users, or UI logic); run arbitrary SQL or touch the filesystem. |
| **Tool handlers**                      | Parse input, verify the approval, call a database service, return structured JSON.                          | Contain business rules that belong in services.                                               |
| **Database services**                  | The only code that talks to Prisma; enforce idempotency, dedupe, atomic approval transitions.               | Know about HTTP or MCP.                                                                       |

## 3. Request sequence (plan, approve, execute)

```mermaid
sequenceDiagram
  actor U as User
  participant W as React UI
  participant A as Express API
  participant P as Planner + LLM provider
  participant C as MCP client
  participant M as MCP server
  participant D as MySQL
  U->>W: "Guests are coming on Sunday. Help me prepare."
  W->>A: POST /agent/plan
  A->>A: Zod validation, resolve household
  A->>P: runPlanner(message)
  P->>C: get_household_context (householdId injected)
  C->>M: tools/call (bearer token)
  M->>D: read context
  D-->>M: tasks, groceries, preferences
  M-->>P: context JSON
  P-->>A: propose_plan (validated Plan)
  A->>D: INSERT ActionApproval (PENDING, hash, expiry)
  A-->>W: 201 plan + approvalId (no data changed)
  U->>W: Approve
  W->>A: POST /approvals/:id/approve
  A->>D: UPDATE ... WHERE status=PENDING AND not expired (atomic)
  loop each approved action
    A->>C: create_task / update_grocery_list (+approvalId, actionIndex)
    C->>M: tools/call
    M->>D: verify APPROVED + hash + exact match
    M->>D: write (idempotent)
  end
  A->>D: mark EXECUTED / FAILED with per-action results
  A-->>W: results (UI shows success only now)
  W->>A: GET /tasks, /groceries (refresh)
```

## 4. Deployment (target, not yet exercised)

```mermaid
flowchart LR
  user([Browser]) -->|HTTPS| cdn[Vercel or static host<br/>apps/web build]
  user -->|HTTPS| caddy
  subgraph EC2["AWS EC2 (single instance)"]
    caddy[Caddy / nginx reverse proxy<br/>TLS] --> api[API :4000]
    api -->|127.0.0.1| mcp[MCP :4100]
    api --> db[(MySQL on EC2 or RDS)]
    mcp --> db
  end
  api -.->|Server-side API key| gemini[(Google Gemini)]
```

MCP stays on loopback unless a remote MCP client (e.g. a real Alexa+ integration) must reach it; then expose only `/mcp` over HTTPS with proper authentication. See [DEPLOYMENT.md](DEPLOYMENT.md).

## 5. Database ER diagram

See [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

## Structure adjustments vs. the suggested tree

- `apps/api/src/controllers/` and `errors/` were dropped: handlers are small and live in `routes/index.ts`; the shared `DomainError` lives in `packages/shared`.
- `apps/mcp-server/src/services/` was dropped: tool handlers call `packages/database` services directly.
- DB services live in `packages/database/src/services` (shared by API and MCP) instead of `apps/*/services`.
- `packages/*` export TypeScript source directly; apps are bundled with `tsup`. There is no separate build step for packages.
- `apps/web` has no router (single page) and the `features/` folder holds the assistant state hook.
