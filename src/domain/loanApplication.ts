export type LoanApplication = {
  annualIncome: number;
  monthlyDebt: number;
  propertyValue: number;
  requestedLoan: number;
  creditScore: number;
};

export type Decision = "APPROVE" | "REFER" | "DECLINE";

export type Severity = Exclude<Decision, "APPROVE">;

export type Metric = "creditScore" | "debtToIncome" | "loanToValue";

export type ReasonCode =
  | "CREDIT_SCORE_BELOW_600"
  | "CREDIT_SCORE_BELOW_680"
  | "DTI_ABOVE_50"
  | "DTI_ABOVE_40"
  | "LTV_ABOVE_90"
  | "LTV_ABOVE_80";

export type Reason = {
  code: ReasonCode;
  severity: Severity;
  metric: Metric;
  threshold: number;
  actual: number;
  message: string;
};

export type Metrics = {
  debtToIncome: number;
  loanToValue: number;
};

export type DecisionResult = {
  decision: Decision;
  approvedAmount: number | null;
  metrics: Metrics;
  reasons: Reason[];
};

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
