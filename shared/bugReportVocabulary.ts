/**
 * The bug-report vocabulary, shared client and server (#255).
 *
 * These live here rather than beside the db helpers for the reason
 * `castingVocabularies.ts` states about its own lists: **a hand-copied second
 * list is a control that lies.** Three places name these values — the
 * `bug_reports.status` / `.category` columns, the admin procedure that
 * validates a status change, and the inbox page that labels and filters them —
 * and a value added on one side must be a value all three have.
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
