import { randomUUID } from "node:crypto";
import express from "express";
import type { EvaluateApplication } from "../../../application/evaluateApplication.ts";
import type { Logger } from "../../../application/ports.ts";
import { errorHandler, notFoundHandler } from "./errorHandler.ts";
import { underwritingRoutes } from "./underwritingRoutes.ts";

export type AppDeps = {
  evaluate: EvaluateApplication;
  logger: Logger;
};

/** Builds the Express app without listening, so tests can mount it on a random port. */
export function createApp({ evaluate, logger }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-Id", res.locals.requestId);
    next();
  });
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/underwriting", underwritingRoutes({ evaluate, logger }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
