/**
 * THE LADDER — which plans a comparison shows, and which one it recommends.
 *
 * Section 03 §6c asks for *"three cards: current, the recommendation, and the
 * tier above it"*, and §6d for a compare mode. Both need a recommendation, and
 * the brief is explicit that it is **derived**: the plan that covers the way
 * this account is actually working, not a plan somebody picked.
 *
 * ## ⚠ Where this departs from the brief, and why (BRIEF-RECONCILIATION Q3)
 *
 * The brief says **`Compare all 5`** and quotes a five-rung ladder with unit
 * prices of `2.79¢ … 1.87¢`. **We offer SEVEN tiers** (#391 folded the twelve
 * — `PLAN_TIERS`, `drizzle/schema.ts`, minus the hidden top rung the server
 * never serves), free through enterprise, at 0.036¢ down to 0.02¢ a credit.
 * That is the blank canvas the reconciliation exists to catch: the mockup was
 * drawn without the price table in view.
 *
 * Two things follow, and only one of them is a decision:
 *
 * 1. **`repeat(5, 1fr)` is kept and the POPULATION is derived** — the five
 *    rungs nearest the account, centred on the current plan. Twelve columns in
 *    an 880px modal is 73px a column, which is narrower than the word
 *    "Enterprise". The brief's own reason for the layout — *"the like-for-like
 *    read a comparison grid exists for"* — is what a twelve-column grid
 *    destroys, so keeping five columns keeps his design and drops only the
 *    number that came from a five-plan world.
 * 2. **The label reads `Compare plans`, not `Compare all 5`.** With the
 *    population derived, "all 5" would be false the moment the ladder changes
 *    length — and a control that mis-states its own count is the shape of every
 *    stale figure this program has been digging out of documents all week.
 *
 * ✅ **The one thing the brief demands of the data is already true of ours.**
 * *"Cost per credit … must descend monotonically up the ladder"* — his prototype
 * had Starter beating Pro on value and needed a data fix. Ours improves at
 * every rung, which `planMath.test.ts` asserts against the real table rather
 * than a fixture, so a future price edit that breaks the argument goes red.
 *
 * ⚠ **THE FIGURE IS PRINTED THE OTHER WAY UP SINCE CARD 390** — credits per
 * dollar (2,778 → 6,250), which ASCENDS. Same claim, same arm, opposite
 * direction; the surfaces read `formatCreditsPerDollar`, and this header said
 * `planLadder.test.ts` for a file that has never existed.
 */
/**
 * The tier key as the CLIENT sees it — a string off the wire.
 *
 * `PlanTier` proper lives in `drizzle/schema.ts`, and the client does not
 * import the schema: `billing.getPlans` is what puts the ladder on this side of
 * the wire, and its `planOrder` is already `string[]` by the time it arrives.
 * Naming the alias here keeps the intent readable without pulling the ORM into
 * the bundle.
 */
export type PlanTier = string;

export type LadderPlan = {
  id: PlanTier;
  name: string;
  priceInCents: number;
  credits: number;
  rolloverPercent: number;
};

/** How many columns the compare grid draws — the brief's `repeat(5, 1fr)`. */
export const COMPARE_COLUMNS = 5;

/**
 * The recommendation: the cheapest plan whose monthly credits cover the
 * projected spend of this cycle.
 *
 * ⚠ **PROJECTED, NOT SPENT.** Recommending against credits already used would
 * always name the plan they are on — the account has by definition not spent
 * more than it had. The number that argues for a move is what the CURRENT RATE
 * implies over a whole cycle, which is the same number §6a's band puts in front
 * of them. Both read `projectedSpend`, so the band and the card cannot disagree.
 *
 * Returns `null` when the current plan already covers the projection — there is
 * then nothing to recommend, and drawing a `FITS YOUR USE` tab on a plan they
 * already own is the mockup's own bug (§6d: *"the recommendation must outrank
 * the plan already owned"* was written because it did not).
 */
