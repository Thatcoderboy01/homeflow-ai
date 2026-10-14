# MCP tools

Server: `apps/mcp-server`, official `@modelcontextprotocol/sdk` **1.32.1**, whose latest supported protocol version is **2025-11-25** (checked in `node_modules/@modelcontextprotocol/sdk/dist/esm/types.js`; older versions are also negotiable).
Transport: **Streamable HTTP**, `POST /mcp`, stateless (a new server/transport per request). `GET`/`DELETE /mcp` return `405`. `GET /healthz` is unauthenticated and returns no data.
Auth: `Authorization: Bearer $MCP_AUTH_TOKEN` (constant-time compare). Browser `Origin` headers are rejected unless listed in `MCP_ALLOWED_ORIGINS`.

> This server is **not connected to a live Alexa+ system**. See "Alexa+ track assumptions" in the README.

Only these three tools exist. There is no SQL, shell or filesystem tool. All responses are structured (`structuredContent`) and failures use `isError: true` with `{ error: { code, message } }`. Logs contain tool name, household id, approval id, outcome and duration only.

## `get_household_context` (read-only)

| Input          | Type   | Limits                                                         |
| -------------- | ------ | -------------------------------------------------------------- |
| `householdId`  | string | 1–64 chars; injected by the backend, never chosen by the model |
| `taskLimit`    | int    | 1–50, default 20                                               |
| `groceryLimit` | int    | 1–100, default 50                                              |

Returns `{ household, members, upcomingTasks, groceryItems }`. Only TODO/IN_PROGRESS tasks and NEEDED groceries are returned.

## `create_task` (state-changing, requires approval)

| Input                       | Type                           | Limits                                           |
| --------------------------- | ------------------------------ | ------------------------------------------------ |
| `householdId`, `approvalId` | string                         | required                                         |
| `actionIndex`               | int                            | 0–99, position of the action inside the approval |
| `title`                     | string                         | 1–200, trimmed                                   |
| `description`               | string?                        | ≤ 2000                                           |
| `dueDate`                   | ISO-8601 datetime with offset? | e.g. `2026-10-18T18:00:00Z`                      |
| `status`                    | enum?                          | TODO (default) / IN_PROGRESS / DONE / CANCELLED  |

Before writing, the server checks: approval exists for that household, status is `APPROVED`, stored actions match their SHA-256, and `{type:"create_task", …args}` equals `actions[actionIndex]` exactly. Returns `{ task, created }`; a repeated call returns the existing task with `created: false`.

## `update_grocery_list` (state-changing, requires approval)

| Input                                      | Type                 | Limits                                                               |
| ------------------------------------------ | -------------------- | -------------------------------------------------------------------- |
| `householdId`, `approvalId`, `actionIndex` |                      | as above                                                             |
| `name`                                     | string               | 1–120; duplicates detected by lower-cased, whitespace-collapsed name |
| `quantity`                                 | int?                 | 1–999                                                                |
| `unit`                                     | string?              | ≤ 30                                                                 |
| `notes`                                    | string?              | ≤ 255                                                                |
| `status`                                   | NEEDED / PURCHASED ? | default NEEDED (re-adding a purchased item puts it back)             |

Upserts by normalised name and **sets** values (does not increment), so retries are idempotent. Returns `{ item, created }`.

## What the LLM sees

The model is given only `get_household_context` (no arguments) and a local `propose_plan` pseudo-tool whose output is validated and stored as a PENDING approval. `create_task` and `update_grocery_list` are called only by the backend after approval (`apps/api/src/services/approvalService.ts`).

## Error codes

`VALIDATION_ERROR`, `NOT_FOUND`, `APPROVAL_INVALID` (unknown, not approved, tampered, or mismatching action), `INTERNAL_ERROR`.

## Manual test (curl)

```bash
curl -s -X POST http://127.0.0.1:4100/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
