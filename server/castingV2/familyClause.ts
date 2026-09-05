/**
 * THE FOLLOW CLAUSE — how the author road carries a FOLLOW: the Row A build
 * (#177; the founder's pick, desk + terminal, verbatim: *"i chose row a on my
 * desk for now"* — ROW A: Follow = close variations, his own hand-test
 * sentence; the build order on #177: *"anchor photo + anchor's brief + the A
 * clause; identity dice never consulted (#176); facts change at the roll,
 * never at the follow"*).
 *
 * On the author road a follow is carried by the followed face ITSELF: the
 * roll attaches the anchor's delivered frame to every render (the edit
 * endpoint the #177 court measured, 24/24 delivered), the customer's brief
 * travels verbatim as the first paragraph exactly as on every authored roll,
 * and THIS paragraph — fixed bytes, written by code — sits between them and
 * the locked house block. Nothing here reads an axis, a dice record or an
 * override, and that absence is the design:
 *
 *   - **The clause is his courted sentence, not a description of the anchor.**
 *     The #154/#166 shape described the person in words read out of the
 *     record ("a woman, in their 30s, of Nordic heritage…"), which is why
 *     #176's ghost could put a fiction into it — the founder followed a
 *     visibly Mediterranean man whose unsent dice record claimed South Asian
 *     heritage, and the clause repeated it to the engine as fact. A fixed
 *     clause plus the photograph has no channel a fiction can ride: the
 *     "attached look" IS the delivered frame.
 *   - **Overrides and unlocks never reach it** — facts change at the roll,
 *     never at the follow (his build order). The entrance drops them on an
 *     anchored roll before the compile; `overrides` below is always empty,
 *     and the echo offers no adjustment on the author road (`varyOffered`).
 *   - **The clause exists exactly when the photo rides.** The compiler keys
 *     it on `anchorImageAttached` — set by the roll service only once it
 *     holds the anchor's bytes for every render — never on whether a stated
 *     anchor could be built, so "the attached look" can never be said to an
 *     engine that was handed no attachment.
 *
 * The courted arm's head was his own inline paraphrase of the brief ("cast as
 * a fitness creator in their mid 30s. Same casting brief as…"); the build
 * leads with the brief verbatim instead — the author road's structural law,
 * the brief is the first paragraph by code — and keeps the rest of the
 * sentence byte-for-byte. Row B (the shortlist clause) stays on #177's record
 * as a possible second mode, NOT built — his "for now".
 *
 * Its vocabulary is swept by `familyClause.test.ts` against `NEVER_WRITTEN`,
 * the house sentences and the #166 clone-stamp phrases — a clause is code's
 * paragraph and is never re-asked, so a forbidden word here would reach the
 * engine on every follow, unrefused.
 */
import type { LockOverrides } from "./briefCompiler";
import type { AgeBand, AgePhase } from "./castingIntent";

/** What the clause was written from — recorded on the row so the sheet can say (design §2d). */
export type CarriedIdentity = {
  /** True when a follow's anchor was carried; always true since Row A — a chip edit without a follow carries nothing here (#164). */
  follow: boolean;
  /** Always empty since Row A: facts change at the roll, never at the follow (#177). Kept for the rows already written, which recorded what their clause held. */
  overrides: LockOverrides;
  /** The paragraph itself — the same bytes that sit inside `register.prompt`. */
  clause: string;
};

/**
 * The Row A clause, byte-for-byte from the courted arm (#177,
 * `output/_shift177/court-record-main.json`, arm A) minus its inline brief
 * head — the brief leads verbatim as its own paragraph on this road.
 */
export const FOLLOW_ANCHOR_CLAUSE =
  "Same casting brief as the attached look, new person: keep the same sex, age range, heritage, and hair-colour family. "
  + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression.";

/**
 * "in their late 30s" — the phrase `briefRewrite` renders a chip-edited age
 * with. It lived HERE from the axis-clause era and moved to `@shared/briefRewrite`
 * with the rewriter on 2026-09-05 (#534), because the client now runs that
 * rewrite at the chip click. Re-exported rather than copied so this module's
 * own callers are untouched and there is still one owner of the wording
 * (working law 4); the follow clause itself no longer says an age.
 */
export { agePhrase } from "@shared/briefRewrite";

/**
 * The carried record for an anchored follow. No inputs, and that is the
 * point: the clause is fixed, the photo is the anchor, and nothing a record
 * or a control says can reach either (#177: "identity dice never consulted;
 * facts change at the roll, never at the follow").
 */
export function followClause(): CarriedIdentity {
  return { follow: true, overrides: {}, clause: FOLLOW_ANCHOR_CLAUSE };
}
