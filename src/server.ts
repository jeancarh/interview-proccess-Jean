import { createApp } from "./adapters/inbound/http/app.ts";
import { InMemoryDecisionRepository } from "./adapters/outbound/inMemoryDecisionRepository.ts";
import { MockLlmExplainer } from "./adapters/outbound/mockLlmExplainer.ts";
import { safeLogger } from "./adapters/outbound/safeLogger.ts";
import { makeEvaluateApplication } from "./application/evaluateApplication.ts";

// Composition root: the only place that knows every concrete adapter.
const evaluate = makeEvaluateApplication({
  repository: new InMemoryDecisionRepository(),
  explainer: new MockLlmExplainer(),
  logger: safeLogger,
});

const port = Number(process.env.PORT ?? 3000);

createApp({ evaluate, logger: safeLogger }).listen(port, () => {
  console.log(`Underwriting API listening on http://localhost:${port}`);
  console.log(`POST http://localhost:${port}/api/underwriting/decision`);
});
