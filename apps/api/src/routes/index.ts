import { Router, type RequestHandler } from "express";
import {
  checkDatabase,
  getDefaultHouseholdId,
  getHouseholdContext,
  getLatestShoppingCart,
  getShoppingCart,
  listGroceries,
  listTasks,
  markShoppingCartHandedOff,
} from "@homeflow/database";
import type { HealthDto, ShoppingProvider } from "@homeflow/shared";
import { planRequestSchema, SHOPPING_PROVIDERS } from "@homeflow/shared";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { idParamSchema } from "../schemas/requests.js";
import { planRequest } from "../services/agentService.js";
import { approveAndExecute, fetchApproval, reject } from "../services/approvalService.js";
import { checkoutHandoffUrl, searchShoppingProducts, shoppingCapabilities } from "../services/shoppingService.js";

const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function buildRoutes(deps: AppDeps): Router {
  const r = Router();
  // Local demo build: a single seeded household, resolved server-side. There is no per-user auth yet.
  let cachedHousehold: string | undefined;
  const household = async () => (cachedHousehold ??= await getDefaultHouseholdId());

  r.get(
    "/health",
    wrap(async (_req, res) => {
      const [database, mcp] = await Promise.all([checkDatabase(), deps.mcp.ping()]);
      const body: HealthDto = {
        status: database && mcp ? "ok" : "degraded",
        time: new Date().toISOString(),
        version: "0.1.0",
        checks: { database: database ? "up" : "down", mcp: mcp ? "up" : "down" },
        ai: { provider: deps.provider.name, isMock: deps.provider.isMock },
        environment: deps.config.NODE_ENV,
        demoBuild: true,
      };
      res.status(database ? 200 : 503).json(body);
    }),
  );

  r.get(
    "/household/context",
    wrap(async (_req, res) => void res.json(await getHouseholdContext(await household()))),
  );
  r.get(
    "/tasks",
    wrap(async (_req, res) => void res.json({ tasks: await listTasks(await household()) })),
  );
  r.get(
    "/groceries",
    wrap(async (_req, res) => void res.json({ items: await listGroceries(await household()) })),
  );
  r.get("/shopping/capabilities", wrap(async (_req, res) => void res.json({ providers: shoppingCapabilities() })));
  r.get("/shopping/cart", wrap(async (_req, res) => void res.json({ cart: await getLatestShoppingCart(await household()) })));
  r.post(
    "/shopping/search",
    wrap(async (req, res) => {
      const body = z.object({ provider: z.enum(SHOPPING_PROVIDERS), query: z.string().trim().min(1).max(120) }).parse(req.body);
      res.json(searchShoppingProducts(body.provider, body.query));
    }),
  );
  r.get(
    "/shopping/cart/:id",
    wrap(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const cart = await getShoppingCart(await household(), id);
      if (!cart) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Shopping cart not found." } });
        return;
      }
      res.json({ cart });
    }),
  );
  r.post(
    "/shopping/cart/:id/handoff",
    wrap(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const cart = await getShoppingCart(await household(), id);
      if (!cart) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Shopping cart not found." } });
        return;
      }
      const handoffUrl = checkoutHandoffUrl(cart.provider as ShoppingProvider, cart.handoffUrl);
      if (!handoffUrl) {
        res.status(409).json({ error: { code: "UNSUPPORTED", message: "No official checkout handoff is configured." } });
        return;
      }
      res.json({ cart: await markShoppingCartHandedOff(await household(), id, handoffUrl), handoffUrl });
    }),
  );

  r.post(
    "/agent/plan",
    wrap(async (req, res) => {
      const body = planRequestSchema.parse(req.body);
      const out = await planRequest(
        { provider: deps.provider, mcp: deps.mcp, approvalTtlMs: deps.config.APPROVAL_TTL_SECONDS * 1000, now: deps.now },
        await household(),
        body,
      );
      res.status(201).json(out);
    }),
  );

  r.get(
    "/approvals/:id",
    wrap(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ approval: await fetchApproval(await household(), id) });
    }),
  );
  r.post(
    "/approvals/:id/approve",
    wrap(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await approveAndExecute({ mcp: deps.mcp, now: deps.now }, await household(), id));
    }),
  );
  r.post(
    "/approvals/:id/reject",
    wrap(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await reject(await household(), id, deps.now));
    }),
  );
  return r;
}
