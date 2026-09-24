import { Router } from "express";
import type { EvaluateApplication } from "../../../application/evaluateApplication.ts";
import type { Logger } from "../../../application/ports.ts";
import { validateRequest } from "./validateRequest.ts";

export const underwritingRoutes = ({ evaluate, logger }: { evaluate: EvaluateApplication; logger: Logger }) => {
  const router = Router();

  router.post("/decision", async (req, res) => {
    const startedAt = performance.now();
    const requestId = res.locals.requestId as string;

    const validation = validateRequest(req.body);
    if (!validation.ok) {
      logger.info({ event: "validation_failed", requestId, status: 400 });
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: validation.errors,
      });
      return;
    }

    // Express 5 forwards rejected promises to the error handler.
    const result = await evaluate(validation.value);
    logger.info({
      event: "decision_made",
      requestId,
      decisionId: result.id,
      decision: result.decision,
      durationMs: Math.round(performance.now() - startedAt),
    });
    res.status(200).json(result);
  });

  return router;
};
