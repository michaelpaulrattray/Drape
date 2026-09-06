/**
 * THE BLURB — §6c's one-line positioning statement, one per rung.
 *
 * ⚠ **THESE SEVEN LINES ARE PLACEHOLDERS AND THE CARD SAYS SO OUT LOUD
 * (#404).** They are the relay's draft written under the founder's own order,
 * not his voice, and he intends to replace them. Declared here rather than
 * shipped quietly, per the fidelity law: a lesser path taken *silently* is the
 * violation, a declared one is legitimate scaffolding.
 *
 * **His words, in the order he said them, because the second supersedes part
 * of the first and a reader needs both:**
 *
 * 1. 2026-09-02: *"404 when 391 lands crate a place holder positioning lines
 *    so im reminded to fix them at a later date."*
 * 2. 2026-09-07: *"can you just make it up for now"*, and on the Crew tab:
 *    *"Use the seven placeholder lines the relay posted on the card. Build to
 *    those."*
 *
 * ⚠ **WHAT (2) SUPERSEDES IN (1), NAMED RATHER THAN QUIETLY PICKED.** The
 * first ruling's bar was that a placeholder be *"a plain factual sentence
 * derived from the plan's own numbers … never invented positioning copy"*.
 * The lines he then approved are positioning copy — *"For a creator posting
 * weekly and building a roster"* is not derived from a credit count. His later
 * word governs, and it is explicit twice.
 *
 * ✅ **The half of that bar which SURVIVES is the half that matters, and every
 * line here holds it: none of them claims a CAPABILITY.** They say who a rung
 * is *for*. Nothing here promises a feature, a volume, a turnaround or a
 * result, so no line can become false by the product changing — only by him
 * preferring different words. That is what makes them safe to ship in front of
 * paying customers while they wait for his voice.
 *
 * ## Why a client-side map and not a server field
 *
 * Working law 4 asks the opposite question first — is something already
 * carrying this? — and the answer is no. `SUBSCRIPTION_PRODUCTS` has a
 * `description` (`"75,000 credits/month with 50% rollover"`), but it is a
 * restatement of the credits block two lines below it, not a positioning
 * statement, and it exists only for the six PURCHASABLE rungs, so it could
 * never carry **Free**. This is marketing copy: no schema, no migration, no
 * wire field, and editing it is editing one table in one file — which is
 * precisely what he needs when he rewrites them in his own voice.
 *
 * ⚠ **THE HIDDEN RUNG GETS NO LINE, AND ITS ABSENCE IS DELIBERATE.**
 * `ultimate` is off the offered ladder (#391, `HIDDEN_PLAN_TIERS`) and its
 * door is the email line under the modal. `planBlurbs.test.ts` pins the map
 * against `OFFERED_PLAN_TIERS` in both directions, so a rung added to the
 * ladder without a line, or a line for a rung nobody is served, goes red
 * rather than shipping a card with a hole in it.
 */

/**
 * One line per offered rung, in ladder order.
 *
 * ⚠ **HE EDITS THIS TABLE AND NOTHING ELSE.** When his words land, the strings
 * change and no other file moves — that is the whole reason this is a map and
 * not seven literals in the JSX.
 */
export const PLAN_BLURBS: Record<string, string> = {
  free: "Try the studio. A few casts a month, no card.",
  starter: "For one creator casting a handful of faces a month.",
  pro: "For a creator posting weekly and building a roster.",
  studio: "For a team shooting a campaign a month.",
  business: "For a brand team casting across several campaigns at once.",
  scale: "For agencies running many brands with constant output.",
  enterprise: "For studios where casting never stops.",
};

/**
 * The line for a rung, or `null` where there is none.
 *
 * ⚠ **NULL IS A REAL ANSWER AND THE CARD MUST DRAW NOTHING FOR IT** — not an
 * empty element, not a blank line holding space. Card 390 item 5's finding was
 * a slot quietly filled by the wrong sentence; a slot quietly filled by an
 * empty box is the same mistake with less to see.
 *
 * ⚠ **AND THE BRANCH IS NOT REACHABLE FROM TODAY'S CARD, WHICH IS STATED
 * RATHER THAN IMPLIED.** The modal builds its ladder by walking
 * `plans.planOrder` — `OFFERED_PLAN_ORDER`, which excludes the hidden rung —
 * so every id reaching this function is an offered one and has a line. The
 * first draft of this docblock claimed the opposite, that an account owning
 * `ultimate` would reach it; read at `ChangePlanModal`'s `ladder` memo that
 * is false, because a current plan ABSENT from the ladder makes `cardTrio`
 * fall back to the first three rungs rather than inserting it. The branch
 * therefore exists for ONE reason: a rung added to the ladder before its line
 * is written draws nothing instead of the word `undefined`. The guard below
 * is what actually catches that case; this is the soft landing under it, not
 * the control.
 */
export function blurbFor(planId: string): string | null {
  return PLAN_BLURBS[planId] ?? null;
}
