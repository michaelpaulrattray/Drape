/**
 * CHANGE PLAN — *"which plan should I be on"* (brief §6).
 *
 * The plan-picker half of `BillingModal`, on its own surface. §1 forbids
 * folding it into a Settings section and gives the reason: a pricing comparison
 * does not fit an 880px modal that has already spent 186px on a nav column, and
 * it opens from four places Settings does not.
 *
 * ~~**Nothing about the mutations changed.**~~ ⚠ **TRUE UNTIL #664.** The
 * mutations' HOMES are unchanged (§1: *"Only where they live and how they
 * look"*), but `changePlan` and `previewPlanChange` now carry `interval` —
 * the Annual toggle is a real choice for an existing subscriber, the toggle
 * opens on the interval the account is billed on, and a subscriber's change
 * is confirmed against the server's own quote before it charges, because the
 * charge is immediate now (`always_invoice`). `createSubscriptionCheckout`
 * still opens Stripe for an account with no subscription, and
 * `cancelSubscription` is still what dropping to Free means.
 *
 * ## The four rules in §6 that are decisions rather than styling
 *
 * 1. **Two modes, never tabs.** *"Cards decide; the table compares. A tab would
 *    imply both are useful at once."*
 * 2. **Exactly one ink button per view** — the next tier up. Downgrades are
 *    secondary, deliberately unpersuasive rather than hidden. Three identical
 *    primaries is the single biggest failing of the modal this replaces.
 * 3. **Compare mode carries a footer primary.** The table is ~595px of content
 *    in a ~367px pane, so every column button sits below the fold; without one,
 *    the most reachable control in a comparison view is a cancellation.
 * 4. ~~**`FITS YOUR USE` outranks `YOU ARE HERE`.**~~ ⚠ **SUPERSEDED BY HIS
 *    RULING, #487 (reply #115): *"dont show the fits your use tag on the
 *    compare table it doesnt look right."*** The rule existed because the
 *    prototype let the recommendation fall into a faint fallback branch,
 *    making the plan being sold the dimmest thing in the comparison view. His
 *    answer is not a different ordering — the tag is off that table, so there
 *    is nothing left to order. **It is unchanged on the plan cards**, which is
 *    where he sees it and where he did not object.
 *
 * ## What the reconciliation changed (BRIEF-RECONCILIATION Q3)
 *
 * The brief's ladder is five rungs at `2.79¢ … 1.87¢`; **ours is the offered
 * seven** (#391 folded the twelve: four Plus rungs dropped, Ultimate hidden
 * behind the email line below the ladder) at 0.036¢ down to 0.02¢ a credit.
 * The population of both modes is derived from `billing.getPlans` in
 * `planLadder.ts` — see its header for the whole reading — and the compare
 * control says `Compare plans` rather than `Compare all 5`.
 *
 * ## Card 390 — his six form corrections, and the one thing they must not do
 *
 * ⚠ **THE PROTOTYPE WINS ON FORM AND ON NOTHING ELSE.** His own rule, verbatim:
 * *"the credits and things like that in the mockup are obviously not the same
 * as the live server that is the source of truth a mockup isnt."* The mockup
 * draws five rungs called Starter · Pro · Studio · **Agency** · **Network** at
 * `$149 / $349 / $749` with `6,000` credits on Studio. **`Agency` and `Network`
 * do not exist**, the rungs at those positions are `Studio Plus` and
 * `Business`, and the credit figures are ~83× apart. Every name, price, credit
 * count and perk on this surface comes from `PLAN_TIERS` through
 * `billing.getPlans`; `card390-guard.test.ts` asserts that no prototype
 * figure has been typed in.
 *
 * The six, and where each lives:
 *
 * 1. **The action moved into the middle** — §6c's order is name + unit → price
 *    → blurb → **action** → credits block → perks, and it ran last, so the
 *    decision sat behind four lines of detail.
 * 2. **Annual shows the MONTHLY EQUIVALENT** (`monthlyEquivalent`), everywhere
 *    including compare mode's row label and the footer primary.
 * 3. **The per-card perk list is gone** — it was the one fact that does not
 *    differ, and it is in the footnote where §6d puts such things.
 * 4. **The unit price is inverted** to credits per dollar
 *    (`formatCreditsPerDollar`), whole numbers that ASCEND up the ladder.
 * 5. ~~**§6c's blurb slot ships EMPTY and says so**~~ — **THE SLOT IS FILLED
 *    AS OF #404**, on his word, from `planBlurbs.ts`'s seven declared
 *    placeholders. Item 5's real finding is untouched and still guarded: the
 *    frames line is what the credits MAKE, it is not a positioning statement,
 *    and it stays in the credits block. What changed is that the slot it was
 *    misoccupying now has its own sentence.
 * 6. ~~**`.dp-plan__tab--inline`** replaces an inline style override.~~ The
 *    inline style is still forbidden and still guarded; the MODIFIER is gone
 *    with the tag it existed for (#487). `.dp-plan__tab` has one context
 *    again, which is what item 6 was trying to buy.
 */
import { useEffect, useMemo, useState } from "react";
import { displayBalance, displaySpent, formatCredits } from "@shared/creditDisplay";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { ConfirmDialog } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
  formatDollars,
  formatShortDate,
  formatWholeDollars,
  formatCreditsPerDollar,
  monthsFree,
  priceAMonth,
  readBurn,
  readCycle,
} from "@/features/settings/planMath";
import {
  cardTrio,
  compareWindow,
  charactersFor,
  charactersPhrase,
  creditsTail,
  exampleSentence,
  recommendPlan,
  rolloverSentence,
  type LadderPlan,
} from "@/features/settings/planLadder";
import { blurbFor } from "@/features/settings/planBlurbs";
import { useCycleSpend } from "./useCycleSpend";

type Interval = "monthly" | "annual";

/**
 * The one thing that is true of every rung, said ONCE and read by both modes.
 *
 * §6d: *"a row where all plans agree carries no decision value; it belongs in
 * the footnote."* Card 390 applied that to the cards and moved the tick into
 * the footnote, leaving one sentence in each view.
 *
 * ⚠ **CARD 425 ITEM 1 REVERSES THAT, ON HIS WORD, AND HIS REASON IS NOT THAT
 * IT DIFFERENTIATES TODAY — IT IS THAT THE ROW IS WHERE DIFFERENTIATION WILL
 * GO.** Verbatim: *"The tick reading 'Every model and every tool' bring it back
 * because eventually i need to make benefits between each plan which will be a
 * reminder for me."* §6d's test asks whether a row carries decision value
 * TODAY; he is buying the slot for the day it does, which is a product decision
 * and outranks the styling rule that removed it.
 *
 * **What did NOT come back is the duplication.** The cards state it, so card
 * mode's footnote — which existed only because the tick had left — is gone;
 * compare mode keeps its footnote, having no per-column perk row to carry it.
 * Each view says it exactly once, which was card 390's actual point.
 */
const EVERY_PLAN_PERK = "Every model and every tool";
/*
  ⚠ **AND THE FOOTNOTE IS DERIVED FROM THE TICK RATHER THAN REPEATING IT**
  (card 425 item 1). Two modes state one fact, so the fact is declared once: the
  day a perk actually differs per rung, the tick above is what he edits and this
  sentence follows it. A second hand-typed copy is the shape working law 4 is
  about, and it would drift the first time either is touched.
*/
const ONE_FOR_EVERY_PLAN = `${EVERY_PLAN_PERK}, on every plan — the only differences are the ones shown above.`;

