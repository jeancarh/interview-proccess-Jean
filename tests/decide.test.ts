import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/domain/decide.ts";
import { DomainError } from "../src/domain/loanApplication.ts";
import type { LoanApplication } from "../src/domain/loanApplication.ts";

const ideal: LoanApplication = {
  annualIncome: 120000,
  monthlyDebt: 2500,
  propertyValue: 400000,
  requestedLoan: 280000,
  creditScore: 720,
};

const codes = (app: LoanApplication) => decide(app).reasons.map((r) => r.code);

describe("decide", () => {
  describe("APPROVE", () => {
    it("APPROVE when every factor is within ideal thresholds", () => {
      const result = decide(ideal);
      assert.equal(result.decision, "APPROVE");
      assert.equal(result.approvedAmount, 280000);
      assert.deepEqual(result.metrics, { debtToIncome: 0.25, loanToValue: 0.7 });
      assert.deepEqual(result.reasons, []);
    });

    it("APPROVE at exact boundaries (strict below/above comparisons)", () => {
      // creditScore 680, DTI exactly 0.40, LTV exactly 0.80
      const result = decide({
        annualIncome: 120000,
        monthlyDebt: 4000,
        propertyValue: 400000,
        requestedLoan: 320000,
        creditScore: 680,
      });
      assert.equal(result.decision, "APPROVE");
      assert.equal(result.approvedAmount, 320000);
      assert.deepEqual(result.reasons, []);
    });
  });

  describe("REFER", () => {
    it("REFER when credit score is below 680", () => {
      const result = decide({ ...ideal, creditScore: 650 });
      assert.equal(result.decision, "REFER");
      assert.equal(result.approvedAmount, null);
      assert.deepEqual(codes({ ...ideal, creditScore: 650 }), ["CREDIT_SCORE_BELOW_680"]);
    });

    it("REFER when debt-to-income is above 0.40", () => {
      const app = { ...ideal, monthlyDebt: 4500 }; // DTI 0.45
      assert.equal(decide(app).decision, "REFER");
      assert.deepEqual(codes(app), ["DTI_ABOVE_40"]);
    });

    it("REFER when loan-to-value is above 0.80", () => {
      const app = { ...ideal, requestedLoan: 340000 }; // LTV 0.85
      assert.equal(decide(app).decision, "REFER");
      assert.deepEqual(codes(app), ["LTV_ABOVE_80"]);
    });

    it("REFER at exact decline boundaries (600, 0.50, 0.90)", () => {
      const app = {
        annualIncome: 120000,
        monthlyDebt: 5000,
        propertyValue: 400000,
        requestedLoan: 360000,
        creditScore: 600,
      };
      assert.equal(decide(app).decision, "REFER");
      assert.deepEqual(codes(app), ["CREDIT_SCORE_BELOW_680", "DTI_ABOVE_40", "LTV_ABOVE_80"]);
    });
  });

  describe("DECLINE", () => {
    it("DECLINE when credit score is below 600", () => {
      const result = decide({ ...ideal, creditScore: 550 });
      assert.equal(result.decision, "DECLINE");
      assert.equal(result.approvedAmount, null);
      assert.deepEqual(result.reasons.map((r) => r.code), ["CREDIT_SCORE_BELOW_600"]);
      assert.equal(result.reasons[0]?.severity, "DECLINE");
    });

    it("DECLINE when debt-to-income is above 0.50", () => {
      const app = { ...ideal, monthlyDebt: 6000 }; // DTI 0.60
      assert.equal(decide(app).decision, "DECLINE");
      assert.deepEqual(codes(app), ["DTI_ABOVE_50"]);
    });

    it("DECLINE when loan-to-value is above 0.90", () => {
      const app = { ...ideal, requestedLoan: 380000 }; // LTV 0.95
      assert.equal(decide(app).decision, "DECLINE");
      assert.deepEqual(codes(app), ["LTV_ABOVE_90"]);
    });

    it("DECLINE reports every non-ideal factor, mixing severities", () => {
      const app = { ...ideal, creditScore: 550, monthlyDebt: 4500 }; // DTI 0.45
      const result = decide(app);
      assert.equal(result.decision, "DECLINE");
      assert.deepEqual(
        result.reasons.map((r) => [r.code, r.severity]),
        [
          ["CREDIT_SCORE_BELOW_600", "DECLINE"],
          ["DTI_ABOVE_40", "REFER"],
        ],
      );
    });
  });

  describe("reasons", () => {
    it("include metric, threshold, actual value and a human-readable message", () => {
      const [reason] = decide({ ...ideal, monthlyDebt: 4500 }).reasons;
      assert.deepEqual(reason, {
        code: "DTI_ABOVE_40",
        severity: "REFER",
        metric: "debtToIncome",
        threshold: 0.4,
        actual: 0.45,
        message: "Debt-to-income ratio of 45% is above the 40% referral threshold.",
      });
    });
  });

  describe("safety", () => {
    it("rounds metrics to 4 decimals", () => {
      const result = decide({ ...ideal, monthlyDebt: 1000, annualIncome: 36000 }); // 1/3
      assert.equal(result.metrics.debtToIncome, 0.3333);
    });

    it("throws DomainError instead of dividing by zero", () => {
      assert.throws(() => decide({ ...ideal, annualIncome: 0 }), DomainError);
      assert.throws(() => decide({ ...ideal, propertyValue: 0 }), DomainError);
    });

    it("is pure: same input, same output, input not mutated", () => {
      const input = { ...ideal };
      assert.deepEqual(decide(input), decide(input));
      assert.deepEqual(input, ideal);
    });
  });
});
