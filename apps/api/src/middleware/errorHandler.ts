import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { DomainError, type ApiErrorBody } from "@homeflow/shared";

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = { error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } };
  res.status(404).json(body);
};

/** Single place that converts errors into safe JSON. Unknown errors never leak details. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const log = (req as { log?: { error: (o: object, m: string) => void; warn: (o: object, m: string) => void } }).log;
  let status = 500;
  let body: ApiErrorBody = { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } };

  if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  } else if (err instanceof DomainError) {
    status = err.httpStatus;
    body = { error: { code: err.code, message: err.message } };
  } else if ((err as { type?: string }).type === "entity.too.large") {
    status = 413;
    body = { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." } };
  } else if ((err as { type?: string }).type === "entity.parse.failed") {
    status = 400;
    body = { error: { code: "VALIDATION_ERROR", message: "Malformed JSON body." } };
  } else if ((err as Error)?.message === "CORS_ORIGIN_NOT_ALLOWED") {
    status = 403;
    body = { error: { code: "CORS_FORBIDDEN", message: "Origin not allowed." } };
  }

  if (status >= 500) log?.error({ err: String(err), stack: (err as Error)?.stack }, "request failed");
  res.status(status).json(body);
};
