import { randomUUID } from "node:crypto";
import type { DecisionResult } from "../../domain/loanApplication.ts";
import type { DecisionRecord, DecisionRepository } from "../../application/ports.ts";

/** Stores only the decision outcome, never the applicant's raw input. */
export class InMemoryDecisionRepository implements DecisionRepository {
  readonly #records = new Map<string, DecisionRecord>();

  async save(result: DecisionResult): Promise<DecisionRecord> {
    const record: DecisionRecord = { id: randomUUID(), evaluatedAt: new Date().toISOString(), ...result };
    this.#records.set(record.id, record);
    return record;
  }

  get size() {
    return this.#records.size;
  }
}
