import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "../../../application/ports.ts";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
};

/**
 * Last line of defense. Never echoes the request body, stack traces or error
 * messages that might contain applicant data.
 */
export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (err, _req, res, _next) => {
    const requestId = res.locals.requestId as string | undefined;

    if (err?.type === "entity.parse.failed") {
      logger.info({ event: "malformed_json", requestId, status: 400 });
      res.status(400).json({ error: "MALFORMED_JSON", message: "Request body is not valid JSON" });
      return;
    }
    if (err?.type === "entity.too.large") {
      logger.info({ event: "payload_too_large", requestId, status: 413 });
      res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body is too large" });
      return;
    }

    logger.error({ event: "unhandled_error", requestId, errorType: err?.name ?? "Error", status: 500 });
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected error" });
  };