export function recommendPlan(
  ladder: LadderPlan[],
  currentId: PlanTier,
  projectedSpend: number,
): LadderPlan | null {
  const currentIndex = ladder.findIndex((plan) => plan.id === currentId);
  if (currentIndex < 0) return null;
  const current = ladder[currentIndex];
  if (projectedSpend <= current.credits) return null;
  const fit = ladder.find(
    (plan, index) => index > currentIndex && plan.credits >= projectedSpend,
  );
  /* Nothing on the ladder covers it — the top rung is still the best answer. */
  return fit ?? ladder[ladder.length - 1] ?? null;
}

/**
 * The three cards: current, recommendation, anchor.
 *
 * §6c: *"The tier above the recommendation is an anchor — a higher number in
 * view makes the target read as moderate."* With no recommendation (the account
 * fits its plan) the three become current plus the two above it, which is the
 * same shape doing the same job without inventing a reason to move.
 */
export function cardTrio(
  ladder: LadderPlan[],
  currentId: PlanTier,
  recommended: LadderPlan | null,
): LadderPlan[] {
  const currentIndex = ladder.findIndex((plan) => plan.id === currentId);
  if (currentIndex < 0) return ladder.slice(0, 3);
  const wanted = new Set<number>([currentIndex]);
  const recommendedIndex = recommended
    ? ladder.findIndex((plan) => plan.id === recommended.id)
    : -1;
  if (recommendedIndex >= 0) {
    wanted.add(recommendedIndex);
    if (recommendedIndex + 1 < ladder.length) wanted.add(recommendedIndex + 1);
  }
  for (let step = 1; wanted.size < 3 && currentIndex + step < ladder.length; step += 1) {
    wanted.add(currentIndex + step);
  }
  /* Still short at the top of the ladder — fill downwards rather than draw two. */
  for (let step = 1; wanted.size < 3 && currentIndex - step >= 0; step += 1) {
    wanted.add(currentIndex - step);
  }
  return Array.from(wanted)
    .sort((a, b) => a - b)
    .map((index) => ladder[index]);
}

/**
 * The five columns the compare grid draws — a window on the ladder, centred on
 * the account and shifted to keep the recommendation inside it.
 */
export function compareWindow(
  ladder: LadderPlan[],
  currentId: PlanTier,
  recommended: LadderPlan | null,
): LadderPlan[] {
  if (ladder.length <= COMPARE_COLUMNS) return ladder;
  const currentIndex = Math.max(0, ladder.findIndex((plan) => plan.id === currentId));
  const recommendedIndex = recommended
    ? ladder.findIndex((plan) => plan.id === recommended.id)
    : currentIndex;
  const anchor = Math.max(currentIndex, recommendedIndex + 1);
  let start = Math.min(currentIndex, anchor - COMPARE_COLUMNS + 1);
  start = Math.max(0, Math.min(start, ladder.length - COMPARE_COLUMNS));
  return ladder.slice(start, start + COMPARE_COLUMNS);
}

/**
 * `about 214 casting frames` — credits translated into work.
 *
 * §6c: *"Credits translated into work, because a credit count means nothing."*
 * His example is *"about 240 stills, or five clips"*. **There are no clips** —
 * video is one of the five greyed tools in the prompt box — so the clause is
 * dropped rather than invented, and the still is the roll frame the studio
 * actually charges for (`credits.getCosts` → `castingImage`).
 */
export function framesFor(credits: number, costPerFrame: number): number {
  if (costPerFrame <= 0) return 0;
  return Math.floor(credits / costPerFrame);
}

/**
 * `Half of anything unspent expires` / `Nothing you pay for expires`.
 *
 * §6c: *"Rollover said as loss, not percentage … Same fact; only one of them
 * lands."* Read off `rolloverPercent`, which our tiers carry at 0, 50, 75 and
 * 100 — so the sentence has to cover a quarter as well as a half.
 */
export function rolloverSentence(rolloverPercent: number): {
  text: string;
  isLoss: boolean;
} {
  if (rolloverPercent >= 100) {
    return { text: "Nothing you pay for expires", isLoss: false };
  }
  if (rolloverPercent <= 0) {
    return { text: "Anything unspent expires at renewal", isLoss: true };
  }
  const lost = 100 - rolloverPercent;
  const asFraction = lost === 50 ? "Half" : lost === 25 ? "A quarter" : `${lost}%`;
  return { text: `${asFraction} of anything unspent expires`, isLoss: true };
}
