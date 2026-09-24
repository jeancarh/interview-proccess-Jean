import type { LoanApplication } from "../../../domain/loanApplication.ts";

export type FieldError = { field: string; issue: string };

export type ValidationResult = { ok: true; value: LoanApplication } | { ok: false; errors: FieldError[] };

const FIELDS = ["annualIncome", "monthlyDebt", "propertyValue", "requestedLoan", "creditScore"] as const;

const CREDIT_SCORE_MIN = 300;
const CREDIT_SCORE_MAX = 850;

const fieldIssue = (field: (typeof FIELDS)[number], value: unknown): string | null => {
  if (value === undefined) return "is required";
  // Strict: "120000" is rejected on purpose, silent coercion hides client bugs.
  if (typeof value !== "number" || !Number.isFinite(value)) return "must be a number";
  if (value <= 0) return "must be greater than 0";
  if (field === "creditScore") {
    if (!Number.isInteger(value)) return "must be an integer";
    if (value < CREDIT_SCORE_MIN || value > CREDIT_SCORE_MAX) {
      return `must be between ${CREDIT_SCORE_MIN} and ${CREDIT_SCORE_MAX}`;
    }
  }
  return null;
};

/** HTTP-boundary validation: turns untrusted JSON into a typed domain input. */
export function validateRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", issue: "must be a JSON object" }] };
  }

  const input = body as Record<string, unknown>;
  const errors: FieldError[] = [];
  for (const field of FIELDS) {
    const issue = fieldIssue(field, input[field]);
    if (issue) errors.push({ field, issue });
  }
  if (errors.length > 0) return { ok: false, errors };

  // Copy only known fields; extra properties are ignored.
  const value = Object.fromEntries(FIELDS.map((f) => [f, input[f]])) as LoanApplication;
  return { ok: true, value };
}
