# Grocery shopping integration

HomeFlow's shopping workflow is provider-neutral and approval-first:

1. The assistant reads the persisted grocery list.
2. It proposes a cart containing only requested list items.
3. The user reviews and explicitly approves the cart proposal.
4. The approved cart is persisted as `PREPARED`.
5. HomeFlow can open an official provider site for manual checkout.
6. The user verifies price, availability, substitutions, fees, payment, and the final order.

Preparing a cart never marks groceries as purchased and never claims that an order was placed.

## Provider capability matrix

| Provider | Product search | Live price/stock | Cart/order API | HomeFlow behavior |
| --- | --- | --- | --- | --- |
| Blinkit | Not publicly documented | Not publicly documented | Not publicly documented | Manual official-site handoff |
| Zepto | Not publicly documented | Not publicly documented | Not publicly documented | Manual official-site handoff |
| Swiggy Instamart | Official MCP exists, production access requires onboarding | Requires approved credentials | Requires approved credentials | Manual handoff until configured |
| ONDC | Available through an authorized Buyer Network Participant | Network response dependent | Protocol lifecycle available through participant | Manual handoff until participant integration |
| Manual checkout | No | No | No | Persist checklist and let user verify |

HomeFlow does not scrape private endpoints, automate retailer logins, bypass CAPTCHA or anti-bot controls, store retailer credentials, or store payment details. Third-party “API” services that scrape retailer apps are not treated as authorized integrations.

## API and MCP surfaces

- `GET /api/v1/shopping/capabilities` reports configured capabilities and limitations.
- `POST /api/v1/shopping/search` returns an honest empty result when no authorized search adapter is configured; it never fabricates products or prices.
- `GET /api/v1/shopping/cart` returns the latest persisted proposed cart.
- `POST /api/v1/shopping/cart/:id/handoff` marks a prepared cart as handed off and returns an official provider URL.
- MCP `prepare_shopping_cart` is approval-gated and idempotent by `(approvalId, actionIndex)`.

## Local setup and migration

The shopping cart migration is additive and does not reset existing data:

```bash
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

No shopping-provider credential is required for the rest of HomeFlow to run. A future authorized ONDC or Swiggy adapter must be isolated behind the same provider capability contract and must revalidate prices and availability before any external state-changing operation.

## Manual verification checklist

- Ask: “Prepare a cart from my grocery list.”
- Confirm the assistant creates a pending proposal and the grocery list remains unchanged.
- Reject the proposal and confirm no cart is persisted.
- Create and approve the proposal; confirm the Shopping workspace shows `PREPARED`.
- Open the official provider handoff and verify that HomeFlow does not claim an order.
- Confirm a cart is not marked purchased until a future explicit receipt workflow is implemented.
- Try an unsupported provider search and confirm the UI shows “not configured” rather than fake products.
