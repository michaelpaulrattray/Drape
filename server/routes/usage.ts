import { protectedProcedure, router } from "../_core/trpc";
import { getCycleSpend } from "../db";

export const usageRouter = router({
  /**
   * WHAT THIS ACCOUNT HAS SPENT THIS BILLING CYCLE — #624, his approved
   * option (a): *"(a), fix it, not urgent."*
   *
   * The three surfaces that quote a cycle's spend (the Usage pane, Change plan
   * and Add credits) used to reassemble it out of `getDailyUsage`, which
   * answered in whole UTC days and capped at 90 of them. (`getDailyUsage` and
   * `getStats` were DELETED with #635 — after #624 nothing called either, and
   * no design in `docs/specs/` asks for the per-day chart the first was built
   * for. A chart that wants day buckets is a new procedure with its own card,
   * never a reason to sum buckets for a cycle again. `getHistory`, the
   * paginated transaction reader born beside them, followed with #833: its one
   * caller left in the same Section 03 commit, and a customer's own
   * transactions already reach her through the data export. A transaction
   * list that a design asks for is a new procedure under its own card.) A
   * real billing period
   * begins at a mid-day INSTANT, so the reassembly counted up to a day of the
   * previous cycle — and on an annual plan it could not cover the period at
   * all. This answers the question they are actually asking.
   *
   * ⚠ **IT TAKES NO INPUT, AND THAT IS THE CONTROL.** The window is the
   * account's own `currentPeriodStart` read on the server; a client-supplied
   * boundary on a surface that recommends a plan is a number the customer's
   * browser gets to choose. Enforcement invariant 3 — the user comes from
   * `ctx.user.id` — and there is nothing else to send.
   */
  getCycleSpend: protectedProcedure.query(async ({ ctx }) => {
    return getCycleSpend(ctx.user.id);
  }),
});
