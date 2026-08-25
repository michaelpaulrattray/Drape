/**
 * THE ACCOUNT'S TWENTY CONCURRENT REQUESTS, SHARED OUT ON PURPOSE
 * (fable-511, approved — the sum-invariant shape).
 *
 * # Why this exists
 *
 * The founder's fresh casts came back missing eyes, brows and ears, and the
 * cause was the provider refusing reads it had no room for: `429 {"detail":
 * "Reached concurrent requests limit of 20"}`. The scan was gated the same day
 * (`falConcurrency.ts`). But gating one caller closes one instance of the
 * class, and the class is that **independent paths draw on one account
 * allowance and none of them knows the others exist** — four when this was
 * written, five since the plate mint (see the re-cut below):
 *
 * ```
 * roll images    ROLL_IMAGE_CONCURRENCY    8   paid      a sheet's eight faces
 * sign views     SIGN_VIEW_CONCURRENCY     3   paid      a package's five views
 * refine edits   REFINE_EDIT_CONCURRENCY   3   paid      one paid edit at a time-ish
 * region reads   FAL_CONCURRENCY           5   courtesy  scans, harvests, guards
 * ink plates     INK_PLATE_CONCURRENCY     1   courtesy  a design drawn onto a form
 * ```
 *
 * `signEngine` already reasoned about it in prose — *"one account-level fal
 * concurrency ceiling that the sheet is also drawing on"* — and nothing
 * enforced the arithmetic, so a single bumped variable could put the sum over
 * the ceiling with no error, no test and no symptom until a customer's panel
 * came back empty.
 *
 * # The shape, and why it is a sum rather than one queue
 *
 * A single shared gate would have to answer starvation with a scheduler: paid
 * work must not wait behind a burst of courtesy reads, and courtesy reads must
 * not wait forever behind paid work. **Separate allowances answer it by
 * construction** — every path's slots are its own, so neither can take the
 * other's — and the only thing that needs proving is that the allowances FIT.
 * That is one boot check with visible arithmetic, rather than a scheduler whose
 * fairness is a property nobody can see.
 *
 * It also keeps the money path untouched: roll creation's `TOO_MANY_REQUESTS`
 * refusal is its own admission check and is not affected by any of this.
 *
 * # The invariant
 *
 * `sum(allowances) <= FAL_ACCOUNT_CEILING`, and **every allowance is at least
 * one**: a path with no slots is a feature that cannot run, which is the
 * starvation this shape exists to prevent, arriving by configuration instead of
 * by scheduling.
 *
 * The sum may EQUAL the ceiling. The provider's limit is inclusive — the
 * twenty-first request is the one refused — so twenty in flight is legal and
 * the defaults deliberately spend the whole allowance rather than leaving an
 * unowned remainder that no path may use.
 */

/*
 * # THE FIFTH PATH, AND WHY THE COURTESY POOL PAID FOR IT (2026-08-18)
 *
 * The plate mint is a fal call — one per uploaded design, on the ruled engine
 * (`INK_PLATE_ENGINE`, Nano Banana Pro). The four paths above spent 20 of 20
 * exactly, so a fifth path could not simply be declared: `assertFalBudget()`
 * refuses to boot over the ceiling, which is precisely the check working.
 *
 * The slot came from **region reads, 6 to 5**, and no paid path lost anything.
 * Two reasons, and the second is arithmetic rather than taste:
 *
 * 1. A plate is house money, like a scan. The house's own reads share the
 *    house's own allowance; a customer's paid render should not wait longer
 *    because somebody else attached a tattoo.
 * 2. **It costs the panel nothing at the size it actually runs.** A face scan
 *    is measured at exactly 20 segmenter calls per version, and `ceil(20/6)`
 *    and `ceil(20/5)` are both **four waves**. The cut is free at 20 calls; it
 *    would not have been at 24, and if the scan's call count ever grows that is
 *    the moment to re-cut rather than now.
 *
 * ONE slot rather than two, deliberately: a mint is never on a paid render's
 * critical path, so two simultaneous uploads queueing behind each other is the
 * correct trade against either of them taking a paid slot.
 */

