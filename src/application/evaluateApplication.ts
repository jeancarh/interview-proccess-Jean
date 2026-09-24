import { decide } from "../domain/decide.ts";
import type { DecisionResult, LoanApplication } from "../domain/loanApplication.ts";
import type { DecisionRepository, Explanation, ExplanationPort, Logger } from "./ports.ts";

export type EvaluationDeps = {
  repository: DecisionRepository;
  explainer: ExplanationPort;
  logger: Logger;
};

export type EvaluationResult = DecisionResult & {
  id: string;
  explanation: Explanation | null;
};

export type EvaluateApplication = (application: LoanApplication) => Promise<EvaluationResult>;

export const makeEvaluateApplication =
  ({ repository, explainer, logger }: EvaluationDeps): EvaluateApplication =>
  async (application) => {
    const result = decide(application);
    const record = await repository.save(result);

    // The explanation layer is optional: it must never block the deterministic decision.
    let explanation: Explanation | null = null;
    try {
      explanation = await explainer.explain(result);
    } catch (err) {
      logger.error({ event: "explanation_failed", decisionId: record.id, errorType: (err as Error).name });
    }

    return { id: record.id, ...result, explanation };
  };
