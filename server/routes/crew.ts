/**
 * THE CREW ROUTER — the night shifts' briefing, and the founder's reply box
 * (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §4).
 *
 * Two procedures, both `adminProcedure`, both consulting `CREW_TAB_SCOPE` per
 * call. There is no public surface here and no rate-limit exemption question:
 * the whole namespace sits behind the strongest gate the product has, and the
 * flag narrows it further while the page is dark.
 *
 * # A TOP-LEVEL NAMESPACE, NOT PART OF THE ADMIN FLAT-MERGE
 *
 * `adminRouter` spreads its sub-routers' procedures into one flat namespace,
 * which is a compatibility shape for legacy client calls rather than a pattern
 * worth joining. A new surface with no legacy callers gets its own namespace,
 * so `crew.getState` is reachable by that name and nothing about it depends on
 * the admin router's merge order.
 *
 * # NOT_FOUND OUTSIDE THE SCOPE, AND NEVER A "NOT YET"
 *
 * The ink precedent, for the reason it was chosen there: a code that says *not
 * yet* advertises a capability. Outside the flag there is no such thing as a
 * Crew tab, and the client's nav renders on this query SUCCEEDING — so the
 * refusal is also what keeps the tab out of the header.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../_core/trpc";
import { readCrewBriefing } from "../crew/crewBriefing";
import { captureCrewTabEnabled } from "../crew/crewTabScope";
import { insertCrewReply, listCrewReplies } from "../db/crewReplies";

/** The dark answer, written once so both procedures give the same one. */
function refuseOutsideScope(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
}

/**
 * A reply's wire shape.
 *
 * `.strict()` (invariant 4), and note what is ABSENT: there is no
 * `authorUserId` and no `author`. That is invariant 3 enforced by construction
 * rather than by a check — a forged author field is refused by the parser
 * before any handler runs, and the only id that can reach the insert is the
 * session's.
 *
 * `cardId` is bounded at 64 and validated for NOTHING ELSE. It is deliberately
 * not checked against the current briefing: the briefing rotates, and a card he
 * answers tonight may be closed by tomorrow's edition. Refusing his words
 * because a card moved is the one thing this surface must never do — such a
 * reply renders in the journal thread instead.
 */
const replyInput = z.object({
  cardId: z.string().max(64).nullable(),
  body: z.string().trim().min(1).max(4000),
}).strict();

export const crewRouter = router({
  /**
   * The whole page in one call: the deployed briefing plus every reply.
   *
   * The reply projection is explicit at the database (invariant 8,
   * `server/db/crewReplies.ts`) and this procedure adds nothing to it — what
   * comes back is exactly `{ id, cardId, body, createdAt, author }` per reply,
   * because that is what the store hands over and this handler does not spread
   * a row.
   */
  getState: adminProcedure.query(async ({ ctx }) => {
    if (!captureCrewTabEnabled(ctx.user.id)) refuseOutsideScope();

    /* The briefing never throws — a malformed edition degrades and says so in
       its own `problems` list, which is why this is not in a try. */
    const briefing = readCrewBriefing();
    const replies = await listCrewReplies();

    return { briefing, replies };
  }),

  /**
   * Write one reply.
   *
   * `authorUserId` comes from `ctx.user.id` and could not come from anywhere
   * else: the schema above does not declare the field and is strict. Returns
   * the inserted reply in the same projection the list uses, so the page can
   * append it without a refetch and without inventing a shape.
   */
  reply: adminProcedure
    .input(replyInput)
    .mutation(async ({ ctx, input }) => {
      if (!captureCrewTabEnabled(ctx.user.id)) refuseOutsideScope();

      return insertCrewReply({
        cardId: input.cardId,
        body: input.body,
        /* From the session, never from input (invariant 3). */
        authorUserId: ctx.user.id,
      });
    }),
});
