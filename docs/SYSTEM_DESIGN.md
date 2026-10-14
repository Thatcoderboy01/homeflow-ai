# System design

## Problem statement

Families coordinate chores, shopping and events across chats, notes and memory. General chatbots suggest things but do not remember the household or act. HomeFlow AI retrieves household context, proposes a multi-step plan, and performs the changes only after explicit approval.

## Functional requirements

| #   | Requirement                                                   | Status in this starter                                                                      |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| F1  | Chat request → structured plan (tasks + groceries)            | Implemented (mock provider verified; Bedrock code path unit-tested with a fake client only) |
| F2  | Retrieve saved household context and existing tasks           | Implemented via MCP `get_household_context`                                                 |
| F3  | Show a preview and require explicit approve/reject            | Implemented                                                                                 |
| F4  | Execute approved actions through validated MCP tools          | Implemented                                                                                 |
| F5  | Persist tasks and a shared grocery list without duplicates    | Implemented                                                                                 |
| F6  | Dashboard showing persisted tasks/groceries and system status | Implemented (not tested in a real browser)                                                  |

Out of scope: voice, payments, smart-home, multi-user permissions, authentication, calendar events (tasks with due dates stand in for events).

## Non-functional requirements

- **Safety:** no state change without server-verified approval; model cannot reach write tools.
- **Reliability:** idempotent execution; atomic approval transitions; explicit failure reporting (no mock fallback).
- **Local-first:** runs on one machine without AI credentials.
- **Observability:** structured JSON logs; no request bodies, secrets or task content in logs.
- **Simplicity:** three services (web, API, MCP), one database.

## Request lifecycle

See the sequence diagram in [ARCHITECTURE.md](ARCHITECTURE.md). In words: **plan** (read-only + one `ActionApproval` row) → **decide** (atomic status change) → **execute** (MCP write tools re-verify the approval) → **report** (per-action results).

## Security boundaries

1. Browser ↔ API: CORS allow-list, body size limit, Zod validation, rate limit on `/agent`.
2. API ↔ MCP: bearer token, loopback binding by default, Origin check.
3. LLM ↔ tools: model sees only `get_household_context` and `propose_plan`; household id injected by the backend.
4. MCP write tools ↔ database: approval id + action index required; stored actions hash re-checked; arguments must equal the approved action.
   Details: [SECURITY.md](SECURITY.md).

## Failure handling

| Failure                                                 | Behaviour                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LLM provider error / timeout / throttling               | `502 PROVIDER_ERROR` with a safe message. No fallback to mock.                                                                                               |
| Model returns no or invalid plan                        | Retried within the loop (max 4 steps), then `502`.                                                                                                           |
| MCP server down                                         | Health shows `degraded`; planning/executing return `502 UPSTREAM_ERROR`.                                                                                     |
| One action fails during execution                       | Other actions still run; approval becomes `FAILED` with per-action results; UI shows which failed.                                                           |
| Process crash after approval, before execution finishes | Approval stays `APPROVED`. Known gap (see backlog): add a recovery job that re-runs or fails stuck approvals; idempotency keys make a re-run safe for tasks. |
| Approval expired                                        | `410 APPROVAL_EXPIRED`; nothing executed.                                                                                                                    |
| Double click / retries                                  | Second call returns current state with `executedNow: false`.                                                                                                 |
