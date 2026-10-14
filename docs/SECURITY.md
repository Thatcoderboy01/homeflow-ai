# Security

**This is a local development / demo build.** There is no user authentication or authorization. Do not expose it publicly: anyone who can reach the API can read and (with approval clicks) modify the seeded household. API and MCP servers bind to `127.0.0.1` by default.

## Implemented controls

| Area                  | Control                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval boundary     | Plans are stored as PENDING `ActionApproval` rows. Only `create_task` and `update_grocery_list` can appear (Zod discriminated union).                                                           |
| Server-side decisions | The browser sends only an id. The API performs an atomic conditional UPDATE (`PENDING` and not expired → `APPROVED`); exactly one caller wins and executes.                                     |
| No reuse              | Write tools require `approvalId` + `actionIndex`, re-check status, SHA-256 of stored actions, and exact equality with the approved action. Different args/index/household → `APPROVAL_INVALID`. |
| Idempotency           | `(approvalId, actionIndex)` unique key on tasks; grocery upsert sets values. Repeat approvals return stored state.                                                                              |
| Expiry                | Default 15 min (`APPROVAL_TTL_SECONDS`). Expired → 410, marked EXPIRED.                                                                                                                         |
| Model isolation       | Model sees one read tool and a pseudo-tool; household id injected server-side; write tools unreachable. Household data is labelled as data in the prompt.                                       |
| MCP                   | Bearer token (≥16 chars, placeholder refused in production), Origin allow-list, 100 KB body limit, no sessions, three fixed tools.                                                              |
| API                   | Helmet, CORS allow-list, 20 KB body limit, per-IP rate limit on `/agent`, Zod validation, safe error bodies (no stacks/SQL).                                                                    |
| Secrets               | `.env` is git-ignored; `.env.example` has placeholders only; logs redact auth headers; Bedrock credentials come from the AWS credential chain on the server, never the browser.                 |
| Provider honesty      | No silent fallback from a real provider to mock; mock output is labelled in API and UI.                                                                                                         |

## Production work still required

1. **Authentication & authorization** (sessions/OIDC), household membership checks on every query, per-user approval ownership and audit trail.
2. **Replace the shared MCP bearer token** with OAuth 2.1 / per-client credentials if MCP is exposed to external clients (e.g. a real Alexa+ integration), plus TLS everywhere.
3. CSRF/session hardening once cookies are used; stricter CSP for the web app.
4. Recovery job for approvals stuck in `APPROVED` after a crash; retention policy for messages/approvals.
5. Prompt-injection hardening: tasks/notes are user-controlled text fed to the model. The approval preview is the main defence; add content limits and review for any future write tools.
6. Rate limits per user, cost controls for Bedrock (max tokens, budgets/alarms).
7. Dependency audit (`npm audit`) and pinning in CI; secrets in AWS Secrets Manager / SSM; least-privilege IAM (`bedrock:InvokeModel` for one model only); encrypted database with backups.
8. Privacy review: household data is personal data; define retention and deletion.