/**
 * THE TRUST LINE — his approved pricing page's own sentence, once per pane
 * (#1607, P1-8).
 *
 * ⚠ **BOTH HALVES ARE CAPABILITY CLAIMS AND BOTH WERE READ AT THE CODE BEFORE
 * THIS SHIPPED**, which is the card's rule for every string it quotes: *"re-
 * derive every string against present capability before shipping."*
 *
 * **"See the price before you make anything"** — every spending control in the
 * studio carries its price in the label a customer presses, and each one of
 * them goes through `displayPrice`: the sheet dock
 * (`features/casting/ControlPanel.tsx`), a tile's Retry
 * (`castingV2/components/CandidateTile.tsx`), a Refine
 * (`castingV2/components/RefinePanel.tsx`), a Sign
 * (`castingV2/components/SignConfirm.tsx`), a view's Try again
 * (`casting/components/ImageViewer/ViewTabs.tsx`).
 *
 * **"Credits back if a result doesn't arrive"** — and the wording is precise
 * rather than generous. Under the founder's catastrophic-only refund ruling a
 * frame the verification layer merely DISPUTES is delivered and charged
 * (`castingV2/refineService.ts`), so a promise of credits back on a result
 * somebody does not LIKE would be false. What refunds is an arrival that did
 * not happen: a failed sheet slice refunds its own recorded `pointsCost`, a
 * failed view refunds its slice, a lost Sign refunds through `signRecovery`,
 * and a refine is one unit that refunds whole. This sentence says exactly that
 * and nothing wider.
 *
 * ⚠ **It sits OUTSIDE the card/compare branch so it is stated once in either
 * mode** — the duplication card 390 removed and card 425 was careful not to
 * reintroduce. It is not a second copy of the perk footnote above it: that one
 * is about what a plan includes, this one is about what spending is like.
 */
const TRUST_LINE =
  "See the price before you make anything. Credits back if a result doesn't arrive.";

