import type { Metric, ReasonCode, Severity } from "./loanApplication.ts";

export type Rule = {
  code: ReasonCode;
  severity: Severity;
  metric: Metric;
  threshold: number;
  /** true when the actual value breaches the threshold */
  breached: (actual: number, threshold: number) => boolean;
  message: (actual: number, threshold: number) => string;
};

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
const below = (actual: number, threshold: number) => actual < threshold;
const above = (actual: number, threshold: number) => actual > threshold;

/**
 * Rules are grouped per metric and ordered from most to least severe, so that
 * only the strongest breach per factor is reported (no DECLINE + REFER duplicates).
 */
export const RULES_BY_METRIC: Record<Metric, Rule[]> = {
  creditScore: [
    {
      code: "CREDIT_SCORE_BELOW_600",
      severity: "DECLINE",
      metric: "creditScore",
      threshold: 600,
      breached: below,
      message: (a, t) => `Credit score of ${a} is below the ${t} minimum.`,
    },
    {
      code: "CREDIT_SCORE_BELOW_680",
      severity: "REFER",
      metric: "creditScore",
      threshold: 680,
      breached: below,
      message: (a, t) => `Credit score of ${a} is below the ${t} referral threshold.`,
    },
  ],
  debtToIncome: [
    {
      code: "DTI_ABOVE_50",
      severity: "DECLINE",
      metric: "debtToIncome",
      threshold: 0.5,
      breached: above,
      message: (a, t) => `Debt-to-income ratio of ${pct(a)} is above the ${pct(t)} maximum.`,
    },
    {
      code: "DTI_ABOVE_40",
      severity: "REFER",
      metric: "debtToIncome",
      threshold: 0.4,
      breached: above,
      message: (a, t) => `Debt-to-income ratio of ${pct(a)} is above the ${pct(t)} referral threshold.`,
    },
  ],
  loanToValue: [
    {
      code: "LTV_ABOVE_90",
      severity: "DECLINE",
      metric: "loanToValue",
      threshold: 0.9,
      breached: above,
      message: (a, t) => `Loan-to-value ratio of ${pct(a)} is above the ${pct(t)} maximum.`,
    },
    {
      code: "LTV_ABOVE_80",
      severity: "REFER",
      metric: "loanToValue",
      threshold: 0.8,
      breached: above,
      message: (a, t) => `Loan-to-value ratio of ${pct(a)} is above the ${pct(t)} referral threshold.`,
    },
  ],
};

/** Max share of the property value that can be approved. */
export const MAX_APPROVED_LTV = 0.8;
