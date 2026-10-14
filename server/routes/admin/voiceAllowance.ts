import { router, adminProcedure } from "../../_core/trpc";
import { readVoiceAllowanceForStaff } from "../../castingV2/voiceService";

/**
 * THE HOUSE'S VOICE RATION — N4b-3 (#2471), staff-only.
 *
 * His card: *"The month's remaining voice operations on the admin panel: a
 * count, staff-only, no creative content."* The reading itself, both numbers
 * and why, is {@link readVoiceAllowanceForStaff}'s docblock; this file is the
 * two decisions that belong to the ROUTE.
 *
 * # 1 · ITS OWN PROCEDURE, AND NOT A FIELD ON `getOverview`
 *
 * ⚠ **The tempting shape is a seventh key on `getOverview`, and it would put a
 * third party inside the admin dashboard's critical path.** That procedure is
 * seven database reads inside one `Promise.all`; this is an HTTP call to a
 * vendor. Folded in, a hung or rate-limited provider would stop the whole
 * overview — every KPI, the alerts feed, the charts — on a surface whose job
 * is telling staff what is wrong. The two are separate queries so the failure
 * of this one costs exactly two rows, which is what the card asks for and
 * nothing else.
 *
 * # 2 · `adminProcedure`, NEVER `moderatorProcedure`
 *
 * Admins pass the moderator middleware, so a `moderatorProcedure` here would
 * silently ship the surface to moderators and no admin account could tell the
 * difference (`CLAUDE.md`'s access-control grid, and #255's reasoning on the
 * bug-report inbox — the declaration is the whole control). The ration is
 * house operational capacity, which is admin work; moderators do abuse and
 * support work and have no use for it.
 *
 * ⚠ **There is no creative content on this road and no customer on it at all**
 * — no cast, no line, no clip, no account id. Nothing here can carry a
 * `masterPrompt`, a voice card or a storage key, because the whole input is
 * nothing and the whole output is four integers or a failure class.
 */
export const voiceAllowanceRouter = router({
  getVoiceAllowance: adminProcedure.query(() => readVoiceAllowanceForStaff()),
});
