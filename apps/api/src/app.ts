import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import type { LlmProvider, SpeechSynthesizer, ToolCaller } from "@homeflow/agent";
import type { ApiConfig } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { buildRoutes } from "./routes/index.js";

export interface AppDeps {
  config: Pick<ApiConfig, "corsOrigins" | "NODE_ENV" | "APPROVAL_TTL_SECONDS">;
  logger: Logger;
  provider: LlmProvider;
  speech?: SpeechSynthesizer;
  mcp: ToolCaller;
  now?: () => Date;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) =>
        !origin || deps.config.corsOrigins.includes(origin) ? cb(null, true) : cb(new Error("CORS_ORIGIN_NOT_ALLOWED")),
    }),
  );
  if (deps.config.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger: deps.logger,
        serializers: { req: (r) => ({ id: r.id, method: r.method, url: r.url }), res: (r) => ({ statusCode: r.statusCode }) },
      }),
    );
  }
  app.use(express.json({ limit: "20kb" }));

  // Planning can call a paid model: keep a modest per-IP limit.
  const limiter: RequestHandler = rateLimit({
    windowMs: 60_000,
    limit: deps.config.NODE_ENV === "test" ? 10_000 : 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  app.use("/api/v1/agent", limiter);

  app.use("/api/v1", buildRoutes(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
