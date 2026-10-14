import { Router, type RequestHandler } from "express";
import { checkDatabase, getDefaultHouseholdId, getHouseholdContext, listGroceries, listTasks } from "@homeflow/database";
import type { HealthDto } from "@homeflow/shared";
import { planRequestSchema } from "@homeflow/shared";
import type { AppDeps } from "../app.js";
import { idParamSchema } from "../schemas/requests.js";
import { planRequest } from "../services/agentService.js";
import { approveAndExecute, fetchApproval, reject } from "../services/approvalService.js";

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
