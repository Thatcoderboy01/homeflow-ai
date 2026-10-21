# Upcoming features

These items are intentionally deferred from the release-frozen hackathon MVP.

## Shopping integrations

- **P1 — Authorized live product search:** Search provider catalogs through an approved Blinkit, Zepto, Swiggy, ONDC, or equivalent adapter.  
  **Why deferred:** No Blinkit or Zepto public consumer API was verified; Swiggy and ONDC require onboarding and credentials.  
  **Prerequisites:** Written provider authorization, credentials, location handling, rate limits, and contract tests.
- **P1 — Verified price comparison:** Compare equivalent products using fresh, provider-returned prices and units.  
  **Why deferred:** The current application intentionally fabricates no price or availability data.  
  **Prerequisites:** Authorized product search and a freshness/normalization policy.
- **P2 — External cart preparation:** Create or synchronize a cart on an approved provider.  
  **Why deferred:** Current carts are HomeFlow proposals only and must not imply external state.  
  **Prerequisites:** Provider cart API, idempotency, revalidation, and explicit user authorization.
- **P1 — Provider-approved ordering and tracking:** Hand off or place orders and display verified status.  
  **Why deferred:** Payment and order APIs are not configured; HomeFlow must never claim an order without provider confirmation.  
  **Prerequisites:** Provider approval, secure OAuth, payment boundary, order webhooks/status, and failure reconciliation.

## Household intelligence

- **P2 — Inventory and restocking:** Track on-hand quantities separately from the shopping list.  
  **Why deferred:** The current MVP only supports `NEEDED` and `PURCHASED` grocery states.  
  **Prerequisites:** Backward-compatible schema, receipt confirmation, and a clear inventory lifecycle.
- **P3 — Expiration tracking:** Track expiry dates and reminders for household supplies.  
  **Why deferred:** Requires new data, notification behavior, and user confirmation flows.  
  **Prerequisites:** Product/receipt input and notification policy.
- **P2 — Recurring household routines:** Generate and maintain recurring tasks.  
  **Why deferred:** The current approval model covers one-time actions only.  
  **Prerequisites:** Recurrence schema, edit semantics, and idempotent scheduling.

## Integrations and platform

- **P1 — Alexa and voice interaction:** Connect HomeFlow plans and approvals to voice experiences.  
  **Why deferred:** No voice integration is part of this release freeze.  
  **Prerequisites:** Alexa skill/backend integration, account linking, and voice-safe approval UX.
- **P2 — Additional authorized services:** Add only provider adapters with documented authorization.  
  **Why deferred:** External integrations require independent security and terms review.  
  **Prerequisites:** Provider contracts, secrets management, rate limits, and operational monitoring.
- **P1 — Production authentication and multi-household access:** Replace the single-demo-household model with authenticated tenancy.  
  **Why deferred:** The current local demo has no user authentication.  
  **Prerequisites:** Identity provider, authorization model, migration plan, and tenant-isolation tests.
- **P3 — Notifications and advanced automation:** Add reminders, notifications, and scheduled automations.  
  **Why deferred:** Not required for the core approval-first demo.  
  **Prerequisites:** User preferences, delivery provider, consent, and retry/reconciliation behavior.
