import { timingSafeEqual } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Logger } from "pino";
import { registerTools } from "../tools/index.js";

function bearerMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function buildMcpServer(logger: Logger): McpServer {
  const server = new McpServer({ name: "homeflow-mcp", version: "0.1.0" });
  registerTools(server, logger);
  return server;
}

/**
 * Stateless Streamable HTTP endpoint at POST /mcp (MCP spec 2025-11-25 as implemented by the
 * official TypeScript SDK). A fresh server+transport per request keeps this simple and horizontally safe.
 */
export function createMcpApp(opts: { authToken: string; logger: Logger; allowedOrigins?: string[] }): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => void res.json({ status: "ok" }));

  // MCP spec: servers MUST validate Origin to prevent DNS-rebinding. Non-browser clients send none.
  const originGuard = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (origin && !(opts.allowedOrigins ?? []).includes(origin)) {
      res.status(403).json({ jsonrpc: "2.0", error: { code: -32002, message: "Origin not allowed" }, id: null });
      return;
    }
    next();
  };
  app.use("/mcp", originGuard);

  const auth = (req: Request, res: Response, next: NextFunction) => {
    if (!bearerMatches(req.header("authorization"), opts.authToken)) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
      return;
    }
    next();
  };

  app.post("/mcp", auth, express.json({ limit: "100kb" }), async (req, res) => {
    const server = buildMcpServer(opts.logger);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      opts.logger.error({ err: String(err) }, "mcp request failed");
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  });

  const notAllowed = (_req: Request, res: Response) =>
    void res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
  app.get("/mcp", auth, notAllowed);
  app.delete("/mcp", auth, notAllowed);
  return app;
}
