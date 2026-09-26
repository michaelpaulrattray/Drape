/**
 * The bug-report vocabulary, shared client and server (#255).
 *
 * These live here rather than beside the db helpers for the reason
 * `castingVocabularies.ts` states about its own lists: **a hand-copied second
 * list is a control that lies.** FOUR places name these values — the
 * `bug_reports.status` / `.category` columns, the admin procedure that
 * validates a status change, the inbox page that labels and filters them, and
 * **the submit procedure a customer's report actually goes through** — and a
 * value added on one side must be a value all four have.
 *
 * ⚠ **The fourth was missing from this sentence until #1424, and it was the one
 * that had drifted.** This list said three, `server/routes/bugReports.ts` held
 * its own inline enum of SIX against the column's seven, and the value it had
 * dropped was `wardrobe` — so the single consumer that decides what a customer
 * may SEND was the single consumer this file did not know about. A list of
 * consumers that is short by one is how the drift it exists to prevent happens
 * anyway: nobody re-checks a place the source of truth never claimed.
 *
 * ⚠ **And there is a second, sharper reason it is HERE and not in `server/db`.**
 * The first shape of this imported the two lists into the admin router from the
 * db barrel at module-evaluation time, and `server/credits.test.ts` mocks that
 * barrel — so the constants came back `undefined`, `z.enum(undefined)` threw
 * while the module was still loading, and a suite with nothing to do with bug
 * reports failed to load at all. Every other admin router reaches the database
 * only inside `await import(...)`, which is exactly why none of them can be
 * broken this way. **A router must not need the mockable db barrel to
 * EVALUATE.** A leaf module in `shared/` has no such edge and cannot grow one.
 *
 * `drizzle/schema.ts` still declares the columns — it is the source of truth for
 * what the database accepts — and `server/bugReportInbox.test.ts` asserts these
 * lists against the column's own enum, so the two cannot drift silently.
 */

/** The workflow the `status` column has always declared and nothing could drive. */
export const BUG_REPORT_STATUSES = ["new", "reviewing", "resolved", "dismissed"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_CATEGORIES = [
  "casting",
  "wardrobe",
  "export",
  "billing",
  "ui",
  "other",
  "feedback",
] as const;
export type BugReportCategory = (typeof BUG_REPORT_CATEGORIES)[number];

/**
 * What a human calls each one. Kept beside the values rather than in the page,
 * so a new category cannot arrive with no label — the page reads this and has
 * no list of its own.
 */
export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const BUG_REPORT_CATEGORY_LABELS: Record<BugReportCategory, string> = {
  casting: "Casting",
  wardrobe: "Wardrobe",
  export: "Export",
  billing: "Billing",
  ui: "Interface",
  other: "Other",
  feedback: "Feedback",
};
