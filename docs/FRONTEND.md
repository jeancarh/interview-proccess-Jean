# Frontend Integration (React / Angular)

A production UI is out of scope. This note describes how a client would consume `POST /api/underwriting/decision`.

## Data flow

1. **Form**: five numeric inputs. Client-side validation mirrors the server rules (required, > 0, credit score 300–850) for fast feedback. The **server remains the source of truth**.
2. **API layer**: one function or service owns the HTTP call and the response types. Components never call `fetch` directly.
3. **State**: `idle → loading → success | validationError | error`.
4. **View**: renders the decision and never re-computes business rules.

## React (container / presentational)

```ts
// api/underwriting.ts
export async function requestDecision(input: LoanApplication): Promise<DecisionResponse> {
  const res = await fetch("/api/underwriting/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (res.status === 400) throw new ValidationError(body.details); // [{ field, issue }]
  if (!res.ok) throw new Error(body.message);
  return body;
}
```

- `useUnderwritingDecision()` hook (or TanStack Query `useMutation`) is the **container**: it holds `loading/error/data`.
- `<DecisionCard result={data} />` is **presentational**: it only receives props.

## Angular

- `UnderwritingService` uses `HttpClient.post<DecisionResponse>()`.
- The component uses a Reactive Form. A `catchError` maps a `400` into `form.get(field).setErrors({ server: issue })`.
- The result is exposed as a signal (or `async` pipe) to a presentational `DecisionCardComponent`.

## Displaying the decision

| Field | UI |
| --- | --- |
| `decision` | Badge: APPROVE green, REFER amber ("Manual review"), DECLINE red |
| `approvedAmount` | Formatted with `Intl.NumberFormat` currency. Hidden when `null` |
| `metrics` | Shown as percentages (`0.25` → `25%`), optionally with a bar and the threshold markers (40/50%, 80/90%) |
| `reasons[]` | List grouped by `severity`, using `message`. `code` is stable, so it can be used for i18n keys, icons or analytics |
| `explanation.text` | "Why this decision?" panel. Today it comes from the mock, later from a real LLM, with no UI change. Hidden when `explanation` is `null` |
| `details[]` (400) | Mapped to inline errors on the matching form field |

## Other concerns

- Accessibility: announce the decision in an `aria-live` region. Never rely on color alone, so always show the label text.
- Disable submit while loading to avoid duplicate requests.
- In development, proxy `/api` to `http://localhost:3000` (Vite `server.proxy` / Angular `proxy.conf.json`) to avoid CORS.
- Do not store applicant financial data in `localStorage` or send it to analytics.
