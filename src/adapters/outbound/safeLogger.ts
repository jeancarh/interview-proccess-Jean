import type { LogEvent, Logger } from "../../application/ports.ts";

const ALLOWED_FIELDS = ["event", "requestId", "decisionId", "decision", "durationMs", "errorType", "status"] as const;

/** Drops anything not explicitly allowlisted, so applicant data can never reach the logs by accident. */
const sanitize = (event: LogEvent) => {
  const safe: Record<string, unknown> = { ts: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (event[field] !== undefined) safe[field] = event[field];
  }
  return JSON.stringify(safe);
};

export const safeLogger: Logger = {
  info: (event) => console.log(sanitize(event)),
  error: (event) => console.error(sanitize(event)),
};
