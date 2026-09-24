# Underwriting Decision API

Deterministic underwriting service built with Node.js + Express using a hexagonal (ports & adapters) architecture. It evaluates a loan application and returns a recommendation (`APPROVE` / `REFER` / `DECLINE`), calculated risk metrics, and structured, human-readable reasons ready to be handed to an LLM explanation layer (mocked here).

## Requirements

- Node.js **>= 22.18** (developed on Node 26). TypeScript runs natively via Node's type stripping, so there is no build step.
- No database, no paid APIs, no external services.

## Run it

```bash
npm install
npm start          # http://localhost:3000  (PORT env var to change)
npm run dev        # same, with auto-restart on file changes
```

```bash
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'
```

```json
{
  "id": "e857c88b-...",
  "decision": "APPROVE",
  "approvedAmount": 280000,
  "metrics": { "debtToIncome": 0.25, "loanToValue": 0.7 },
  "reasons": [],
  "explanation": { "source": "mock-llm", "text": "The application meets all underwriting thresholds..." }
}
```

## curl examples for every case

Start the server in one terminal (`npm start`, keep it running), then run these from a second terminal. If curl prints nothing, the server is not running.

### APPROVE

```bash
# 1. Ideal application → APPROVE, approvedAmount 280000, DTI 0.25, LTV 0.7
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'

# 2. Exact boundaries (score 680, DTI 0.40, LTV 0.80) → APPROVE, rules are strict "below/above"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":4000,"propertyValue":400000,"requestedLoan":320000,"creditScore":680}'
```

### REFER

```bash
# 3. Credit score below 680 → REFER, CREDIT_SCORE_BELOW_680
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":650}'

# 4. DTI above 0.40 (0.45) → REFER, DTI_ABOVE_40
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":4500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'

# 5. LTV above 0.80 (0.85) → REFER, LTV_ABOVE_80
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":340000,"creditScore":720}'

# 6. Every factor at the decline boundary (600, 0.50, 0.90) → REFER with 3 reasons
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":5000,"propertyValue":400000,"requestedLoan":360000,"creditScore":600}'
```

### DECLINE

```bash
# 7. Credit score below 600 → DECLINE, CREDIT_SCORE_BELOW_600
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":550}'

# 8. DTI above 0.50 (0.60) → DECLINE, DTI_ABOVE_50
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":6000,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'

# 9. LTV above 0.90 (0.95) → DECLINE, LTV_ABOVE_90
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":380000,"creditScore":720}'

# 10. Mixed severities → DECLINE with CREDIT_SCORE_BELOW_600 (DECLINE) + DTI_ABOVE_40 (REFER)
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":4500,"propertyValue":400000,"requestedLoan":280000,"creditScore":550}'
```

### 400 — validation and malformed JSON

```bash
# 11. Missing field (creditScore) → "is required"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000}'

# 12. Non-numeric value (numeric string) → "must be a number"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":"120000","monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'

# 13. Zero (would divide by zero) → "must be greater than 0"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":0,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'

# 14. Negative value → "must be greater than 0"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":-1,"creditScore":720}'

# 15. Credit score out of range → "must be between 300 and 850"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":900}'

# 16. Empty object → all 5 fields reported at once
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{}'

# 17. Body is not an object (array) → field "body"
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '[1,2,3]'

# 18. Malformed JSON → MALFORMED_JSON
curl -s -X POST http://localhost:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome": 120000,'
```

## Running tests

Tests use the built-in `node:test` runner — no extra test framework.

| What | Command |
| --- | --- |
| Everything (unit + integration) | `npm test` |
| Only the decision function (no Express, no HTTP) | `npm run test:domain` |
| Only the HTTP endpoint (integration) | `npm run test:http` |
| One file directly | `node --test tests/decide.test.ts` |
| Only approved cases | `node --test --test-name-pattern="APPROVE" "tests/**/*.test.ts"` |
| Only referred cases | `node --test --test-name-pattern="REFER" "tests/**/*.test.ts"` |
| Only declined cases | `node --test --test-name-pattern="DECLINE" "tests/**/*.test.ts"` |
| Only validation cases | `node --test --test-name-pattern="400" "tests/**/*.test.ts"` |
| Watch mode | `npm run test:watch` |
| Type check (optional) | `npm run typecheck` |

