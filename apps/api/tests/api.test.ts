import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MockProvider, type LlmProvider } from "@homeflow/agent";
import { disconnectPrisma, getPrisma, listGroceries, listTasks } from "@homeflow/database";
import type { PlanResponseDto } from "@homeflow/shared";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { mcpClientFor, resetData, silentLogger, startMcp } from "../../../tests/support/helpers.js";

const GUESTS = "Guests are coming on Sunday. Help me prepare.";
let mcp: Awaited<ReturnType<typeof startMcp>>;
let hid: string;
const allowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174"];
const baseConfig = { corsOrigins: allowedOrigins, NODE_ENV: "test" as const, APPROVAL_TTL_SECONDS: 900 };

const makeApp = (over: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({ config: baseConfig, logger: silentLogger, provider: new MockProvider(), mcp: mcpClientFor(mcp.url), ...over });

beforeAll(async () => void (mcp = await startMcp()));
afterAll(async () => {
  await mcp.close();
  await disconnectPrisma();
});
beforeEach(async () => void (hid = await resetData()));

describe("health, validation and errors", () => {
  const conversationalProvider: LlmProvider = {
    name: "gemini",
    isMock: false,
    generate: async (req) => ({
      stopReason: "end_turn",
      content: [{ type: "text", text: req.tools.length === 0 ? "Hey! I can help organize your household." : "unexpected" }],
    }),
  };

  it("answers greetings without creating a proposal or calling MCP", async () => {
    const app = makeApp({ provider: conversationalProvider });
    const res = await request(app).post("/api/v1/agent/plan").send({ message: "Hi" });
    expect(res.status).toBe(201);
    expect(res.body.provider).toEqual({ name: "gemini", isMock: false });
    expect(res.body.approval).toBeNull();
    expect(res.body.assistantMessage).toMatch(/help organize/i);
    expect((await listTasks(hid)).length).toBe(1);
    expect((await listGroceries(hid)).length).toBe(1);
  });

  it("GET /health reports database, mcp and mock mode", async () => {
    const res = await request(makeApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      checks: { database: "up", mcp: "up" },
      ai: { provider: "mock", isMock: true },
      demoBuild: true,
    });
  });
  it("reports degraded when MCP is unreachable", async () => {
    const res = await request(makeApp({ mcp: mcpClientFor("http://127.0.0.1:1/mcp") })).get("/api/v1/health");
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.mcp).toBe("down");
  });
  it("validates plan input", async () => {
    const app = makeApp();
    for (const body of [{}, { message: "" }, { message: "x".repeat(2001) }, { message: 5 }]) {
      const res = await request(app).post("/api/v1/agent/plan").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
  it("handles malformed JSON, oversize bodies, unknown routes and bad ids safely", async () => {
    const app = makeApp();
    expect((await request(app).post("/api/v1/agent/plan").set("content-type", "application/json").send("{bad")).status).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/agent/plan")
          .send({ message: "x".repeat(30_000) })
      ).status,
    ).toBe(413);
    expect((await request(app).get("/api/v1/nope")).status).toBe(404);
    expect((await request(app).post("/api/v1/approvals/bad%20id!/approve")).status).toBe(400);
    const missing = await request(app).post("/api/v1/approvals/doesnotexist/approve");
    expect(missing.status).toBe(404);
    expect(JSON.stringify(missing.body)).not.toMatch(/prisma|stack|select/i);
  });
  it("allows configured CORS origins for actual and preflight requests", async () => {
    const app = makeApp();
    for (const origin of allowedOrigins) {
      const actual = await request(app).get("/api/v1/health").set("Origin", origin);
      expect(actual.headers["access-control-allow-origin"]).toBe(origin);

      const preflight = await request(app).options("/api/v1/tasks").set("Origin", origin).set("Access-Control-Request-Method", "GET");
      expect(preflight.status).toBe(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
      expect(preflight.headers["access-control-allow-methods"]).toContain("GET");
    }
  });

  it("rejects unconfigured CORS origins", async () => {
    const app = makeApp();
    const actual = await request(app).get("/api/v1/health").set("Origin", "http://evil.example");
    expect(actual.status).toBe(403);
    expect(actual.headers["access-control-allow-origin"]).toBeUndefined();

    const preflight = await request(app)
      .options("/api/v1/tasks")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "GET");
    expect(preflight.status).toBe(403);
    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("surfaces provider failures instead of falling back to mock", async () => {
    const broken: LlmProvider = {
      name: "gemini",
      isMock: false,
      generate: async () => Promise.reject(Object.assign(new Error("x"), { name: "ThrottlingException" })),
    };
    const res = await request(makeApp({ provider: broken }))
      .post("/api/v1/agent/plan")
      .send({ message: GUESTS });
    expect(res.status).toBe(502); // raw SDK errors are never leaked, and there is no mock fallback
    expect(res.body.error.code).toBe("PROVIDER_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/Throttling/);
    expect((await listTasks(hid)).length).toBe(1);
  });
});

describe("plan -> approve -> execute", () => {
  it("planning changes nothing; approval executes and persists", async () => {
    const app = makeApp();
    const plan = await request(app).post("/api/v1/agent/plan").send({ message: GUESTS });
    expect(plan.status).toBe(201);
    const body = plan.body as PlanResponseDto;
    expect(body.provider).toEqual({ name: "mock", isMock: true });
    expect(body.approval?.status).toBe("PENDING");
    expect(body.approval?.actions.length).toBeGreaterThan(5);

    // Nothing was written yet.
    expect((await listTasks(hid)).length).toBe(1);
    expect((await listGroceries(hid)).length).toBe(1);

    const ok = await request(app).post(`/api/v1/approvals/${body.approval!.id}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.executedNow).toBe(true);
    expect(ok.body.approval.status).toBe("EXECUTED");
    expect(ok.body.approval.results.every((r: { ok: boolean }) => r.ok)).toBe(true);

    const tasks = await request(app).get("/api/v1/tasks");
    expect(tasks.body.tasks.map((t: { title: string }) => t.title)).toContain("Grocery run for guest snacks and drinks");
    const groceries = await request(app).get("/api/v1/groceries");
    const names = groceries.body.items.map((g: { name: string }) => g.name);
    expect(names).toContain("Paneer");
    expect(names.filter((n: string) => n.toLowerCase() === "milk")).toHaveLength(1); // existing item updated, not duplicated
  });

  it("repeated approval submissions do not duplicate actions", async () => {
    const app = makeApp();
    const { body } = await request(app).post("/api/v1/agent/plan").send({ message: GUESTS });
    const url = `/api/v1/approvals/${body.approval.id}/approve`;
    const results = await Promise.all([request(app).post(url), request(app).post(url), request(app).post(url)]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.executedNow).length).toBe(1);
    const again = await request(app).post(url);
    expect(again.body.executedNow).toBe(false);
    const created = (await listTasks(hid)).filter((t) => t.title.includes("guests"));
    expect(created).toHaveLength(1);
    expect(await getPrisma().task.count({ where: { approvalId: body.approval.id } })).toBe(4);
  });

  it("rejection executes nothing and blocks later approval", async () => {
    const app = makeApp();
    const { body } = await request(app).post("/api/v1/agent/plan").send({ message: GUESTS });
    const rej = await request(app).post(`/api/v1/approvals/${body.approval.id}/reject`);
    expect(rej.status).toBe(200);
    expect(rej.body.approval.status).toBe("REJECTED");
    expect((await request(app).post(`/api/v1/approvals/${body.approval.id}/reject`)).status).toBe(200); // idempotent
    const late = await request(app).post(`/api/v1/approvals/${body.approval.id}/approve`);
    expect(late.status).toBe(409);
    expect((await listTasks(hid)).length).toBe(1);
  });

  it("expired approvals are rejected with 410 and execute nothing", async () => {
    const app = makeApp();
    const { body } = await request(app).post("/api/v1/agent/plan").send({ message: GUESTS });
    await getPrisma().actionApproval.update({ where: { id: body.approval.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post(`/api/v1/approvals/${body.approval.id}/approve`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("APPROVAL_EXPIRED");
    expect((await listTasks(hid)).length).toBe(1);
  });

  it("a tampered approval record is refused by the tool server", async () => {
    const app = makeApp();
    const { body } = await request(app).post("/api/v1/agent/plan").send({ message: GUESTS });
    // Someone edits stored actions after the user saw the preview: hash check must fail every action.
    await getPrisma()
      .$executeRaw`UPDATE ActionApproval SET actions = JSON_SET(actions, '$[0].title', 'Tampered') WHERE id = ${body.approval.id}`;
    const res = await request(app).post(`/api/v1/approvals/${body.approval.id}/approve`);
    expect(res.body.approval.status).toBe("FAILED");
    expect((await listTasks(hid)).some((t) => t.title === "Tampered")).toBe(false);
  });

  it("loadConfig requires a Gemini API key when Gemini is selected", () => {
    const env = { MCP_AUTH_TOKEN: "x".repeat(20), AI_PROVIDER: "gemini" };
    expect(() => loadConfig(env as never)).toThrow(/GEMINI_API_KEY/);
    expect(loadConfig({ ...env, GEMINI_API_KEY: "test-key" } as never).AI_PROVIDER).toBe("gemini");
  });
});