/** The provider's own ceiling, quoted from its 429 and overridable if it moves. */
export function falAccountCeiling(): number {
  const raw = Number(process.env.FAL_ACCOUNT_CEILING ?? "20");
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 20;
}

export type FalAllowance = {
  /** What it is called in the arithmetic when the boot check refuses. */
  readonly name: string;
  /** The variable that sets it. */
  readonly env: string;
  /** What it is when nobody sets it. */
  readonly fallback: number;
  /**
   * `paid` work is a render the customer has been charged for; `courtesy` is a
   * read the product buys on their behalf (scans, guards, harvests). The kind
   * is recorded because the two starve differently and a future scheduler — if
   * one is ever needed — must not have to re-derive it.
   */
  readonly kind: "paid" | "courtesy";
};

/**
 * Every path that spends the account's concurrency, in one place.
 *
 * Adding a fal caller means adding a line here, and the boot check is what
 * makes that unavoidable rather than polite: an unlisted caller is exactly the
 * silent overspend this table exists to stop.
 */
export const FAL_ALLOWANCES: readonly FalAllowance[] = [
  { name: "roll images", env: "ROLL_IMAGE_CONCURRENCY", fallback: 8, kind: "paid" },
  { name: "sign views", env: "SIGN_VIEW_CONCURRENCY", fallback: 3, kind: "paid" },
  { name: "refine edits", env: "REFINE_EDIT_CONCURRENCY", fallback: 3, kind: "paid" },
  { name: "region reads", env: "FAL_CONCURRENCY", fallback: 5, kind: "courtesy" },
  /* The plate mint — see the header's re-cut. Courtesy: the customer is charged
     nothing for it, and it is never on a paid render's critical path. */
  { name: "ink plates", env: "INK_PLATE_CONCURRENCY", fallback: 1, kind: "courtesy" },
];

/** One path's allowance, read the same way by the boot check and by the queue. */
export function falAllowanceOf(env: string): number {
  const entry = FAL_ALLOWANCES.find((allowance) => allowance.env === env);
  if (!entry) throw new Error(`${env} is not a declared fal allowance — add it to FAL_ALLOWANCES`);
  const raw = Number(process.env[env] ?? String(entry.fallback));
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : entry.fallback;
}

export class FalBudgetError extends Error {
  constructor(detail: string) {
    super(`fal concurrency budget: ${detail}`);
    this.name = "FalBudgetError";
  }
}

/**
 * The boot check. Prints the arithmetic either way it goes.
 *
 * Refuses rather than warns, for invariant 7's reason: a budget nobody enforces
 * is a comment. The failure it prevents is a customer's panel coming back empty
 * with no error anywhere.
 */
export function assertFalBudget(): { total: number; ceiling: number; line: string } {
  const ceiling = falAccountCeiling();
  const spent = FAL_ALLOWANCES.map((allowance) => ({
    ...allowance,
    slots: falAllowanceOf(allowance.env),
  }));
  const total = spent.reduce((sum, allowance) => sum + allowance.slots, 0);
  const line = `${spent.map((allowance) => `${allowance.name} ${allowance.slots}`).join(" + ")}`
    + ` = ${total} of ${ceiling}`;

  const starved = spent.filter((allowance) => allowance.slots < 1);
  if (starved.length > 0) {
    throw new FalBudgetError(
      `${starved.map((allowance) => allowance.env).join(", ")} would have no slots at all — `
      + `a path with none is a feature that cannot run (${line})`,
    );
  }
  if (total > ceiling) {
    throw new FalBudgetError(
      `${line} — over the account's ceiling. The provider refuses the requests past it `
      + `("Reached concurrent requests limit"), and a refused read is a feature the customer `
      + `is silently told she does not have.`,
    );
  }
  return { total, ceiling, line };
}
