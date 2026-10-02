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
 * direction; and this header said `planLadder.test.ts` for a file that has
 * never existed.
 *
 * ⚠ **"THE SURFACES" IS NOW ONE SURFACE — HIS WORD, 2026-10-02 (#1773).**
 * This clause read *"the surfaces read `formatCreditsPerDollar`"* while the
 * rate sat on a plan card, a compare row and Add credits. It is **Add credits
 * alone** now: no plan card and no column of the compare table carries a rate.
 * The monotonic claim above is untouched — it is a fact about the DATA and is
 * asserted against the real table, so it holds whether or not a surface prints
 * it.
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
 * ⚠ **AN UNKNOWN RUNG AND A RUNG THAT IS NOT ON THE LADDER ARE DIFFERENT FACTS,
 * AND ALL THREE HELPERS BELOW READ THEM AS ONE UNTIL #1747.**
 *
 * Every one of them starts with `ladder.findIndex((plan) => plan.id ===
 * currentId)`, and that answers **-1** for two situations which want opposite
 * answers:
 *
 * · **#391's HIDDEN RUNG** — a real plan, read off `getStatus`, deliberately
 *   absent from the offered ladder because he has not priced it. There is
 *   genuinely nothing above it to sell, so `cardTrio` falls back to the first
 *   three with nothing marked current. **That behaviour is correct and is
 *   unchanged.**
 * · **A RUNG NOBODY HAS READ YET** — `billing.getStatus` has not answered.
 *   Arranging a ladder around it is arranging it around a guess.
 *
 * The call sites could not tell them apart because the caller's own `?? "free"`
 * turned the second into the FIRST RUNG rather than into -1 — so a Pro
 * subscriber got the free rung's arrangement, marked current, with the rung
 * above it as the offer. Keying on `status?.planTier ?? null` is the repair, and
 * it only works if these three then DECLINE on `null` instead of inheriting the
 * hidden rung's answer: `cardTrio(ladder, null, …)` returning the bottom three
 * is the same wrong ladder under a different route.
 *
 * So each takes `PlanTier | null` and answers nothing at all for `null`. The
 * type is what makes it unmissable at a future call site; the `-1` paths below
 * are untouched.
 */
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
  currentId: PlanTier | null,
  projectedSpend: number,
): LadderPlan | null {
  /* Nothing is recommended against a rung nobody has read — see the note above
     this function. Separate from the `-1` below, which is #391's hidden rung. */
  if (currentId === null) return null;
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
  currentId: PlanTier | null,
  recommended: LadderPlan | null,
): LadderPlan[] {
  /* ⚠ THE ONE PLACE THE TWO FACTS GIVE OPPOSITE ANSWERS, so the order of these
     two lines is the whole fix: `null` draws NO cards, where the `-1` below
     draws the bottom three on purpose (#391). Collapsing them is what offered a
     Pro subscriber the free rung's arrangement. */
  if (currentId === null) return [];
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
  currentId: PlanTier | null,
  recommended: LadderPlan | null,
): LadderPlan[] {
  /* ⚠ Before the short-circuit below, not after it: a ladder of five or fewer
     rungs returns whole, so a `null` rung would otherwise draw the full
     comparison centred on nothing. And `Math.max(0, -1)` two lines down is a
     floor that silently reads an unknown rung as the BOTTOM one. */
  if (currentId === null) return [];
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
 * HOW MANY FINISHED CHARACTERS A PLAN'S CREDITS COVER — the plan card's line 4
 * (#1607, P1-8) and the Add credits bullet (#1758). Both arguments are LEDGER
 * numbers, so the ratio is scale-neutral and no display conversion belongs in
 * here.
 *
 * ⚠ **IT REPLACED `framesFor(credits, costPerFrame)`, WHICH IS DELETED RATHER
 * THAN LEFT BESIDE IT (#1758).** That function answered §6c's *"credits
 * translated into work"* by dividing by the still the studio charges for, and
 * its two callers both passed `credits.getCosts`'s `castingImage` — the LEGACY
 * studio's 350, against the 200 the studio a customer actually uses charges, so
 * every figure read low by more than half. ⚠ **That clause said *"for a lane
 * admin-only since #1654"* and the ground was false (#1786, 2026-10-02): the
 * same constant is what the LIVE canvas charges, through three
 * `protectedProcedure`s in `server/routes/boardOps.ts`.** The deletion stands on
 * the reason above — the wrong price for the road being sold.
 * #1607 took the plan cards off it; #1758 took Add credits off it, and that was
 * the last caller. A
 * surviving helper whose only argument is a per-frame price is an invitation to
 * fetch that price again, which is the defect both cards are about, so it goes
 * with its last reader and with its own test arm.
 *
 * ⚠ **IT ROUNDS DOWN, NOT TO THE NEAREST, AND THE DIRECTION IS A SAFETY
 * PROPERTY RATHER THAN A PREFERENCE.** `shared/creditDisplay.ts` sets the rule
 * this follows: *"a balance rounds DOWN and a price rounds UP, so the product
 * never shows a balance higher than what is spendable."* "How many characters
 * does this plan cover" is a balance-side question — a customer shown 16 who
 * can only finish 15 has been overpromised, which is the one defect a pricing
 * surface cannot have.
 *
 * ⚠ **SO TWO OF THE CARD'S OWN QUOTED FIGURES COME OUT ONE LOWER, AND THAT IS
 * EXPECTED.** #1607's body quotes `Pro 16` and `Studio 38`; at the adopted
 * ladder Pro covers 15.7 and Studio 37.5, so this answers 15 and 37. The card
 * calls its wording *"quotation, not requirement"* and asks for the counts to
 * be derived, which is what makes the difference a finding rather than a
 * mismatch.
 *
 * ⚠ **ABOVE A HUNDRED IT ALSO ROUNDS DOWN TO TWO SIGNIFICANT FIGURES**, because
 * the sentence that carries it says *"about"*. `about 3,799 finished
 * characters` is a computed figure wearing an estimate's word — his approved
 * page's own examples at those rungs read `200`, `1,100`, `3,600` — and a
 * number nobody can act on at that precision is the disappearing-technology
 * law's clause 6. It rounds DOWN for the same reason the floor does, so the
 * promise only ever gets more conservative. Under a hundred the exact floor is
 * already a number a person reads at a glance, so nothing is thrown away.
 */
export function charactersFor(credits: number, oneCharacterCredits: number): number {
  if (oneCharacterCredits <= 0) return 0;
  const exact = Math.floor(credits / oneCharacterCredits);
  if (exact < 100) return exact;
  /* Two significant figures, always downward: 205 -> 200, 3,799 -> 3,700. */
  const step = 10 ** (Math.floor(Math.log10(exact)) - 1);
  return Math.floor(exact / step) * step;
}

/**
 * `about 15 finished characters` — the phrase, and `For example, about 15
 * finished characters.` — line 4's sentence around it, or `null`
 * when there is no count to state (#1607, P1-8).
 *
 * `null` is a real answer and the card draws NOTHING for it, which is
 * `blurbFor`'s own rule one function up: a plan whose credits do not cover one
 * finished character has no example to give, and *"about 0 finished
 * characters"* is a worse sentence than silence. Nothing on today's ladder
 * reaches it — the free grant covers one — so this is the soft landing under a
 * future price change rather than a branch in use.
 *
 * ⚠ **THE NOUN IS `finished characters` AND IT NAMES NO ENGINE AND NO STAGE.**
 * The disappearing-technology law's clause 6 asks for the customer's own
 * vocabulary; `casting frames`, which this line replaced, is the pipeline's
 * word for the unit a sheet slice bills in, and it described a roll candidate
 * rather than anything a customer would call finished.
 *
 * ⚠ **THE PHRASE IS SPLIT OUT BECAUSE THE COMPARE GRID COMPOSED ITS OWN AND
 * GOT THE SINGULAR WRONG — SEEN IN THE RUNNING APP (law 6).** Its *"What that
 * makes"* row read **`about 1 characters`** on the free column: the row had a
 * second copy of the noun rule, which is working law 4 and drifted the moment
 * one of the two learned about plurals. One declaration, two readers now — the
 * card wraps the phrase in a sentence, the table prints it bare.
 */
export function charactersPhrase(characters: number): string | null {
  if (characters <= 0) return null;
  return `about ${characters.toLocaleString()} finished character${characters === 1 ? "" : "s"}`;
}

export function exampleSentence(characters: number): string | null {
  const phrase = charactersPhrase(characters);
  return phrase === null ? null : `For example, ${phrase}.`;
}

/**
 * WHAT FOLLOWS THE CREDIT FIGURE ON LINE 3 — `credits a month, one pool for
 * everything.` (#1607, P1-8).
 *
 * The figure itself is formatted by `@shared/creditDisplay`'s `formatCredits`,
 * which already reads a million and up as `2.8M` — the card's *"M-style from
 * Scale up"* needed no new formatter, only this sentence around it. The two are
 * separate so the card can give the number its own weight and the sentence a
 * lighter one, which is the card's *"second and lighter"*.
 *
 * ⚠ **A FREE GRANT IS NOT A MONTHLY ALLOWANCE AND THIS SURFACE SAID IT WAS.**
 * `PLAN_TIERS.free.monthlyCredits` is a ONE-TIME signup grant — its own
 * declaration in `drizzle/schema.ts` says so, *"and nothing else reads it as
 * monthly"* — and the plan card drew it under the stamp `A MONTH`, so a free
 * account was told its 2,700 credits arrive every month. They arrive once.
 * Found while writing line 3, inside this card's own line, so it is fixed here
 * rather than filed.
 *
 * ⚠ **"Monthly" IS DERIVED FROM THE PRICE, NEVER FROM THE RUNG'S NAME.** A
 * rung with nothing recurring to charge has nothing recurring to grant, which
 * is true of whatever the free rung is called next; keying on `id === "free"`
 * would be the fixed list his N3 principle rules out (*"we really cannot be
 * working from fixed lists in a fluid editing application"*).
 *
 * ⚠ **`one pool for everything` IS A CLAIM AND IT WAS CHECKED.** There is one
 * balance per account (`points.balance`) and every tool spends it; the per-use
 * buckets on his approved page are Phase 2 and are not built. The day they are,
 * this sentence is what has to move.
 */
export function creditsTail(priceInCents: number): string {
  const arrival = grantsMonthly(priceInCents) ? "credits a month" : "credits to start";
  return `${arrival}, one pool for everything.`;
}

/**
 * DOES THIS RUNG GRANT CREDITS EVERY MONTH — the one declaration of the rule
 * `creditsTail` above states in prose, now that a second surface needs it
 * (#1761).
 *
 * ⚠ **IT IS SPLIT OUT BECAUSE ADD CREDITS HAD ITS OWN ANSWER AND THE ANSWER WAS
 * NO ANSWER AT ALL.** `AddCreditsModal` subtracted the account's current
 * `monthlyCredits` from the target rung's to name the delta, and on the free
 * rung that is a monthly allowance minus a ONE-TIME grant printed as a monthly
 * figure — a free account was told *"+ 11,300 credits a month"* where Starter's
 * whole allowance is **14,000**. Two surfaces asking *is this monthly* with one
 * of them not asking is the shape #1607 fixed on the plan cards; two surfaces
 * asking it with a copy of the test each is working law 4, and the copy is what
 * drifts. So the rule is a function and both read it.
 *
 * ⚠ **THE PRICE IS THE TEST, NEVER THE RUNG'S ID** — `creditsTail`'s own reason
 * above, kept here because this is where it now lives: a rung with nothing
 * recurring to charge has nothing recurring to grant, whatever it is next
 * called, and a fixed list of rung names is what his N3 principle rules out.
 *
 * A rung whose price is unread is NOT a rung with no price — that distinction
 * belongs to the caller, which is why this takes a number rather than a
 * `number | null`. Both surfaces hold their own unread state.
 */
export function grantsMonthly(priceInCents: number): boolean {
  return priceInCents > 0;
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
