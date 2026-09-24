import type { DecisionResult } from "../../domain/loanApplication.ts";
import type { Explanation, ExplanationPort } from "../../application/ports.ts";

const HEADLINES: Record<DecisionResult["decision"], string> = {
  APPROVE: "The application meets all underwriting thresholds and is recommended for approval.",
  REFER: "The application is not declined, but it needs manual review by an underwriter.",
  DECLINE: "The application does not meet the minimum underwriting criteria.",
};

/**
 * Deterministic stand-in for an LLM. It only sees the decision result (codes,
 * metrics, messages), so swapping in a real model later does not change what
 * data leaves the domain.
 */
export class MockLlmExplainer implements ExplanationPort {
  async explain(result: DecisionResult): Promise<Explanation> {
    const lines = [HEADLINES[result.decision], ...result.reasons.map((r) => `- ${r.message}`)];
    return { source: "mock-llm", text: lines.join("\n") };
  }
}
