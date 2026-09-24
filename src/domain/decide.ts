import { DomainError } from "./loanApplication.ts";
import type { Decision, DecisionResult, LoanApplication, Metric, Reason } from "./loanApplication.ts";
import { MAX_APPROVED_LTV, RULES_BY_METRIC } from "./reasonCodes.ts";

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number, label: string) => {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new DomainError(`Cannot compute ${label}: denominator must be greater than 0`);
  }
  return numerator / denominator;
};

/**
 * Pure, deterministic underwriting decision.
 * No I/O, no framework: easy to test and to reuse behind any adapter.
 */
export function decide(app: LoanApplication): DecisionResult {
  // Decisions use raw ratios; rounding only affects what we report.
  const raw: Record<Metric, number> = {
    creditScore: app.creditScore,
    debtToIncome: safeRatio(app.monthlyDebt, app.annualIncome / 12, "debt-to-income"),
    loanToValue: safeRatio(app.requestedLoan, app.propertyValue, "loan-to-value"),
  };

  const reasons: Reason[] = [];
  for (const metric of Object.keys(RULES_BY_METRIC) as Metric[]) {
    const rule = RULES_BY_METRIC[metric].find((r) => r.breached(raw[metric], r.threshold));
    if (!rule) continue;
    const actual = metric === "creditScore" ? raw[metric] : round4(raw[metric]);
    reasons.push({
      code: rule.code,
      severity: rule.severity,
      metric,
      threshold: rule.threshold,
      actual,
      message: rule.message(actual, rule.threshold),
    });
  }

  const decision: Decision = reasons.some((r) => r.severity === "DECLINE")
    ? "DECLINE"
    : reasons.length > 0
      ? "REFER"
      : "APPROVE";

  return {
    decision,
    approvedAmount:
      decision === "APPROVE" ? Math.min(app.requestedLoan, app.propertyValue * MAX_APPROVED_LTV) : null,
    metrics: {
      debtToIncome: round4(raw.debtToIncome),
      loanToValue: round4(raw.loanToValue),
    },
    reasons,
  };
}
