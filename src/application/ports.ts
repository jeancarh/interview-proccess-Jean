import type { DecisionResult } from "../domain/loanApplication.ts";

/** LLM-ready explanation layer. Receives only the decision result, never raw applicant data. */
export type Explanation = {
  source: string;
  text: string;
};

export interface ExplanationPort {
  explain(result: DecisionResult): Promise<Explanation>;
}

export type DecisionRecord = DecisionResult & {
  id: string;
  evaluatedAt: string;
};

export interface DecisionRepository {
  save(result: DecisionResult): Promise<DecisionRecord>;
}

/** Only non-sensitive, allowlisted fields may be logged. */
export type LogEvent = {
  event: string;
  requestId?: string;
  decisionId?: string;
  decision?: string;
  durationMs?: number;
  errorType?: string;
  status?: number;
};

export interface Logger {
  info(event: LogEvent): void;
  error(event: LogEvent): void;
}
