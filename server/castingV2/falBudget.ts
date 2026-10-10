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
 * written, five while the plate mint lived, and four again since it retired
 * (see the re-cut below, kept as origin):
 *
 * ```
 * roll images    ROLL_IMAGE_CONCURRENCY    8   paid      a sheet's eight faces
 * sign views     SIGN_VIEW_CONCURRENCY     3   paid      a package's five views
 * refine edits   REFINE_EDIT_CONCURRENCY   3   paid      one paid edit at a time-ish
 * region reads   FAL_CONCURRENCY           6   courtesy  scans, harvests, guards
 * ```
 *
 * ⚠ **20 OF 20 AGAIN SINCE #2206 (2026-10-10) — THE UNOWNED SLOT IS CLOSED BY
 * HIS WORD.** Region reads go back from 5 to 6. His answer, verbatim (terminal,
 * 2026-10-10): *"yes to turn the sp[eed up."* — to the question whether the
 * slot the plate mint's retirement left unowned should go back to face scans.
 * The measurement it rests on is #2189 (PR #2204): the real scan code driven
 * against a fake network, nothing spent — for 21–27-read scans the pool at 5
 * added a median **5.9 s** with a warm cutout and **6.7 s** with a cold one
 * (range −1 to +14 s), and the peak in-flight count read exactly 5 and 6, so the
 * setting really reached the queue. That is the "its own card with its own
 * measurement" the paragraphs below asked for, and they are kept as the record
 * of why the slot stood empty for sixteen days.
 *
 * ⚠ **THE PLATE MINT'S ROW IS GONE — #1158 slice 4d, 2026-09-24.** His ruling
 * on card `switch-10-ink-studio` — *"It retires with N2"* — retired the ink
 * studio, and `inkPlateEngine.ts`, the only caller of
 * `falAllowanceOf("INK_PLATE_CONCURRENCY")`, went with it in slice 2. The row
 * outlived its caller by two slices on purpose and is now removed: the sum
 * WAS **19 of 20** (until #2206 handed the slot back — see the table above).
 *
 * ⚠ **AND THE REASON IT WAITED WAS WRONG — READ THIS BEFORE REPEATING IT.**
 * Slice 2's docblock, this file's own paragraph, the census § 8 and the card
 * all said the row had to stay because *"the variable is SET on the service"*
 * and a declaration leaving this array while its value stayed in the
 * environment would change what the boot gate computes. **It was never set.**
 * Read at the running service on 2026-09-24 by two independent readers — the
 * rite's own `railway variables --service Drape --kv` parse and a JSON
 * key-presence read — with a positive control (`CASTING_V2_SCOPE` present) and
 * a negative one (a name that cannot exist): **not one of the five allowance
 * variables is set on production.** All five run on the fallbacks declared
 * below, which is why the live boot line reads `ink plates 1` — that 1 was the
 * FALLBACK, not a value anybody had configured. So there was no production act
 * in this slice and there never was one; the caution was real, the premise
 * under it was not. **A number in a log agrees with "set to 1" and with "unset,
 * defaulting to 1" equally, and only one of those two was ever checked.**
 *
 * ⚠ **THE FREED SLOT WAS NOT GIVEN BACK TO THE COURTESY POOL — UNTIL HIS WORD
 * ON #2206, which is the separate card this paragraph asked for.** Region reads
 * went 6 → 5 to pay for the plate mint (see the re-cut below); handing the 1
 * back would raise a live path's concurrency, which is a capability change
 * wearing a cleanup's clothes — his own rule from the switch sitting: *"Folding
 * a new capability into a retirement is how a half-built feature ships under a
 * cleanup's name."* If the pool should grow, that is its own card. **So the
 * account kept one slot no path could spend, deliberately, from 2026-09-24 to
 * 2026-10-10** — see the invariant below.
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
 * twenty-first request is the one refused — so twenty in flight is legal.
 *
 * ⚠ **THE DEFAULTS SPEND THE WHOLE ALLOWANCE AGAIN — 20 of 20 since #2206
 * (2026-10-10), by his word.** The history, kept because the gap was a ruling
 * and so was its closing: from #1158 slice 4d the defaults stood at **19 of
 * 20**, and that was a RULING rather than an oversight. This
 * sentence used to end *"the defaults deliberately spend the whole allowance
 * rather than leaving an unowned remainder that no path may use"*, which was
 * true of every reading until the plate mint retired. The remainder now exists
 * because the only way to close it is to raise a live path's concurrency, and
 * his rule forbids doing that inside a retirement. **A later reader who finds
 * the gap and "fixes" it by bumping `FAL_CONCURRENCY` back to 6 is making a
 * capability change, not tidying arithmetic** — `falBudget.test.ts` pins the
 * 5 by name so that edit cannot land quietly, and growing the pool is its own
 * card with its own measurement. **#2206 is that card**: `falBudget.test.ts` now
 * pins the 6 by name, and still refuses a sum over the ceiling.
 */

/*
 * # THE FIFTH PATH, AND WHY THE COURTESY POOL PAID FOR IT (2026-08-18)
 *
 * ⚠ **KEPT AS ORIGIN — THE FIFTH PATH RETIRED 2026-09-24 (#1158 slice 4d) AND
 * ITS ROW IS NO LONGER IN THE TABLE BELOW.** This section is why region reads
 * stand at 5 rather than 6, which is the one fact about it that still governs
 * live behaviour — or was, until #2206 put region reads back to 6; everything
 * else here is the history of a road that is gone.
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
 *    was then counted at 20 segmenter calls per version, and `ceil(20/6)` and
 *    `ceil(20/5)` are both **four waves**. The cut is free at 20 calls; it
 *    would not have been at 24, and if the scan's call count ever grows that is
 *    the moment to re-cut rather than now.
 *
 *    ⚠ **THE COUNT GREW — OR RATHER, 20 WAS NEVER IT (#2184, #2187).** It was
 *    taken with a fake reader that answered everything first time. Real faces
 *    ask again: `FACE_SCAN_FAL_CALLS` in `scripts/lib/falSpend.mts` holds the
 *    measured 21–27 SAM 3 reads (#2183, eight production casts) inside a
 *    wire-derived 19–40. On the same waves arithmetic that is 4–5 waves at 6
 *    and 5–6 at 5, so **the cut now costs most real scans one wave**, which is
 *    the case the sentence above said to re-cut at. It is NOT re-cut here: the
 *    slot this paid for is the unowned one above, and handing it back to region
 *    reads is growing a live pool — a capability change with its own card and
 *    its own measurement, never a comment fix. **That card is #2206
 *    (2026-10-10)**: the pool is 6 again by his word, so most real scans get
 *    their wave back.
 *
 * ONE slot rather than two, deliberately: a mint is never on a paid render's
 * critical path, so two simultaneous uploads queueing behind each other is the
 * correct trade against either of them taking a paid slot.
 */

/**
 * The variable that overrides the ceiling, as a NAME rather than a literal
 * inside the reader.
 *
 * ⚠ It is exported because the deploy rite's push gate governs the settings this
 * module reads at boot (#1174) and derives that population from here — a name
 * typed twice is the second list working law 4 is about, and the consequence is
 * specific: a governed setting the gate cannot see. `CASTING_ROLL_ENGINE_MODEL`
 * was exactly that, set to `sunburst` on production and invisible to the gate.
 */
export const FAL_ACCOUNT_CEILING_ENV = "FAL_ACCOUNT_CEILING";

/** The provider's own ceiling, quoted from its 429 and overridable if it moves. */
export function falAccountCeiling(): number {
  const raw = Number(process.env[FAL_ACCOUNT_CEILING_ENV] ?? "20");
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
  /* ⚠ The 6 is his word, not tidying (#2206, 2026-10-10: "yes to turn the
     sp[eed up."). It was 6, then 5 while the plate mint held one slot, stayed 5
     after the mint retired (#1158 slice 4d deliberately did not hand it back),
     and went back to 6 on its own card with its own measurement (#2189: ~6 s
     off a typical face scan). With it the four paths sum to 20 of 20 — the
     ceiling exactly, which the provider's inclusive limit allows. Any further
     growth here needs a slot taken from somewhere else, and the boot check
     refuses one that is not. */
  { name: "region reads", env: "FAL_CONCURRENCY", fallback: 6, kind: "courtesy" },
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