Test names start with the decision they cover (`APPROVE when…`, `REFER when…`, `DECLINE when…`), so `--test-name-pattern` filters by case.

`decide()` is a pure function: `tests/decide.test.ts` imports it directly and runs without starting a server. That is what makes the decision logic **independently testable**.

## Business rules

- `debtToIncome = monthlyDebt / (annualIncome / 12)`
- `loanToValue = requestedLoan / propertyValue`
- **DECLINE** if credit score < 600, DTI > 0.50, or LTV > 0.90.
- **REFER** (when not declined) if credit score < 680, DTI > 0.40, or LTV > 0.80.
- **APPROVE** otherwise. `approvedAmount = min(requestedLoan, 80% of propertyValue)`; it is `null` for REFER/DECLINE.
- Comparisons are strict ("below" / "above"), so exact boundaries (600, 680, 0.40, 0.50, 0.80, 0.90) do not trigger a rule.
- Every non-ideal factor produces a reason (`code`, `severity`, `metric`, `threshold`, `actual`, `message`). For each metric only the strongest breach is reported, so you never get both `DTI_ABOVE_50` and `DTI_ABOVE_40`.
- Decisions are based on raw ratios. Metrics are rounded to 4 decimals only in the response.

> Note: since APPROVE requires LTV ≤ 0.80, `min(requestedLoan, 0.8 × propertyValue)` always resolves to `requestedLoan` today. It is still implemented because it is an explicit rule, and it keeps the result correct if thresholds change.

## Validation (HTTP 400)

Each of the 5 fields must be present, a finite JSON number (numeric strings like `"120000"` are rejected, no silent coercion), and greater than 0. `creditScore` must also be an integer between 300 and 850 (a reasonable extra rule, not required by the spec). All invalid fields are reported at once:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": [{ "field": "annualIncome", "issue": "must be greater than 0" }]
}
```

Malformed JSON returns `400 MALFORMED_JSON`. Bodies over 10 KB return `413`. Unknown errors return a generic `500` without stack traces.

## Architecture

```
src/
├─ domain/                 # Pure business rules. Imports nothing.
│  ├─ loanApplication.ts   # Types + DomainError
│  ├─ reasonCodes.ts       # Thresholds, reason codes, messages (the rule table)
│  └─ decide.ts            # decide(app) → DecisionResult
├─ application/            # Use case + ports (interfaces)
│  ├─ ports.ts             # ExplanationPort (LLM), DecisionRepository, Logger
│  └─ evaluateApplication.ts
├─ adapters/
│  ├─ inbound/http/        # Express: validation, routes, error handling
│  └─ outbound/            # MockLlmExplainer, InMemoryDecisionRepository, safeLogger
└─ server.ts               # Composition root: wires adapters into the use case
```

- **Dependencies point inward**: domain ← application ← adapters. Express only exists in `adapters/inbound/http`.
- **LLM-ready**: `ExplanationPort` receives only the `DecisionResult` (codes, metrics, messages), never the applicant's raw input. To use a real LLM, implement the port and swap it in `server.ts`. The domain does not change. If the explainer fails, the deterministic decision is still returned with `explanation: null`.
- **Safe logging**: `safeLogger` only writes allowlisted fields (`requestId`, `decisionId`, `decision`, `durationMs`, `status`, `errorType`). The request body is never logged, and a test checks this.
- **Division by zero**: validation rejects `0` at the boundary, and `decide()` also guards its denominators (`DomainError`), because the domain does not rely on its callers.
- **In-memory storage**: decisions (not applicant input) are kept in a `Map` and lost on restart.

## Frontend integration

See [docs/FRONTEND.md](docs/FRONTEND.md).
