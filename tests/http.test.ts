import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/adapters/inbound/http/app.ts";
import { makeEvaluateApplication } from "../src/application/evaluateApplication.ts";
import { InMemoryDecisionRepository } from "../src/adapters/outbound/inMemoryDecisionRepository.ts";
import { MockLlmExplainer } from "../src/adapters/outbound/mockLlmExplainer.ts";
import type { ExplanationPort, LogEvent, Logger } from "../src/application/ports.ts";

const valid = {
  annualIncome: 120000,
  monthlyDebt: 2500,
  propertyValue: 400000,
  requestedLoan: 280000,
  creditScore: 720,
};

const logged: LogEvent[] = [];
const spyLogger: Logger = { info: (e) => logged.push(e), error: (e) => logged.push(e) };

const startServer = async (explainer: ExplanationPort = new MockLlmExplainer()) => {
  const evaluate = makeEvaluateApplication({
    repository: new InMemoryDecisionRepository(),
    explainer,
    logger: spyLogger,
  });
  const server = createApp({ evaluate, logger: spyLogger }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/api/underwriting/decision` };
};

let server: Server;
let url: string;

const post = (body: unknown, raw = false) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });

before(async () => ({ server, url } = await startServer()));
after(() => server.close());

describe("POST /api/underwriting/decision", () => {
  describe("200 decisions", () => {
    it("APPROVE returns approvedAmount, metrics, empty reasons and an explanation", async () => {
      const res = await post(valid);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.decision, "APPROVE");
      assert.equal(body.approvedAmount, 280000);
      assert.deepEqual(body.metrics, { debtToIncome: 0.25, loanToValue: 0.7 });
      assert.deepEqual(body.reasons, []);
      assert.equal(body.explanation.source, "mock-llm");
      assert.equal(typeof body.id, "string");
    });

    it("REFER returns null approvedAmount and reason codes", async () => {
      const body = await (await post({ ...valid, creditScore: 650 })).json();
      assert.equal(body.decision, "REFER");
      assert.equal(body.approvedAmount, null);
      assert.deepEqual(body.reasons.map((r: { code: string }) => r.code), ["CREDIT_SCORE_BELOW_680"]);
    });

    it("DECLINE returns null approvedAmount and reason codes", async () => {
      const body = await (await post({ ...valid, creditScore: 550 })).json();
      assert.equal(body.decision, "DECLINE");
      assert.equal(body.approvedAmount, null);
      assert.deepEqual(body.reasons.map((r: { code: string }) => r.code), ["CREDIT_SCORE_BELOW_600"]);
    });

    it("still returns the decision when the explanation layer fails", async () => {
      const failing = await startServer({ explain: () => Promise.reject(new Error("llm down")) });
      try {
        const res = await fetch(failing.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(valid),
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.decision, "APPROVE");
        assert.equal(body.explanation, null);
      } finally {
        failing.server.close();
      }
    });
  });

  describe("400 validation", () => {
    const expectFieldError = async (body: unknown, field: string, issue: RegExp) => {
      const res = await post(body);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "VALIDATION_ERROR");
      const detail = json.details.find((d: { field: string }) => d.field === field);
      assert.ok(detail, `expected a validation detail for ${field}`);
      assert.match(detail.issue, issue);
    };

    it("rejects a missing field", async () => {
      const { creditScore: _omit, ...rest } = valid;
      await expectFieldError(rest, "creditScore", /required/);
    });

    it("rejects a non-numeric value (numeric strings included)", async () => {
      await expectFieldError({ ...valid, annualIncome: "120000" }, "annualIncome", /must be a number/);
    });

    it("rejects null", async () => {
      await expectFieldError({ ...valid, monthlyDebt: null }, "monthlyDebt", /must be a number/);
    });

    it("rejects zero (prevents division by zero)", async () => {
      await expectFieldError({ ...valid, annualIncome: 0 }, "annualIncome", /greater than 0/);
      await expectFieldError({ ...valid, propertyValue: 0 }, "propertyValue", /greater than 0/);
    });

    it("rejects negative values", async () => {
      await expectFieldError({ ...valid, requestedLoan: -1 }, "requestedLoan", /greater than 0/);
    });

    it("rejects a credit score outside 300-850 or non-integer", async () => {
      await expectFieldError({ ...valid, creditScore: 900 }, "creditScore", /between 300 and 850/);
      await expectFieldError({ ...valid, creditScore: 700.5 }, "creditScore", /integer/);
    });

    it("reports every invalid field at once", async () => {
      const res = await post({});
      const json = await res.json();
      assert.equal(res.status, 400);
      assert.equal(json.details.length, 5);
    });

    it("rejects a body that is not a JSON object", async () => {
      const res = await post([valid]);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, "VALIDATION_ERROR");
    });

    it("rejects malformed JSON safely", async () => {
      const res = await post('{"annualIncome": 120000,', true);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "MALFORMED_JSON");
      assert.equal(json.stack, undefined);
    });
  });

  describe("logging", () => {
    it("never logs applicant data", async () => {
      logged.length = 0;
      await post({ ...valid, annualIncome: 987654 });
      await post({ ...valid, annualIncome: -987654 });
      const dump = JSON.stringify(logged);
      assert.ok(logged.length > 0);
      assert.ok(!dump.includes("987654"), "applicant values leaked into logs");
      assert.ok(!dump.includes("annualIncome"), "applicant field names leaked into logs");
    });
  });
});