export function ChangePlanModal({
  onClose,
  onAddCredits,
}: {
  onClose: () => void;
  onAddCredits: () => void;
}) {
  /*
    ⚠ **THE TOGGLE OPENS ON THE INTERVAL THE CUSTOMER IS BILLED ON** (#664).
    It used to open on Monthly for everyone — so an annual subscriber's first
    frame priced a purchase they had not chosen, which is the same lie the
    card was filed about pointing the other way. `null` = they have not
    touched it; the billed interval (or monthly, for an account with no
    subscription) shows until they do.
  */
  const [intervalChoice, setIntervalChoice] = useState<Interval | null>(null);
  const [compare, setCompare] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  /* The plan waiting on the confirm step — the year's total is shown where it
     is charged (card 390 item 2), and since #664 the charge is immediate, so
     no plan change fires without its figure being read first. */
  const [confirming, setConfirming] = useState<LadderPlan | null>(null);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.billing.getStatus.useQuery();
  const utils = trpc.useUtils();

  const billedInterval: Interval | null =
    status?.billingInterval === "year"
      ? "annual"
      : status?.billingInterval === "month"
        ? "monthly"
        : null;
  /*
    ⚠ **AN UNREAD BILLING INTERVAL IS NOT "MONTHLY" — #1763, and it is #1755 on
    the sibling surface with the collapse one line lower down.**

    The ladder above is correct: `undefined` matches neither branch, so an
    unread status lands on `null`. This line read `?? "monthly"` and put the
    collapse straight back — and because the result was typed `Interval` rather
    than `Interval | null`, **no reader below was ever asked**. A yearly
    subscriber opening this saw the **Monthly** segment drawn filled in and
    announced `aria-pressed` for the beat before `billing.getStatus` answered,
    and then watched it flip.

    ⚠ **THE TWO ABSENCES THE BRANCH BELOW SEPARATES ARE NOT THE SAME ABSENCE,
    and reading them as one is what made the old default look reasonable.**
    `billedInterval` is `null` both while the query is in flight AND once it has
    answered about an account that has no cycle of its own — a free account, or
    (the server's own note on `getStatus`) a subscription whose cached interval
    is unknown. The first is *we have not been told*; the second is *there is
    nothing to be told*, and on this surface that second state still has to
    offer a purchase. So the default moves INSIDE the read: once the status has
    answered, the control opens on Monthly as the choice on offer, which is a
    claim about nothing. While it has not answered, `null` — and every reader
    below answers for it in its own words, which is what the type is for.

    This is exactly the shape `AddCreditsModal` carries (`annualChoice ?? (status
    ? … : null)`); the spelling differs only because this surface names its two
    states rather than carrying a boolean.
  */
  const interval: Interval | null =
    intervalChoice ?? (status === undefined ? null : billedInterval ?? "monthly");

  const checkout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.info("Opening checkout…");
      setPending(null);
    },
    onError: (error) => {
      logRawFailure("billing.createSubscriptionCheckout", error);
      toast.error(readableFailure(error, "Checkout could not be opened. Please try again."));
      setPending(null);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setPending(null);
      setConfirming(null);
      void refetchStatus();
      void utils.credits.getBalance.invalidate();
      onClose();
    },
    onError: (error) => {
      logRawFailure("billing.changePlan", error);
      toast.error(
        readableFailure(
          error,
          "We lost contact while changing your plan. Check your plan before trying again.",
        ),
      );
      setPending(null);
      setConfirming(null);
    },
  });

  /*
    The confirm step's figure is the SAME quote the server acts on
    (`previewPlanChange` and `changePlan` read one `quotePlanChange`), so the
    number read and the number charged cannot be two arithmetics. The dialog
    waits for it: a charge is never confirmed against a figure nobody has.
  */
  /*
    ⚠ **THE LAW-7 SIBLING OF #1747, FOUND BY ITS SWEEP AND NOT A LIVE DEFECT —
    read at the bytes before it was touched.** This placeholder was `?? "starter"`
    and it is UNREACHABLE: the query's `enabled` is false on exactly the
    condition that makes the default apply (`confirming !== null`), so the name
    never travelled. Nothing was claimed to anybody.

    It is changed anyway, for two reasons that are not tidiness. It is the same
    CLASS — a plan identity defaulted to a plan NAME — and the class's whole cost
    is that a wrong value sitting behind a gate becomes a wrong ANSWER the day
    the gate moves; whoever removed `confirming !== null` to prefetch would have
    quoted a **Starter** change to a customer confirming something else, with
    nothing on screen looking wrong. And `null` is what the neighbouring surface
    already passes on the identical idiom (`AddCreditsModal`: `newPlan:
    selectedId as never`), so the two now agree instead of one of them carrying a
    name. If that gate ever does move, a `null` fails validation loudly.

    ⚠ It is invisible to `server/unreadPlanIdentity.test.ts`'s reader — the
    identifier before the `??` is `id`, which carries neither "plan" nor "tier" —
    so the gate is pinned by an arm there rather than by the walk. That is the
    floor that suite states, with a live instance to show what it looks like.
  */
  const changeQuote = trpc.billing.previewPlanChange.useQuery(
    /* `interval === "annual"`, not `interval ?`: an unread interval must not be
       quoted as monthly. The query cannot fire in that state — the gate below
       names it — so this is the value behind a closed door said correctly
       rather than a branch anybody reaches (#1763, the idiom #1755 settled on
       the sibling surface). */
    {
      newPlan: (confirming?.id ?? null) as never,
      interval: interval === "annual" ? "annual" : "monthly",
    },
    {
      /* ⚠ `interval !== null` is implied today — `confirming` is set by a press
         on a button the ladder does not draw while the status is unread — and
         it is stated anyway, because *what cycle is this quote for* is a money
         question and a claim held by an implication dies the day either side of
         the implication moves. #1755's own reasoning, one surface over. */
      enabled: hasSubscriptionForQuote(status) && confirming !== null && interval !== null,
    },
  );

  /*
    ⚠ A QUOTE THAT FAILS MUST SAY SO (#664 review finding 5): the confirm
    dialog renders only once the quote exists, so a failed preview used to
    leave the press doing nothing at all — no dialog, no sentence, a dead
    button on a billing surface.
  */
  const quoteError = confirming ? changeQuote.error : null;
  useEffect(() => {
    if (!quoteError) return;
    logRawFailure("billing.previewPlanChange", quoteError);
    toast.error(
      readableFailure(
        quoteError,
        "We could not price this change. Nothing was charged — please try again.",
      ),
    );
    setConfirming(null);
    setPending(null);
  }, [quoteError]);

  const cancelSubscription = trpc.billing.cancelSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setConfirmingDrop(false);
      void refetchStatus();
      void utils.credits.getBalance.invalidate();
      onClose();
    },
    onError: (error) => {
      logRawFailure("billing.cancelSubscription", error);
      toast.error(
        readableFailure(error, "We lost contact while cancelling. Check your plan before trying again."),
      );
      setConfirmingDrop(false);
    },
  });

  /*
    ⚠ **AN UNREAD PLAN IS NOT THE FREE PLAN — #1747, the same one-line shape
    #1746 repaired on the Settings surfaces.**

    This read `?? "free"`, and because every reader below keys a CATALOGUE
    LOOKUP on it, that one default decided five separate things for a Pro
    subscriber whose `getStatus` had not answered: the header named their plan
    **"Free"**, the **free card carried `Current plan`**, and `recommendPlan`,
    `cardTrio` and `compareWindow` arranged the whole ladder around the bottom
    rung.

    ⚠ **IT IS NOT A BEAT, WHICH IS WHY IT IS WORTH THE LINES.** `getPlans` and
    `getStatus` ride ONE batched request, but a tRPC batch reply carries one
    entry per call and either can fail alone — and they are not equally likely
    to: `getPlans` is a constant fold over `SUBSCRIPTION_PRODUCTS`, `getStatus`
    reads the database. With `plans` answered beside an unanswered `status`
    nothing here retries or refuses, so that arrangement is **permanent for the
    life of the surface**.

    While BOTH were unread the surface was honest by accident — `ladder` is
    empty, so every `ladder.length ?` guard below already declined. The repair
    is to make the asymmetric state take that same road: `null` is the house
    answer for not-known-yet, and the three helpers decline on it (their own
    note explains why that is separate from #391's hidden rung).
  */
  const currentId = status?.planTier ?? null;
  /*
    ⚠ **THE SUBSCRIPTION FACT IS THREE-STATE TOO — #1749's law-7 sweep, and
    this file is where the sharper half of it lives.** #1747 fixed the rung on
    both modals and left this boolean collapsing with `!!` on both, so an
    unanswered `status` still answered *"no subscription"* here.

    ⚠ **WHAT THAT DECIDES ON THIS SURFACE IS WHICH ROAD A PRESS TAKES.**
    `act()` below sends an account with no subscription to Stripe CHECKOUT and
    a subscriber to the confirm step — and `!hasSubscription` put an unread
    subscriber on the checkout road, which creates a SECOND subscription
    instead of changing the one they have.

    ⚠ **IT WAS NOT REACHABLE AND THE SWEEP SAYS SO RATHER THAN CLAIMING THE
    CATCH.** Every caller of `act()` is a button inside `cards` or
    `comparison`, and #1747 made all three ladder helpers decline on a null
    rung — so while the status is unread this surface draws its held line and
    NO plan buttons at all. This is a wrong value behind a gate, which becomes
    a wrong answer the day the gate moves; the same judgement #1747 made about
    `(confirming?.id ?? "starter")` one file over.
  */
  const hasSubscription: boolean | null = status ? status.hasSubscription : null;
  /*
    WHAT ONE FINISHED CHARACTER COSTS — the divisor behind line 4's example
    (#1607, P1-8), in LEDGER credits, off the same `getPlans` the ladder is
    built from.

    ⚠ **THIS READ `credits.getCosts`'s `castingImage` UNTIL NOW, AND THAT IS THE
    LEGACY STUDIO'S PRICE.** `CREDIT_COSTS` is declared as *"not part of the new
    scale"* and its lane has been admin-only since #1654, so the one line on the
    card that told a customer what their money buys was priced off a surface
    they cannot reach. `0` keeps its meaning — not known yet — and the sentence
    declines rather than guessing, exactly as the frames line did.
  */
  const oneCharacterCredits = plans?.oneFinishedCharacterCredits ?? 0;

  /*
    The ladder, derived from the server's own list. `getPlans.subscriptions`
    omits `free` (it is not a Stripe product), so the free rung is folded back
    in from `tiers` — otherwise an account on Free cannot see where it is.
  */
  const ladder = useMemo<LadderPlan[]>(() => {
    if (!plans) return [];
    const byId = new Map(plans.subscriptions.map((entry) => [entry.id as string, entry]));
    const rungs: LadderPlan[] = [];
    for (const id of plans.planOrder) {
      const tier = plans.tiers[id as keyof typeof plans.tiers];
      if (!tier) continue;
      const sub = byId.get(id as string);
      rungs.push({
        id: id as string,
        name: tier.name,
        priceInCents: sub?.priceInCents ?? tier.price,
        credits: sub?.credits ?? tier.monthlyCredits,
        rolloverPercent: tier.rolloverPercent,
      });
    }
    return rungs;
  }, [plans]);

  /*
    #391 — an account on the HIDDEN rung is not on the offered ladder, so the
    header takes its own plan's name from `getStatus` (the own-row read). The
    trio below deliberately falls back to the ladder's first three with
    nothing marked current: there is nothing above the hidden rung to sell,
    and inventing a card for it would publish what he has not priced.
  */
  const currentName =
    ladder.find((plan) => plan.id === currentId)?.name ?? status?.planName ?? null;

  /*
    #385 — the cycle spend is SUMMED from the ledger, never taken off
    `getStatus`, whose only spend field is a lifetime counter. It drives more
    than the copy here: `projected` below feeds `recommendPlan`, so the wrong
    figure chose which rung carried the one ink button.
  */
  const periodStart = status?.currentPeriodStart ? new Date(status.currentPeriodStart) : null;
  const cycleSpend = useCycleSpend(periodStart);
  const cycle = useMemo(
    () => readCycle(status, cycleSpend),
    [status, cycleSpend],
  );
  const burn = useMemo(() => (cycle ? readBurn(cycle) : null), [cycle]);
  const projected = cycle && burn ? Math.round(burn.perDay * cycle.cycleLength) : 0;
  /*
    The `ladder.length` guards are kept exactly as they were — an unread
    CATALOGUE and an unread RUNG are two different absences and each helper
    declines on its own. The helpers answer nothing for a `null` rung, so these
    three go empty in the asymmetric state, which is the same empty the surface
    already drew while `plans` was in flight.
  */
  const recommended = useMemo(
    () => (ladder.length ? recommendPlan(ladder, currentId, projected) : null),
    [ladder, currentId, projected],
  );
  const trio = useMemo(
    () => (ladder.length ? cardTrio(ladder, currentId, recommended) : []),
    [ladder, currentId, recommended],
  );
  const window5 = useMemo(
    () => (ladder.length ? compareWindow(ladder, currentId, recommended) : []),
    [ladder, currentId, recommended],
  );

  /*
    ⚠ **EVERY PRICE ON THIS SURFACE IS A MONTH'S PRICE, IN BOTH INTERVALS**
    (card 390 item 2). The annual toggle used to swap `$159 / month` for
    `$1,584 / year` beside a `2 MONTHS FREE` badge — a tenfold rise standing
    next to a claim of a saving, with nothing on screen to check the claim
    against. The interval now changes the RATE, not the unit, and the year's
    total is shown at the confirm step, which is where it is charged.

    ⚠ **`interval === "annual"` READS A NULL AS MONTHLY, AND THE REASON THAT IS
    NOT THIS CARD'S DEFECT IS STRUCTURAL RATHER THAN LUCKY (#1763).** Every
    caller of this is inside something the pane does not draw while the status
    is unread — `trio` and `window5` are empty on a null rung (#1747), the
    footer's `offered` is null with them, and the comparison table now declines
    on a null cycle outright. The same holds for `switchBillingLabel` and for
    the cards' own `billed yearly` line. **A null never reaches a price**; what
    it would mean if one ever did is written here rather than discovered.
  */
  const priceOf = (plan: LadderPlan) => priceAMonth(plan.priceInCents, interval === "annual");

  /*
    ⚠ **THE INTERVAL RIDES THE MUTATION** — the whole card (#664). A press on
    a subscriber's account opens the confirm step rather than charging: since
    the change is invoiced immediately (`always_invoice`), the figure must be
    read before it is paid. Checkout keeps its own confirm — Stripe's page.
  */
  const act = (plan: LadderPlan) => {
    /* ⚠ #1749: unread is not "no subscription", and the two roads below are
       *buy a new subscription* and *change the one you have*. Unreachable while
       the ladder declines on a null rung (see the declaration); refused here so
       it stays unreachable if it ever is. */
    if (hasSubscription === null) return;
    /* ⚠ #1763: and the CYCLE beside the road, for the same reason and with the
       same reachability. The send below names what a customer is charged and
       over what period, and the card's done-when is that it is never derived
       from an unread status — a yearly subscriber billed monthly by accident is
       the one mistake on this surface that cannot be taken back with a click. */
    if (interval === null) return;
    if (!hasSubscription) {
      setPending(plan.id);
      checkout.mutate({ plan: plan.id as never, interval });
      return;
    }
    setConfirming(plan);
  };

  /* A subscriber's OWN tier can still change its billing cycle — without
     this, the toggle argues annual prices while the rung most people are
     deciding about carries no button at all. */
  const intervalDiffers = hasSubscription === true && billedInterval !== null && interval !== billedInterval;
  const switchBillingLabel =
    interval === "annual" ? "Switch to annual billing" : "Switch to monthly billing";

  /*
    §6c: EXACTLY ONE ink button per view — the next tier up. Everything beyond
    it is a further move rather than the offer being made, and downgrades are
    secondary on purpose.
  */
  /*
    The catalogue answered and the account's own rung did not — the asymmetric
    state this card is about, and the only one in which there is a ladder to
    draw and no way to place the customer on it. While BOTH are unread `ladder`
    is empty and this is false, so the ordinary loading beat is untouched.
  */
  const cannotArrange = ladder.length > 0 && currentId === null;

  const currentIndex = ladder.findIndex((plan) => plan.id === currentId);
  /*
    ⚠ **THE OFFER FALLS BACK TO THE NEXT RUNG WHEN THERE IS NOTHING TO
    RECOMMEND**, and both modes read the SAME value. An account whose plan
    already covers its burn has no `recommended` — correct, and §6d forbids
    drawing `FITS YOUR USE` on a plan they own — but §6c still wants exactly ONE
    ink button in the view, and §6e still wants compare mode's primary in the
    footer because every column button is below the fold. Two modes computing
    "which one is the offer" separately is how they end up disagreeing.
  */
  /*
    ⚠ **AND THIS IS THE READER THE HELPERS CANNOT COVER, because it does its own
    arithmetic on `currentIndex` — #1747.** With the rung unknown `currentIndex`
    is -1, so `currentIndex + 1` is **0** and the fallback reaches for
    `ladder[0]`, which is the FREE rung: the one ink button on a paying
    customer's screen would read *"Upgrade to Free"*. It is the exact opposite
    of an upgrade and it is the loudest thing on the surface.

    So the offer requires a known rung. `recommended` is already `null` then,
    and the fallback is the half that had to be said out loud.
  */
  const offered =
    currentId === null
      ? null
      : recommended ?? ladder.find((plan, index) => index === currentIndex + 1) ?? null;
  const primaryId = offered?.id ?? null;

  return (
    <ModalScrim
      label="Change plan"
      scrimClassName="dp-plan__scrim"
      cardClassName="dp-plan__card"
      busy={false}
      onDismiss={onClose}
    >
      <header className="dp-set__head">
        <span className="dp-set__title">Change plan</span>
        {/*
          ⚠ **THE HEADER SAYS NOTHING UNTIL IT KNOWS**, rather than falling back
          to `Free`. Found by this card's own no-typed-plan-name arm and worth
          keeping on its merits: the fallback ran for the moment between opening
          the modal and `getPlans` landing, so a paying customer's first frame
          read `Free today`. A blank is honest; a wrong plan name on a billing
          surface is the one thing a customer would screenshot.
        */}
        {currentName ? <span className="dp-set__workspace">{currentName} today</span> : null}
        <button
          type="button"
          className="dp-set__close"
          onClick={onClose}
          aria-label="Close change plan"
        >
          <X size={15} strokeWidth={1.7} />
        </button>
      </header>

      <div className="dp-plan__pane">
        {/* §6a — the reason to act. Every figure derived; nothing written. */}
        {cycle && burn && burn.emptyOn && recommended ? (
          <div className="dp-plan__reason">
            <div>
              <p className="dp-plan__reasonhead">
                At this rate you run out on {formatShortDate(burn.emptyOn)}.
              </p>
              <p className="dp-plan__reasonbody">
                {formatCredits(displaySpent(cycle.spent, cycle.remaining))} of {formatCredits(displayBalance(cycle.spent + cycle.remaining))}{" "}
                spent with {cycle.daysLeft} {cycle.daysLeft === 1 ? "day" : "days"} still to go
                {burn.dryDays > 0
                  ? `, which leaves you ${burn.dryDays} ${burn.dryDays === 1 ? "day" : "days"} short of ${formatShortDate(cycle.renewsAt)}`
                  : ""}
                . {recommended.name} covers the way you are actually working, and today&apos;s
                charge is only the difference for the days left.
              </p>
            </div>
            <div className="dp-plan__reasonstat">
              {/*
                ⚠ IT SAID `THIS MONTH` UNTIL #385, OVER A FIGURE WHOSE WINDOW IS
                THE BILLING PERIOD — the founder's own class, in his own words:
                *"two different windows on one line."* Seen in the running app
                the hour the spend below was corrected: the fixture's period
                runs 27 Aug → 27 Sept and the sentence beside this stat already
                names that renewal date, so the label was contradicting its own
                paragraph. The Usage pane says *this billing period* for the
                same window (#381), and one product says one thing.
              */}
              <span className="dp-set__minilabel">THIS BILLING PERIOD</span>
              <p className="dp-plan__credits">
                {formatCredits(displaySpent(cycle.spent, cycle.remaining))} / {formatCredits(displayBalance(cycle.spent + cycle.remaining))}
              </p>
            </div>
          </div>
        ) : null}

        {/* §6b — the interval control */}
        <div className="dp-plan__intervals">
          {/*
            ⚠ **THIS IS THE FOUNDATION'S SEGMENTED CONTROL, NOT A SECOND ONE.**
            The promotion pass found the collision: `.dp-segmented` already
            existed in `foundation.css` with a real consumer (`SurfaceBar`), and
            the first draft of this modal declared a near-identical
            `.dp-plan__segments` beside it. Its rule 6 settles which survives —
            *"the one with real customers wins, not the newer one, not the
            tidier one"* — so the classes here are the foundation's and the
            duplicate block is deleted. The one thing folded IN is that a
            segment may now carry a child (the badge), which the sheet's own
            segments do not use and are unaffected by.

            It is NOT wrapped in `SurfaceBar`: that component is a whole page
            header — eyebrow, title, meta, right slot — and this is one control
            inside a modal. Rule: move the part, not the page it came from.
          */}
          {/*
            ⚠ **IT IS NOT DRAWN UNTIL THE CYCLE IS KNOWN — #1763, and that is
            the same answer #1755 gave the billing toggle on Add credits.**

            `aria-pressed` has two values and BOTH are assertions: `false` on
            Monthly does not say *we have not been told*, it says **this
            customer is not on monthly**, and the filled `--on` segment says it
            again in paint. There is no held position available — a third ARIA
            state would have to mean *partially pressed*, which is a different
            claim — so the honest frame is no control, exactly as this pane
            already declines the ladder (#1747), the reason block and the
            footer button in that same beat.

            **It is one beat and not a permanent hole**: `interval` is null only
            while `billing.getStatus` is in flight, and the pane's own held line
            below covers the same state in words. The *Compare plans* button
            stays, because it asserts nothing about this account.
          */}
          {interval === null ? null : (
            <span className="dp-segmented" role="group" aria-label="Billing interval">
              <button
                type="button"
                className={`dp-segmented__seg${interval === "monthly" ? " dp-segmented__seg--on" : ""}`}
                aria-pressed={interval === "monthly"}
                onClick={() => setIntervalChoice("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`dp-segmented__seg${interval === "annual" ? " dp-segmented__seg--on" : ""}`}
                aria-pressed={interval === "annual"}
                onClick={() => setIntervalChoice("annual")}
              >
                Annual
                <span className="dp-plan__badge">{monthsFree()} MONTHS FREE</span>
              </button>
            </span>
          )}
          <button
            type="button"
            className="dp-plan__modeswitch"
            onClick={() => setCompare((open) => !open)}
          >
            {compare ? "Back to the nearest three" : "Compare plans"}
          </button>
        </div>

        {/* ⚠ #1763: the table prices every column by the cycle and prints
            *"Annual plans are charged once a year"* off it, so it does not open
            on a cycle nobody has read either. While the status is in flight the
            branch below falls to `cannotArrange`, which is this surface's own
            sentence for exactly that state — so the customer reads why rather
            than meeting an empty table. */}
        {compare && interval !== null ? (
          <CompareGrid
            plans={window5}
            currentId={currentId}
            interval={interval}
            oneCharacterCredits={oneCharacterCredits}
            currentIndex={currentIndex}
            ladder={ladder}
            pending={pending}
            onAct={act}
            intervalDiffers={intervalDiffers}
            switchBillingLabel={switchBillingLabel}
          />
        ) : cannotArrange ? (
          /*
            ⚠ **THE SURFACE HAD TO BE LOOKED AT, NOT ONLY READ — working law 6,
            and it is what this block is (#1747).** With the rung unknown the
            ladder correctly draws NOTHING, which claims nothing and is the
            whole point. Rendered, it is a modal with a heading, a billing
            toggle and a hole where the plans were: honest and unreadable, and a
            customer would call it broken rather than loading.

            So one line, in their words, saying what we could not do and what to
            do about it (the disappearing-technology law's refusal clause: a
            refusal says what was refused and what to do). No engine, no query
            name, no code.

            ⚠ **It cannot flash during a normal load**, which is why the
            condition is the CATALOGUE having answered rather than a timer or an
            error flag: both queries ride one batch reply and resolve in the
            same tick, so `ladder` is empty while `status` is unread and this
            branch is unreachable until they come apart. Its stated limit: if
            the two are ever split into separate requests, a fast catalogue and
            a slow status would show this for that gap.
          */
          <p className="dp-plan__held">
            We could not read which plan you are on just now, so there is nothing to
            compare against. Close this and open it again in a moment.
          </p>
        ) : (
          <>
          <div className="dp-plan__grid">
            {trio.map((plan) => {
              const isCurrent = plan.id === currentId;
              const isRecommended = plan.id === recommended?.id;
              const rollover = rolloverSentence(plan.rolloverPercent);
              const example = exampleSentence(charactersFor(plan.credits, oneCharacterCredits));
              const blurb = blurbFor(plan.id);
              const planIndex = ladder.findIndex((entry) => entry.id === plan.id);
              return (
                <article
                  key={plan.id}
                  className={[
                    "dp-plan__tier",
                    isCurrent ? "dp-plan__tier--current" : "",
                    isRecommended ? "dp-plan__tier--fits" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isRecommended ? <span className="dp-plan__tab">FITS YOUR USE</span> : null}
                  <span className="dp-plan__tierhead">
                    <span className="dp-plan__tiername">{plan.name}</span>
                    <span className="dp-plan__unit">
                      {/*
                        ⚠ **THE NOUN IS ON THE CARD AND NOT IN COMPARE MODE**,
                        because compare mode has a row LABEL saying `Credits per
                        dollar` and the card has nothing. The first draft read
                        `3,145 PER $1` — looked at in the running app, it is a
                        number with no unit sitting where `0.036¢ A CREDIT` used
                        to name one. The old figure was hard to read; a nounless
                        one is not readable at all.
                      */}
                      {/*
                        ⚠ **THE RATE READS `priceOf`, WHICH IS THE PRICE
                        PRINTED THREE LINES DOWN** (#661). With Annual on it
                        used to divide by the MONTHLY price while the card
                        showed the monthly EQUIVALENT — `2,778 CREDITS PER $1`
                        standing over `$132 / month`, an arithmetic a customer
                        can do and find wrong. One expression now, so the two
                        move together or neither moves.
                      */}
                      {formatCreditsPerDollar(priceOf(plan), plan.credits)} CREDITS PER $1
                    </span>
                  </span>
                  <span className="dp-plan__price">
                    {formatWholeDollars(priceOf(plan))}
                    <span className="dp-plan__per">/ month</span>
                  </span>
                  {interval === "annual" ? (
                    <span className="dp-plan__interval">billed yearly</span>
                  ) : null}
                  {/*
                    §6c'S BLURB SLOT, FILLED ON HIS WORD (#404). It asks for
                    *"one line, a positioning statement"* saying who the rung
                    is FOR, and it shipped empty from card 390 item 5 until
                    now — what had been filling it was `About N casting
                    frames`, which is what the credits MAKE, and that line is
                    in the credits block below where §6c puts it.

                    ⚠ **THE SEVEN LINES ARE DECLARED PLACEHOLDERS, NOT HIS
                    VOICE**, written by the relay under his own order (*"can
                    you just make it up for now"*) and approved by him for the
                    build (*"Use the seven placeholder lines the relay posted
                    on the card. Build to those."*). They live in one table in
                    `planBlurbs.ts`, which is the file he edits and the only
                    file that moves when he does. None of them claims a
                    capability — they say who a plan is for — so none can be
                    made false by the product changing.
                  */}
                  {blurb ? <span className="dp-plan__blurb">{blurb}</span> : null}
                  {isCurrent && intervalDiffers ? (
                    <Button
                      variant="secondary"
                      disabled={pending === plan.id}
                      onClick={() => act(plan)}
                    >
                      {pending === plan.id ? "Working…" : switchBillingLabel}
                    </Button>
                  ) : isCurrent ? (
                    /*
                      ⚠ **`Current`, NOT `ON THIS ONE`, AND IT IS NO LONGER A
                      BOX** (card 425 item 2). His words: *"the button in the
                      compare table that says ON THIS ONE looks way to oversized
                      or something. could we also called it like current or
                      something better than on this one."*

                      He named compare mode; the class is shared, so the sweep
                      took both (working law 7). The card's instance was the
                      worse of the two and he could not have seen it: `.dp-plan
                      __tier` is a stretch flex column, so an `inline-flex`
                      chip with a border and a wash filled the card's full
                      width and was the largest control on it — a
                      NON-INTERACTIVE marker outweighing the one real button in
                      the view, which is §6c's exact complaint about the modal
                      this replaced.

                      **It keeps the action row's height** so the credits blocks
                      still line up across the three cards. What it loses is the
                      border, the fill and the radius — everything that made a
                      label look pressable.
                    */
                    <span className="dp-plan__here">Current</span>
                  ) : (
                    <Button
                      variant={plan.id === primaryId ? "primary" : "secondary"}
                      disabled={pending === plan.id}
                      onClick={() => act(plan)}
                    >
                      {pending === plan.id
                        ? "Working…"
                        : planIndex > currentIndex
                          ? "Upgrade"
                          : "Downgrade"}
                    </Button>
                  )}
                  {/*
                    §6c's CREDITS BLOCK, in its own order: *"credits + A MONTH;
                    then what it makes; then what expires."* It sits AFTER the
                    action because §6c puts it there — the decision is made on
                    the name, the value and the price, and the detail supports
                    it rather than gating it (card 390 item 1).
                  */}
                  <span className="dp-plan__block">
                    {/*
                      §6c'S CREDITS LINE, REWRITTEN AS RINOA'S LINE 3 (#1607,
                      P1-8): *"15,000 credits a month, one pool for
                      everything."* It was the figure plus the stamp `A MONTH`,
                      and two things were wrong with that pair.

                      ⚠ **THE FIRST IS THAT `A MONTH` WAS FALSE ON THE FREE
                      RUNG.** `PLAN_TIERS.free.monthlyCredits` is a ONE-TIME
                      signup grant — its own declaration says so — so a free
                      account read *"2,700 A MONTH"* about 2,700 credits that
                      arrive once. `creditsTail` derives the arrival from the
                      PRICE rather than from the rung's name.

                      ⚠ **THE SECOND IS THAT A CREDIT COUNT WITH NO SENTENCE
                      AROUND IT DOES NOT SAY WHETHER IT IS ONE POOL OR SIX.**
                      His approved page answers that in the line itself, which
                      matters while the per-use buckets on it stay Phase 2.

                      **The figure keeps its own weight and the sentence is
                      lighter** — the card's *"second and lighter"*. `2.8M`
                      above a million is `formatCredits`'s doing and needed no
                      new formatter.
                    */}
                    <span className="dp-plan__credits">
                      <span className="dp-plan__creditsfigure">
                        {formatCredits(displayBalance(plan.credits))}
                      </span>{" "}
                      {creditsTail(plan.priceInCents)}
                    </span>
                    {/*
                      LINE 4 — the worked example (#1607). It replaced *"About
                      N casting frames."*, which named the pipeline's unit for a
                      sheet slice and was priced off the LEGACY studio's
                      `castingImage`. A finished character is Roll + Refine +
                      Sign, derived server-side from the three live prices
                      (`CASTING_V2_ONE_CHARACTER_CREDITS`).

                      ⚠ **It keeps `.dp-plan__makes`, and the class is still
                      honest**: card 390 item 5's finding was that what the
                      credits MAKE had been standing in the positioning slot,
                      and this is still that fact in still that place. The
                      guard arm holding it reads the class and its position,
                      both unchanged.

                      `null` draws nothing — `blurbFor`'s rule, for the same
                      reason: *"about 0 finished characters"* is worse than
                      silence.
                    */}
                    {example ? <span className="dp-plan__makes">{example}</span> : null}
                    <span
                      className={
                        rollover.isLoss
                          ? "dp-plan__rollover dp-plan__rollover--loss"
                          : "dp-plan__rollover"
                      }
                    >
                      {rollover.text}
                    </span>
                  </span>
                  {/*
                    §6c'S PERK ROW, BACK ON HIS WORD (card 425 item 1) — and
                    it comes back LAST rather than where it used to sit.
                    Card 390 item 1 moved the action into the middle because
                    §6c's order is name + unit → price → blurb → action →
                    credits block → **perks**; the pre-390 list ran ABOVE the
                    action, which is the position §6c does not ask for. So this
                    is his row at the brief's own place, not a straight revert.

                    ⚠ **One row today, and that is the honest state.** It is a
                    slot, and he said so: the day a benefit actually moves per
                    rung, it joins this list and the footnote below follows the
                    same constant.
                  */}
                  <span className="dp-plan__perks">
                    <span className="dp-plan__perk">
                      <Check size={12} strokeWidth={1.8} aria-hidden="true" />
                      {EVERY_PLAN_PERK}
                    </span>
                  </span>
                </article>
              );
            })}
          </div>
          {/*
            ⚠ **CARD MODE'S FOOTNOTE IS GONE, AND ITS REMOVAL IS THE SAME EDIT
            AS THE TICK RETURNING** (card 425 item 1). It existed only because
            card 390 took the tick off the cards — its own comment said so:
            *"it is not lost: it moves to the footnote."* With the row back on
            every card, keeping it here would state one fact THIRTEEN times in
            one pane, which is the duplication card 390 was actually removing.
            Compare mode keeps its footnote: a table has no per-column perk row,
            so under the table is the only place the sentence can go.
          */}
          </>
        )}

        <p className="dp-plan__trust">{TRUST_LINE}</p>

        {/*
          #391 — THE HIDDEN TOP RUNG'S DOOR, and it is deliberately just an
          email (his ruling, verbatim: "just an email link for now, keep it
          simple. they request a higher limit and we can send them the link if
          we approve"). One quiet line, under the ladder in BOTH modes; it
          names no plan and no price — a rung he has not decided to publish
          must not be advertised by its own escape hatch. Do NOT grow this
          into a form, a request table, or a greyed-out card: each was
          considered on the card and declined by name.
        */}
        <p className="dp-plan__request">
          Need a higher limit?{" "}
          <a
            className="dp-plan__request-link"
            href="mailto:support@klieglabs.com?subject=A%20higher%20plan"
          >
            Write to support@klieglabs.com
          </a>{" "}
          — larger plans are arranged personally.
        </p>

        {/* §6f — the honest version of "Expand credit limit" */}
        <div className="dp-plan__cross">
          <span className="dp-set__rowtext">
            <span className="dp-set__label">Just need more credits</span>
            <span className="dp-set__note">
              Pick an amount and the plan moves with it — same thing, fewer decisions.
            </span>
          </span>
          <span className="dp-set__spacer" />
          <Button variant="secondary" size="small" onClick={onAddCredits}>
            Add credits
          </Button>
        </div>
      </div>

      <footer className="dp-plan__foot">
        <span className="dp-plan__help">Having a problem? Go to the help centre.</span>
        <span className="dp-set__spacer" />
        {/* ⚠ #1749: `=== true` rather than truthy. The unread state declines
            either way — hiding a control is the safe direction — and it is
            spelled so the next reader does not have to work out which of the
            two meanings of `false` this branch was written for. */}
        {hasSubscription === true ? (
          <Button variant="quiet" size="small" onClick={() => setConfirmingDrop(true)}>
            Drop to Free
          </Button>
        ) : null}
        <Button variant="quiet" size="small" onClick={onClose}>
          Close
        </Button>
        {/*
          §6e — in compare mode ONLY, the primary lives in the footer, because
          every column button in the table sits below the fold.
        */}
        {compare && offered && offered.id !== currentId ? (
          <Button
            variant="primary"
            size="small"
            disabled={pending === offered.id}
            onClick={() => act(offered)}
          >
            {/*
              The footer primary quotes the SAME monthly figure the columns do
              — his §6e example is `Upgrade to Agency · $122.58`, which is the
              monthly equivalent and not the year. A button carrying a year's
              total under a table of monthly prices is the tenfold read again,
              on the one control most likely to be pressed.
            */}
            {pending === offered.id
              ? "Working…"
              : `Upgrade to ${offered.name} · ${formatWholeDollars(priceOf(offered))} / mo`}
          </Button>
        ) : null}
      </footer>

      {/* ⚠ #1763: the title NAMES the cycle (`— billed monthly`) and the press
          SENDS it, so the dialog does not open on a cycle nobody has read. It
          is unreachable while the status is in flight — the quote above cannot
          fire without one — and said here because the title is a sentence a
          customer reads beside a charge, not a value behind a gate. */}
      {confirming && changeQuote.data && interval !== null ? (
        <ConfirmDialog
          title={
            interval === "annual"
              ? `${confirming.name} — billed yearly`
              : `${confirming.name} — billed monthly`
          }
          body={describeChange(confirming, changeQuote.data)}
          confirmLabel={
            changeQuote.data.immediateCharge > 0
              ? `Confirm · about ${formatDollars(changeQuote.data.immediateCharge)}`
              : "Confirm change"
          }
          busyLabel="Changing…"
          busy={changePlan.isPending}
          cancelLabel="Not now"
          tone="primary"
          onConfirm={() => {
            if (!confirming) return;
            setPending(confirming.id);
            changePlan.mutate({
              newPlan: confirming.id as never,
              interval,
              clientRequestId: crypto.randomUUID(),
            });
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      {confirmingDrop ? (
        <ConfirmDialog
          title="Drop to Free"
          body="Your subscription ends at the renewal date and the account moves to Free. Credits you have already been given stay on the balance."
          confirmLabel="Drop to Free"
          busyLabel="Cancelling…"
          busy={cancelSubscription.isPending}
          onConfirm={() => cancelSubscription.mutate()}
          onCancel={() => setConfirmingDrop(false)}
        />
      ) : null}
    </ModalScrim>
  );
}

/**
 * §6d — compare mode.
 *
 * **Six rows, value first and price last**, so the gain is established before
 * the number, and *"every row must differ across plans"*: a row where all plans
 * agree carries no decision value and belongs in the footnote. Ours differ by
 * construction — credits, output, unit price and price all move at every rung —
 * and the two the brief lists that DO NOT move for us are in the footnote:
 * seats (there is no membership) and what every plan carries.
 */
function CompareGrid({
  plans,
  currentId,
  interval,
  oneCharacterCredits,
  currentIndex,
  ladder,
  pending,
  onAct,
  intervalDiffers,
  switchBillingLabel,
}: {
  plans: LadderPlan[];
  /* `null` while the account's own rung is unread — #1747. Every `plan.id ===
     currentId` below is then false, which is the answer wanted: no column is
     marked current. `window5` is empty in that state, so the grid draws
     nothing; the type is widened because a prop that cannot be null is a claim
     this surface can no longer make. */
  currentId: string | null;
  interval: Interval;
  oneCharacterCredits: number;
  currentIndex: number;
  ladder: LadderPlan[];
  pending: string | null;
  onAct: (plan: LadderPlan) => void;
  intervalDiffers: boolean;
  switchBillingLabel: string;
}) {
  /* The same one expression the cards read — `Price a month` and `Credits per
     dollar` are two readings of ONE number and must not be computed twice. */
  const priceOf = (plan: LadderPlan) => priceAMonth(plan.priceInCents, interval === "annual");

  const cellClass = (plan: LadderPlan, extra?: string) =>
    [
      "dp-plan__cell",
      extra ?? "",
      plan.id === currentId ? "dp-plan__cell--current" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const rows: { label: string; mono?: boolean; price?: boolean; read: (plan: LadderPlan) => string }[] =
    [
      {
        /*
          ⚠ **THE LABEL LOST `a month`, AND IT IS THE SAME CORRECTION THE CARDS
          TOOK (#1607).** The free column's figure is a one-time signup grant,
          so a row headed *"Credits a month"* stated something false about one
          of its five columns — and a comparison row cannot carry a per-column
          qualifier, which is why the word comes OFF the label rather than
          into the cells. The cards say which it is in their own sentence;
          this table's job is the like-for-like read.
        */
        label: "Credits",
        mono: true,
        read: (plan) => formatCredits(displayBalance(plan.credits)),
      },
      {
        /*
          ⚠ **IT COUNTED FRAMES AT THE LEGACY STUDIO'S PRICE (#1607).** Same
          repair as the cards': a finished character is Roll + Refine + Sign,
          derived from the three prices the studio charges, and `frames` was
          the pipeline's word for a sheet slice.
        */
        label: "What that makes",
        read: (plan) =>
          /* `—` keeps its meaning: the divisor is not known yet, or no whole
             character fits. Both are "nothing to state", and neither is 0.

             ⚠ **THE PHRASE COMES FROM `charactersPhrase` AND IS NOT COMPOSED
             HERE.** It was, for one afternoon, and it read `about 1
             characters` on the free column — a second copy of the card's noun
             rule, which is working law 4 with the shortest drift this
             repository has measured. */
          charactersPhrase(charactersFor(plan.credits, oneCharacterCredits)) ?? "—",
      },
      {
        /*
          ⚠ **THIS ROW AND `Price a month` FOUR ROWS DOWN ARE THE SAME NUMBER
          TWICE** (#661), so they read one `priceOf`. Before, the annual column
          showed `$132` here and a rate divided from `$159` there — the two
          rows contradicted each other inside one table.
        */
        label: "Credits per dollar",
        mono: true,
        read: (plan) => formatCreditsPerDollar(priceOf(plan), plan.credits),
      },
      {
        label: "Unspent credits",
        read: (plan) => rolloverSentence(plan.rolloverPercent).text,
      },
      {
        /*
          ⚠ **THE LABEL DOES NOT MOVE WITH THE TOGGLE** (card 390 item 2, and
          §6d's row 6 says `Price a month` flatly). A comparison whose unit
          changes under the customer is not a comparison; the interval changes
          the RATE and the row goes on measuring the same thing.
        */
        label: "Price a month",
        mono: true,
        price: true,
        read: (plan) => formatWholeDollars(priceOf(plan)),
      },
    ];

  return (
    <div className="dp-plan__compare">
      <div className="dp-plan__comparegrid">
        <span className="dp-plan__cell dp-plan__cell--label" />
        {plans.map((plan) => (
          <span key={plan.id} className={cellClass(plan, "dp-plan__cell--head")}>
            {plan.name}
            {/*
              ⚠ **`FITS YOUR USE` IS NOT DRAWN HERE — HIS RULING, #487, reply
              #115, verbatim and entire:** *"dont show the fits your use tag on
              the compare table it doesnt look right. everything else looks
              good"*.

              §6d used to say the tag OUTRANKS `YOU ARE HERE` in this cell, and
              the card proposed relaying the two markers onto separate lines to
              cure an overlap. He took the shorter answer: the tag comes off the
              table entirely. It is unchanged on the plan CARDS (`:409`), which
              is where he has always seen it and where he did not object — this
              cell was the only place it sat beside a plan name in a five-column
              grid with nothing between them.

              So there is no ordering question left in this cell: the current
              column says `YOU ARE HERE` and every other column says nothing.
            */}
            {plan.id === currentId ? (
              <span className="dp-plan__youarehere">YOU ARE HERE</span>
            ) : null}
          </span>
        ))}

        {rows.map((row) => (
          <ComparisonRow key={row.label} row={row} plans={plans} cellClass={cellClass} />
        ))}

        {/* §6d — "then an action row per column". Every one of them is
            SECONDARY: the single ink button lives in the footer, because the
            table is taller than the pane and a primary here sits below the
            fold. */}
        <span className="dp-plan__cell dp-plan__cell--label" />
        {plans.map((plan) => (
          <span key={plan.id} className={cellClass(plan)}>
            {plan.id === currentId && intervalDiffers ? (
              /* The same offer card mode makes (#664, law 7): the customer's
                 own column is exactly where a billing-cycle switch lives. */
              <Button
                variant="secondary"
                size="small"
                disabled={pending === plan.id}
                onClick={() => onAct(plan)}
              >
                {pending === plan.id ? "Working…" : switchBillingLabel}
              </Button>
            ) : plan.id === currentId ? (
              /* The instance he named (card 425 item 2). This column already
                 says so twice — `.dp-plan__cell--current` tints every cell in
                 it and the head carries `YOU ARE HERE` — so a third statement
                 needs to be the quietest of the three, not a chip with a border
                 sitting in a row of buttons. */
              <span className="dp-plan__here">Current</span>
            ) : (
              <Button
                variant="secondary"
                size="small"
                disabled={pending === plan.id}
                onClick={() => onAct(plan)}
              >
                {pending === plan.id
                  ? "Working…"
                  : ladder.findIndex((entry) => entry.id === plan.id) > currentIndex
                    ? "Upgrade"
                    : "Downgrade"}
              </Button>
            )}
          </span>
        ))}
      </div>
      <p className="dp-plan__footnote">
        {ONE_FOR_EVERY_PLAN}
        {/*
          ⚠ **THE TABLE HAS TO SAY THIS TOO** — found by looking at the frames
          rather than by the arms. Item 2 keeps the row label at `Price a
          month`, which is right: a comparison whose unit moves under the
          customer is not a comparison. But then the annual table shows `$132`
          with nothing anywhere saying the charge arrives once a year, while
          each CARD carries `billed yearly` under its price. A table that omits
          the thing the cards state is the same lie a step quieter.
        */}
        {interval === "annual" ? " Annual plans are charged once a year." : ""}
      </p>
    </div>
  );
}

/*
  The confirm step's sentence, derived from the server's own quote — every
  figure in it is a field the charge is computed from, so the copy and the
  invoice cannot disagree (the prototype's defect, closed at the wire).
  "About" is honest: the quote is day-granular and Stripe prorates to the
  second, so the settled figure can differ by cents.
*/
function describeChange(
  plan: LadderPlan,
  quote: {
    kind: "same-interval" | "interval-switch";
    targetInterval: "monthly" | "annual";
    isUpgrade: boolean;
    immediateCharge: number;
    creditBalance: number;
    newPlanPrice: number;
    daysRemaining: number;
    creditAdjustment: number;
  },
): string {
  if (quote.kind === "interval-switch") {
    if (quote.targetInterval === "annual") {
      return (
        `${plan.name} costs ${formatDollars(quote.newPlanPrice)} for the year. ` +
        `The unused part of your current cycle comes off that, so about ` +
        `${formatDollars(quote.immediateCharge)} is due today. Your new billing year ` +
        `starts now, and the full year of credits lands as soon as the payment settles, ` +
        `replacing what was left of this cycle's allowance.`
      );
    }
    return (
      `${plan.name} moves to ${formatDollars(quote.newPlanPrice)} a month, starting today. ` +
      (quote.immediateCharge > 0
        ? `About ${formatDollars(quote.immediateCharge)} is due today.`
        : `Nothing to pay today — about ${formatDollars(quote.creditBalance)} of unused time ` +
          `becomes credit toward your future bills.`) +
      ` The unused months of credits go back with that refund; this month's allowance takes their place.`
    );
  }
  if (quote.isUpgrade) {
    return (
      `About ${formatDollars(quote.immediateCharge)} is due today — the difference for the ` +
      `${quote.daysRemaining} ${quote.daysRemaining === 1 ? "day" : "days"} left in this cycle.` +
      (quote.creditAdjustment > 0
        ? ` ${formatCredits(displayBalance(quote.creditAdjustment))} credits land on your balance the moment it goes through.`
        : "")
    );
  }
  return (
    `Nothing to pay today. Unused time on your current plan comes back as billing credit — ` +
    `the unused credits that time bought go back with it — and the ${plan.name} allowance ` +
    `starts at your next renewal.`
  );
}

/* `enabled` needs the subscription fact before `hasSubscription` is derived
   below the queries — one tiny reader keeps the two truths one expression.

   ⚠ **THIS ONE STAYS A `boolean` ON PURPOSE — #1749's sweep read it and left
   it.** It answers a query's `enabled`, where *unread* and *no subscription*
   genuinely want the same behaviour: do not ask Stripe to price a plan change
   until we know there is a plan to change. Making it three-state here would
   buy nothing and would put a `null` into a prop typed `boolean`. The name says
   `ForQuote` rather than `hasSubscription` for exactly this reason, and its
   return is the only reader. */
function hasSubscriptionForQuote(status: { hasSubscription?: boolean } | undefined): boolean {
  return !!status?.hasSubscription;
}

function ComparisonRow({
  row,
  plans,
  cellClass,
}: {
  row: { label: string; mono?: boolean; price?: boolean; read: (plan: LadderPlan) => string };
  plans: LadderPlan[];
  cellClass: (plan: LadderPlan, extra?: string) => string;
}) {
  return (
    <>
      <span className="dp-plan__cell dp-plan__cell--label">{row.label}</span>
      {plans.map((plan) => (
        <span
          key={plan.id}
          className={cellClass(
            plan,
            [row.mono ? "dp-plan__cell--mono" : "", row.price ? "dp-plan__cell--price" : ""]
              .filter(Boolean)
              .join(" "),
          )}
        >
          {row.read(plan)}
        </span>
      ))}
    </>
  );
}
