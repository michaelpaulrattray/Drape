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
import { readCrewCardIntents, setCrewCardIntent } from "../db/crewCardIntents";
import { insertCrewReply, listCrewReplies } from "../db/crewReplies";
import { listCrewShiftRuns } from "../db/crewShiftRuns";
import { readCrewWorkState, setCrewWorkSwitch } from "../db/crewWorkSwitches";
import { CREW_CARD_INTENT_KEYS } from "../../shared/crewCardIntents";
import { CREW_WORK_SWITCH_KEYS } from "../../shared/crewWorkSwitches";

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
 * reply renders in the General box instead.
 */
const replyInput = z.object({
  /* `min(1)` because the empty string is neither a card id nor a general note
     (that is what null is for) — a shape nobody sends refuses (invariant 4's
     spirit; PR #72 re-review). */
  cardId: z.string().min(1).max(64).nullable(),
  body: z.string().trim().min(1).max(4000),
}).strict();

/**
 * A switch flip's wire shape.
 *
 * `.strict()` (invariant 4), and note what is ABSENT: there is no
 * `changedByUserId`. Invariant 3 by construction — a forged author is refused
 * by the parser before any handler runs, and the only id that can reach the
 * write is the session's.
 *
 * `switchKey` is an ENUM over the shared vocabulary rather than a bounded
 * string, because unlike `crew_replies`' `cardId` there is no rotation to
 * tolerate here: the keys are a closed set the code owns, and a key nobody
 * reads would be a switch he can flip that changes nothing — a dead control
 * wearing a working one's clothes.
 */
const workSwitchInput = z.object({
  switchKey: z.enum(CREW_WORK_SWITCH_KEYS),
  enabled: z.boolean(),
}).strict();

/**
 * A "not relevant" tap's wire shape (#325).
 *
 * `.strict()` (invariant 4), and note what is ABSENT: there is no
 * `markedByUserId`, and there is **no `resolution`**. The first is invariant 3
 * by construction, as on the two schemas above. The second is the boundary this
 * whole feature rests on — `resolution` is the SHIFTS' column, written only by
 * `scripts/crew-card-intents.mts`, and a field that is not declared cannot be
 * sent. If the page could answer its own tap, the second pair of eyes his card
 * asks for would be the same pair.
 *
 * `intent` is an ENUM over the shared vocabulary for `switchKey`'s reason — the
 * keys are a closed set the code owns — and **`null` means he took the tap
 * back**, which is a value rather than a second procedure because it is the
 * same control being pressed a second time.
 *
 * `issueNumber` is `.int().positive()` and validated for NOTHING ELSE. It is
 * deliberately not checked against the queue: the server cannot see GitHub
 * without a token, which is the credential this feature exists to avoid. A
 * number for a card that does not exist costs one row the shift tool reports
 * rather than acts on.
 */
const cardIntentInput = z.object({
  issueNumber: z.number().int().positive(),
  intent: z.enum(CREW_CARD_INTENT_KEYS as unknown as [string, ...string[]]).nullable(),
}).strict();

export const crewRouter = router({
  /**
   * The whole page in one call: the deployed briefing, every reply, and what
   * the team is doing right now.
   *
   * The reply projection is explicit at the database (invariant 8,
   * `server/db/crewReplies.ts`) and this procedure adds nothing to it — what
   * comes back is exactly `{ id, cardId, body, createdAt, author }` per reply,
   * because that is what the store hands over and this handler does not spread
   * a row. `shiftRuns` is the same discipline in `server/db/crewShiftRuns.ts`.
   *
   * ⚠ `shiftRuns` RIDES THIS CALL RATHER THAN GETTING ITS OWN (#272). The page
   * already re-reads this query every 60s while visible, so the live row is
   * live for free and the strip can never disagree with the briefing beside it
   * — two queries would land at two different moments and draw two different
   * instants as one page. There is no `shiftRuns` MUTATION here and there must
   * not be: shifts write those rows directly (migration 0055's header).
   */
  getState: adminProcedure.query(async ({ ctx }) => {
    if (!captureCrewTabEnabled(ctx.user.id)) refuseOutsideScope();

    /* The briefing never throws — a malformed edition degrades and says so in
       its own `problems` list, which is why this is not in a try. */
    const briefing = readCrewBriefing();
    const replies = await listCrewReplies();
    /* Degrades to `available: false` on an absent table (the window between
       this deploy and the founder's ceremony) and throws on anything else. */
    const shiftRuns = await listCrewShiftRuns();
    /* Same degradation, same reason (#277). */
    const workState = await readCrewWorkState();
    /* Same degradation, same reason (#325) — and it rides this call rather than
       getting its own for `shiftRuns`' reason: the taps are drawn ON the card
       titles this same query carries, so two queries would draw one list from
       two moments. */
    const cardIntents = await readCrewCardIntents();

    return { briefing, replies, shiftRuns, workState, cardIntents };
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

  /**
   * Flip one background-work switch. HIS control, and the only road to it.
   *
   * Founder-ordered (#277): with no focus and no named side lane, a shift stops
   * unless he has turned this on. It INVERTS today's default — maintenance mode
   * is currently what a shift falls into on its own judgement — and it guards a
   * failure he named himself, *"we need to ensure if they are waiting a long
   * time for me they dont completly over engineer security or anything because
   * they are bored."*
   *
   * ⚠ There is deliberately NO procedure that writes `crew_queue_counts`. Those
   * are the SHIFTS' rows, written by `scripts/crew-count-queue.mts` the way
   * #272's run rows are; a mutation here would break the split by who writes
   * (migration 0054's law, migration 0056's header).
   */
  setWorkSwitch: adminProcedure
    .input(workSwitchInput)
    .mutation(async ({ ctx, input }) => {
      if (!captureCrewTabEnabled(ctx.user.id)) refuseOutsideScope();

      return setCrewWorkSwitch({
        switchKey: input.switchKey,
        enabled: input.enabled,
        /* From the session, never from input (invariant 3). */
        changedByUserId: ctx.user.id,
      });
    }),

  /**
   * Mark one card *not relevant*, or take the mark back. HIS control (#325).
   *
   * Founder-ordered 2026-08-31: *"should there be a delete icon next to them so
   * i can close them or remove them myself if they are not relevant?"*
   *
   * ⚠ **THIS DOES NOT CLOSE THE CARD, AND MUST NOT.** Closing it here needs a
   * repository WRITE token living in production — a bigger exposure than the
   * READ token already declined on #285, and one that can change things rather
   * than only read them. That is a credential decision and it is his. So this
   * records the intent in his own table exactly as `setWorkSwitch` records a
   * switch, and a shift closes the card after checking it is genuinely stale.
   *
   * ⚠ **AND THERE IS DELIBERATELY NO PROCEDURE THAT RESOLVES ONE.** The
   * `resolution` columns are the shifts' half, written by
   * `scripts/crew-card-intents.mts --resolve` the way `crew_queue_counts` is
   * written by `crew-count-queue.mts`. A mutation here would let the page
   * answer its own question and the second pair of eyes would be the same pair.
   */
  setCardIntent: adminProcedure
    .input(cardIntentInput)
    .mutation(async ({ ctx, input }) => {
      if (!captureCrewTabEnabled(ctx.user.id)) refuseOutsideScope();

      return setCrewCardIntent({
        issueNumber: input.issueNumber,
        intent: input.intent,
        /* From the session, never from input (invariant 3). */
        markedByUserId: ctx.user.id,
      });
    }),
});
