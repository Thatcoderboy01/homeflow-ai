import { pino } from "pino";
import { disconnectPrisma } from "@homeflow/database";
import { loadConfig } from "./config/env.js";
import { createMcpApp } from "./transport/http.js";

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL, redact: ["req.headers.authorization"] });
const app = createMcpApp({
  authToken: config.MCP_AUTH_TOKEN,
  logger,
  allowedOrigins: config.MCP_ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),
});

const server = app.listen(config.MCP_PORT, config.MCP_HOST, () => {
  logger.info({ host: config.MCP_HOST, port: config.MCP_PORT }, "HomeFlow MCP server listening (POST /mcp)");
});

const shutdown = () => {
  server.close(() => void disconnectPrisma().finally(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
