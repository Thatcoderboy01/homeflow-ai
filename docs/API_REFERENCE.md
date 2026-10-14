# API reference

Base URL (local): `http://localhost:4000/api/v1`. JSON in/out. **No authentication in this starter** (local demo build). A single seeded household is resolved server-side; clients never send a household id.

Errors always look like `{ "error": { "code": "…", "message": "…", "details"?: […] } }`.

| Status | Codes                                                |
| ------ | ---------------------------------------------------- |
| 400    | `VALIDATION_ERROR` (bad body/params/JSON)            |
| 403    | `CORS_FORBIDDEN`, `APPROVAL_INVALID`                 |
| 404    | `NOT_FOUND`                                          |
| 409    | `APPROVAL_CONFLICT` (e.g. approving a rejected plan) |
| 410    | `APPROVAL_EXPIRED`                                   |
| 413    | `PAYLOAD_TOO_LARGE` (body > 20 KB)                   |
| 429    | rate limit on `/agent/*` (30/min/IP)                 |
| 502    | `PROVIDER_ERROR`, `UPSTREAM_ERROR` (MCP unreachable) |
| 500    | `INTERNAL_ERROR` (details only in server logs)       |

## GET /health

`200` when the database is reachable (`status` may be `degraded` if MCP is down); `503` if the database is down.

```json
{
  "status": "ok",
  "time": "2026-10-14T02:35:15.584Z",
  "version": "0.1.0",
  "checks": { "database": "up", "mcp": "up" },
  "ai": { "provider": "mock", "isMock": true },
  "environment": "development",
  "demoBuild": true
}
```

## GET /household/context

Household, members, open tasks and needed groceries (same data the model reads through MCP).

## GET /tasks → `{ "tasks": [TaskDto] }`

## GET /groceries → `{ "items": [GroceryItemDto] }`

## POST /agent/plan (planning only: changes no household data)

```http
POST /api/v1/agent/plan
{ "message": "Guests are coming on Sunday. Help me prepare.", "conversationId": "optional" }
```

`message`: 1–2000 chars. Response `201`:

```json
{
  "conversationId": "cm…",
  "assistantMessage": "[Demo mode] Preparation plan for Sunday: 4 tasks and 6 grocery items … Please review the proposed actions below.",
  "provider": { "name": "mock", "isMock": true },
  "approval": {
    "id": "cm…",
    "status": "PENDING",
    "summary": "Preparation plan for Sunday: …",
    "actions": [
      {
        "type": "create_task",
        "title": "Grocery run for guest snacks and drinks",
        "dueDate": "2026-10-17T12:00:00.000Z",
        "status": "TODO"
      },
      { "type": "update_grocery_list", "name": "Milk", "quantity": 3, "unit": "litre" }
    ],
    "provider": "mock",
    "isMock": true,
    "expiresAt": "2026-10-14T02:50:00.000Z",
    "decidedAt": null,
    "executedAt": null,
    "results": null
  }
}
```

## GET /approvals/:id → `{ "approval": ApprovalDto }`

## POST /approvals/:id/approve

Atomically approves a PENDING, unexpired plan and executes each action through the MCP tools. Response `200`:

```json
{
  "executedNow": true,
  "approval": { "status": "EXECUTED", "results": [{ "index": 0, "type": "create_task", "ok": true, "message": "Done" }] }
}
```

Repeating the call returns the stored state with `"executedNow": false` and executes nothing. `status` is `FAILED` if any action failed (per-action messages in `results`).

## POST /approvals/:id/reject

Marks the plan REJECTED. Idempotent. Approving afterwards → `409`.

## Quick check

`./scripts/smoke-test.sh` runs plan → approve → repeat-approve against a running stack.
