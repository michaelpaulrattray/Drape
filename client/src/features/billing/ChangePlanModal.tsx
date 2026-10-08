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
 * The brief's ladder is five rungs at `2.79¢ … 1.87¢`; ~~**ours is the offered
 * seven** (#391 folded the twelve: four Plus rungs dropped, Ultimate hidden
 * behind the email line below the ladder) at 0.036¢ down to 0.02¢ a credit.~~
 * The population of both modes is derived from `billing.getPlans` in
 * `planLadder.ts` — see its header for the whole reading — and the compare
 * control says `Compare plans` rather than `Compare all 5`.
 *
 * ⚠ **THE RUNG COUNT IN THAT SENTENCE IS SPENT — PRICING PHASE 2 (#1832),
 * 2026-10-03: the self-serve ladder is `free` plus THREE paid rungs
 * (`SELF_SERVE_PLAN_ORDER`), and the rungs above it are the Enterprise band's
 * conversation.** It is struck rather than deleted because the derivation
 * beside it is the half that still holds and is the whole point: both modes
 * still read `billing.getPlans` rather than a count typed here, which is why
 * the ladder shortening by four rungs moved no code on this surface.
 *
 * ⚠ **IT IS ALSO WHY #1850 EXISTS, AND THAT IS THE LESSON WORTH THE
 * PARAGRAPH.** A population that derives survives a ruling; a STRING that
 * described the mechanism does not, and nothing derives a label. *"Back to the
 * nearest three"* outlived the window it named by a day and was found on the
 * next PR rather than by a guard. The sweep for its siblings is in #1850's own
 * body: it is the only CUSTOMER-VISIBLE string on these surfaces that named
 * the window, and this docblock sentence was the only other survivor.
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
 * 4. ~~**The unit price is inverted** to credits per dollar
 *    (`formatCreditsPerDollar`), whole numbers that ASCEND up the ladder.~~
 *    ⚠ **RETIRED BY HIS WORD, 2026-10-02 (#1773) — THERE IS NO RATE ON A
 *    PLAN CARD AND NONE IN THE TABLE.** Verbatim: *"on the free card remove
 *    the free CREDITS PER $1 line thats stupid"*, and on the reading that the
 *    rate belongs on Add credits instead: *"yes i like this"*. Item 4's
 *    *finding* stands and is why nothing replaced it: a sub-penny cost per
 *    credit was not a value argument, and the answer turned out to be that a
 *    plan card is not where the argument goes. **The rate's one home is Add
 *    credits** — `formatCreditsPerDollar` lives on, read there and nowhere
 *    else, which `card390-guard.test.ts` now pins as an asymmetry rather than
 *    the card-403 symmetry it used to hold.
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
import { Fragment, useEffect, useMemo, useState } from "react";
import { displayBalance, displaySpent, formatCredits } from "@shared/creditDisplay";
/* #1836 — the one declaration of who may buy a credit pack, read here so §6f
   and the Add-credits door cannot answer that question differently. */
import { topupEligibility } from "@shared/creditTopups";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { ConfirmDialog } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
  creditStepsPriceAMonth,
  formatDollars,
  formatShortDate,
  formatWholeDollars,
  monthsFree,
  priceAMonth,
  readBurn,
  readCycle,
} from "@/features/settings/planMath";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import {
  charactersFor,
  charactersPhrase,
  creditsTail,
  exampleSentence,
  grantsMonthly,
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

/**
 * WHAT EVERY PLAN OPENS TODAY — said ONCE under the three cards rather than
 * three times inside them (#1832, the design's §3 and §8).
 *
 * ⚠ **EVERY ITEM IS A ROUTE A SIGNED-IN CUSTOMER CAN OPEN RIGHT NOW, read at
 * `App.tsx` rather than assumed** — the casting studio (`/app/casting`), boards
 * (`/app/canvas`), the wardrobe (`/app/garments`) — and the fourth is the Add
 * credits checkout, live since #1606. The heading is **ON EVERY PLAN** and not
 * *on every account*, which is the precise difference `topupEligibility`
 * enforces: credit packs are a plan holder's road, and Free is not a plan.
 *
 * #1607's rule, and it is the one most easily lost when copy gets "better":
 * re-derive every string against present capability before shipping.
 */
const OPEN_TODAY =
  "Casting studio · Boards · Wardrobe · Credit packs whenever you need them";

/**
 * THE FORWARD-LOOKING HALF — his own brief asked for *"way better copy based on
 * future development not just what exists today"*, with anything unshipped
 * marked **coming** (#1774).
 *
 * The cinema studio's description is `CLAUDE.md`'s own sentence for it, and
 * *"we'll say when"* is this product's existing voice for an unshipped thing
 * (`CastSettingsModal.tsx`: *"Not available yet — we'll say when it lands."*).
 *
 * ⚠ **IT NAMES A STUDIO AND TWO GENERATORS, NEVER AN ENGINE.** That is the
 * disappearing-technology law's third question answered in the copy itself: a
 * COMING mark on a thing a customer wants is a promise; a COMING mark on a
 * model name is our homework on their screen.
 */
const COMING_LINE =
  "The cinema studio — write the script, direct the takes, add voice, cut the film — and the image and video generators. We'll say when they land.";

/**
 * THE ENTERPRISE BAND'S BODY (#1833, his brief: *"anything really high would be
 * a sale department chat"*).
 *
 * `[adapted]`, and the named edit is the whole card: the promise is exactly what
 * the shipped line already made — *"larger plans are arranged personally"* —
 * said as a band with an action instead of a quiet sentence with a mailto.
 * Every claim in it is in the tree: invoices exist (`billing.getInvoices`), and
 * *arranged directly* is what #391's email line has promised since it shipped.
 * It names **no price and no allowance**, which is #391's standing rule for
 * these rungs and the reason the band can carry three of them at once.
 */
const ENTERPRISE_BODY =
  "A pool built around your volume, invoiced, and arranged with us directly. Tell us what you are making and we will price it.";

/**
 * WHERE *Let's talk* GOES — the address the product already has.
 *
 * ⚠ **THE DESIGN SAYS *"the sales address (or the contact road the brief
 * names)"* AND THERE IS NO SALES ADDRESS IN THE TREE** — `support@klieglabs.com`
 * is the only address this product uses anywhere (the sign-in page, the frozen-
 * account road, the free-grant refusal, and #391's own line right here). So the
 * band keeps it rather than inventing a mailbox nobody reads, which is the
 * cheapest way to make a *Let's talk* button go nowhere.
 *
 * The subject carries the account's plan and balance so the reply does not have
 * to start by asking. ⚠ **A mailto is composed, so both are
 * `encodeURIComponent`'d** — a plan name is a catalogue string today and the
 * balance is a number, but a subject line assembled from account data is a
 * composition, and `&` in one of them would silently truncate the subject and
 * invent a parameter.
 */
const SALES_EMAIL = "support@klieglabs.com";

/**
 * WHICH RUNG'S NAME AND LINE THE BAND WEARS.
 *
 * ⚠ **A TIER KEY, NOT A NAME, AND THE NAME COMES OFF THE WIRE — card 390's rule
 * and its guard's own sentence: *"no plan name is a literal at all; the whole
 * ladder comes off `billing.getPlans`"*.** `Enterprise` typed here would be the
 * one string on this surface that a rename in `PLAN_TIERS` could strand, which
 * is exactly the drift that arm exists to catch, and it caught this band's first
 * draft.
 *
 * **The band stands for three rungs** — `business`, `scale` and `enterprise`
 * (`ARRANGED_DIRECTLY_PLAN_TIERS`) — and wears the top one's name and audience
 * line because that is the one his brief named the conversation after. So a
 * rename of that rung renames the band WITH it, heading and blurb together off
 * one key, which is the behaviour a reader would expect from a door labelled
 * after a plan.
 */
const BAND_TIER = "enterprise";

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
  /*
    THE CREDIT SLIDER'S THUMB (#1832) — `null` until the customer moves it, so
    the dial opens where their account already sits rather than where a
    constant put it. The same `null` idiom the interval toggle above uses, and
    for the same reason: a default that pre-decides a money question is a lie
    for the beat before the account's own facts arrive.
  */
  const [sliderChoice, setSliderChoice] = useState<number | null>(null);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.billing.getStatus.useQuery();
  const utils = trpc.useUtils();

  /*
    THE SLIDER'S SPEC, OFF THE WIRE — which card carries the dial and how far
    it goes (#1832). `null` while the catalogue is unread; `maxUnits === 0`
    means this product has no dial and nothing draws one.

    ⚠ **NOT A CONSTANT ON THIS SIDE.** Both facts are derived from `PLAN_TIERS`
    on the server (`server/stripe/planCreditSlider.ts`) for `selfServeOrder`'s
    own reason — a client that decided for itself which card was "the biggest
    one" would be a second copy of the ladder on the surface where a
    disagreement is a price in front of a customer.
  */
  const sliderSpec = plans?.creditSlider ?? null;
  const sliderOffered = (sliderSpec?.maxUnits ?? 0) > 0;

  /*
    WHERE THE DIAL ALREADY SITS — read off the subscription, because that is
    what bills (#1832). `undefined` while in flight; `units: null` is the
    server saying it could not read the subscription, which is NOT zero.

    Its own procedure rather than a field on `getStatus`, because the read
    costs a Stripe round trip and `getStatus` is fetched by every signed-in
    surface — the server's note on `getPlanCreditUnits` carries why, including
    that a rung with no dial skips the Stripe call entirely.
  */
  const { data: sliderPosition } = trpc.billing.getPlanCreditUnits.useQuery(undefined, {
    enabled: sliderOffered,
  });

  /*
    THE DIAL'S POSITION, IN ONE EXPRESSION — the customer's own drag if they
    have made one, otherwise where their account sits (#1832).

    ⚠ **`null` MEANS UNREAD AND THE DIAL DECLINES TO DRAW** (#1703's family,
    and this card's own done-when: *no 0, no default pressed*). Three states
    collapse onto two here on purpose: untouched-and-unread declines, and
    untouched-and-read opens at the account's real position — which for an
    account with no subscription is 0, because a fresh checkout genuinely
    starts at the bottom and the server says so rather than this line
    assuming it.

    ⚠ **Declared HERE, above the plan-change quote, because the quote reads
    it** — the dial being bought is part of what the customer is quoted, so
    these three cannot sit further down beside the cards that draw them.
  */
  const sliderUnits: number | null =
    sliderChoice ?? (sliderPosition === undefined ? null : sliderPosition.units);

  /* The dial is on ONE card, named by the server, and only once its position
     is known — so it never flashes at the bottom and then jumps. */
  const sliderOn = (plan: LadderPlan): boolean =>
    sliderOffered && sliderSpec !== null && plan.id === sliderSpec.planId && sliderUnits !== null;

  /* What the dial adds to that card, at the position it is at. 0 everywhere
     else, so every expression below reads one function and no card needs to
     know whether it is the one with the slider. */
  const sliderStepsOn = (plan: LadderPlan): number => (sliderOn(plan) ? (sliderUnits ?? 0) : 0);

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
      /* The dial's position is now a different fact at Stripe (#1832) — and
         `sliderChoice` is dropped with it, so a re-open reads the account
         rather than remembering a drag that has already been bought. */
      setSliderChoice(null);
      void utils.billing.getPlanCreditUnits.invalidate();
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
      /* ⚠ THE DIAL BEING BOUGHT, AND IT IS SENT AS A REAL NUMBER OR NOT AT
         ALL (#1832). The server reads an absent `creditUnits` as *keep the
         dial where it is*, which is what makes a plain interval switch leave
         it alone; sending 0 for an unread dial would quote handing back
         credits the customer is paying for. `sliderOn` is false while the
         position is unread, so `sliderStepsOn` would answer 0 — hence the
         explicit `undefined` rather than leaning on it. */
      creditUnits:
        confirming !== null && sliderOn(confirming) ? sliderStepsOn(confirming) : undefined,
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
    rung. (⚠ The last two are DELETED by #1832 — three rungs are the whole
    individual ladder, so there was nothing left to window. `recommendPlan`
    keeps its `null` refusal and the surface's own `cannotArrange` gate keeps
    the rest; `planLadder.ts`' header carries the reading. The sentence stays in
    the past tense it is written in, because the defect it records is why this
    line is `null`.)

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
    scale"*, so the one line on the card that told a customer what their money
    buys was priced off a road they are not being sold — 350 a frame against the
    200 the studio they use actually charges. `0` keeps its meaning — not known
    yet — and the sentence declines rather than guessing, exactly as the frames
    line did.

    ⚠ **IT SAID *"its lane has been admin-only since #1654"* AND *"a surface
    they cannot reach"*, AND BOTH WERE FALSE** (#1786, 2026-10-02). The repair
    stands on the price mismatch above; the same constant is what the LIVE
    canvas charges, through three `protectedProcedure`s in
    `server/routes/boardOps.ts`.
  */
  const oneCharacterCredits = plans?.oneFinishedCharacterCredits ?? 0;

  /*
    The ladder, derived from the server's own list. `getPlans.subscriptions`
    omits `free` (it is not a Stripe product), so the free rung is folded back
    in from `tiers` — otherwise an account on Free cannot see where it is.

    ⚠ **IT READS `selfServeOrder`, NOT `planOrder` — PRICING PHASE 2 (#1832).**
    The surface draws `free` plus the three individual plans; `business`,
    `scale` and `enterprise` are the Enterprise band's conversation (#1833) and
    `ultimate` was never offered (#391). The narrowing is the SERVER's — one
    declaration in `stripeProducts.ts` — because a `["starter","pro","studio"]`
    typed on this side is a second copy of the ladder, and the day he moves a
    rung the surface and the catalogue would disagree with a price on screen.

    ⚠ **`planOrder` IS STILL READ, FOR ONE THING ONLY: the DIRECTION of a
    move** (`rankOf` below). An account he hand-sells Business is not on this
    ladder, and *Business → Studio* is a downgrade — a fact about the whole
    ladder, which the drawn subset cannot answer.
  */
  const ladder = useMemo<LadderPlan[]>(() => {
    if (!plans) return [];
    const byId = new Map(plans.subscriptions.map((entry) => [entry.id as string, entry]));
    const rungs: LadderPlan[] = [];
    for (const id of plans.selfServeOrder) {
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
    THE ACCOUNT'S OWN MONTHLY PRICE — read for ONE thing: whether its credits
    arrive every period or arrived once (#1832's reason block, through
    `grantsMonthly`).

    It takes the same two roads `currentName` does, in the same order and for the
    same reason: the drawn ladder first, then `getStatus`'s own-row facts for an
    account on a rung this surface does not draw (#391's hidden rung, and every
    arranged-directly rung from this commit). `null` while nothing has answered —
    the sentence declines rather than claiming either arrival.
  */
  /*
    THE BAND'S HEADING, off the wire (card 390's no-literal rule). `null` until
    `getPlans` answers — the band declines rather than naming a rung from a
    constant, which is the same rule the header and the cards already follow.
  */
  const bandName =
    plans?.tiers[BAND_TIER as keyof typeof plans.tiers]?.name ?? null;
  const ownPriceInCents =
    ladder.find((plan) => plan.id === currentId)?.priceInCents ??
    status?.planPriceInCents ??
    null;

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
  /*
    THE THREE CARDS — the paid rungs of the self-serve ladder, and that is the
    whole population (#1832, the design's §3 decision 2).

    ⚠ **FREE IS NOT A CARD, AND IT IS DERIVED FROM THE PRICE RATHER THAN NAMED.**
    *"It is the state you are in, not a plan you buy"* — the reason block at the
    top of the pane already says so with the balance beside it. `priceInCents >
    0` is the same test `creditsTail` and `grantsMonthly` already make about the
    same rung, so a rung's cardness and its own sentence about when credits
    arrive cannot come apart. Free keeps its COLUMN in the compare table, where
    a like-for-like read against where the customer is standing is the point.
  */
  const cards = useMemo(() => ladder.filter((plan) => plan.priceInCents > 0), [ladder]);

  const creditsWithSlider = (plan: LadderPlan): number =>
    plan.credits + planCreditSliderLedgerCredits(sliderStepsOn(plan));

  /*
    THE TOP OF THE DIAL, for the compare table's footnote clause (#1832) — the
    dial's rung at every step, in ledger credits, `null` when there is no dial.

    ⚠ **IT DOES NOT DEPEND ON THE THUMB'S POSITION.** The footnote states what
    the plan CAN reach, which is a fact about the ladder; reading it off
    `sliderUnits` would make a sentence in one view move when somebody dragged
    a control in another.
  */
  const sliderCeilingCredits: number | null =
    !sliderOffered || sliderSpec === null
      ? null
      : (() => {
          const rung = ladder.find((plan) => plan.id === sliderSpec.planId);
          return rung === undefined
            ? null
            : rung.credits + planCreditSliderLedgerCredits(sliderSpec.maxUnits);
        })();

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
    is unread — the cards and the table both decline on a null rung (#1747), the
    footer's `offered` is null with them, and the comparison table now declines
    on a null cycle outright. The same holds for `switchBillingLabel` and for
    the cards' own `billed yearly` line. **A null never reaches a price**; what
    it would mean if one ever did is written here rather than discovered.

    ⚠ **AND THE CREDIT SLIDER'S STEPS ARE IN IT (#1832).** The dial moves the
    price at the top of its card — the design's §3: *"What moves when the thumb
    moves: the price at the top, the credits figure directly above the slider,
    and the 'about N finished characters' line directly below it."* The steps
    go through `creditStepsPriceAMonth`, which lives in `planMath` beside this
    one rather than as a second annual expression on this surface (card 390's
    arm forbids one here); its own docblock carries why it cannot route through
    `monthlyEquivalent`, and the reason is a measured dollar rather than a
    taste. `sliderStepsOn` answers 0 for every other card, so the two other
    cards' prices are the expression they always were.

    ⚠ **THE COMPARE TABLE'S `priceOf` IS DELIBERATELY NOT THIS ONE.** Its
    `Price a month` row is the PLAN's price, like-for-like across four columns;
    a column whose figure moved under a dial on another view is not a
    comparison. The slider's reach into that view is the footnote's clause.
  */
  const priceOf = (plan: LadderPlan) =>
    priceAMonth(plan.priceInCents, interval === "annual")
    + creditStepsPriceAMonth(sliderStepsOn(plan), interval === "annual");

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
    /* ⚠ #1832: and the DIAL beside them, for the same reason again. The card
       with the slider draws no button until its position is known (`sliderOn`
       gates the dial, and `cannotArrange` already gates the cards), so this is
       the value behind a closed door said correctly rather than a branch
       anybody reaches — and a checkout minted at the bottom of a dial the
       customer had set higher is a purchase they did not ask for. */
    if (sliderOffered && sliderSpec !== null && plan.id === sliderSpec.planId && sliderUnits === null) {
      return;
    }
    if (!hasSubscription) {
      setPending(plan.id);
      checkout.mutate({
        plan: plan.id as never,
        interval,
        /* The dial's steps, 0 on every card but its own (#1832). The server
           refuses a count the rung does not sell, and refuses it again at the
           price resolver. */
        creditUnits: sliderStepsOn(plan),
      });
      return;
    }
    setConfirming(plan);
  };

  /*
    THE ENTERPRISE BAND'S ACTION — a mail, carrying what the account already is
    (#1833).

    ⚠ **IT IS A `<button>` RATHER THAN AN ANCHOR, AND THAT IS THE FOUNDATION'S
    RULE RATHER THAN A PREFERENCE.** `primitives.tsx`' own header: *"Every
    interactive affordance is a real <button>"*. The alternative — an `<a>`
    wearing `dp-btn` — is a second copy of the primitive's look, which the
    promotion pass's rule 6 exists to refuse. #391's quiet line keeps being a
    link because it reads as a sentence; this reads as an action.

    ⚠ **NOTHING LEAVES THE APP UNTIL THE CUSTOMER SENDS THE MAIL.** The subject
    is composed into their own mail client; no request is made, no form is
    posted, and the band collects nothing — which is the card's own condition
    (*"never a form that collects card details"*).

    Both pieces are encoded. They are a catalogue name and a number today, and a
    subject line assembled from account data is still a composition: one `&` in
    either would truncate the subject and invent a mailto parameter.
  */
  const openSalesMail = () => {
    const parts = [currentName ? `on ${currentName}` : null, status ? `${formatCredits(displayBalance(status.balance))} credits` : null]
      .filter(Boolean)
      .join(", ");
    const subject = parts ? `Enterprise plan — ${parts}` : "Enterprise plan";
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}`;
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
    THE DIRECTION OF A MOVE — read off the PRICE, not off a position in the drawn
    ladder (#1832).

    ⚠ **IT HAD TO STOP BEING A POSITION, AND THE REASON IS AN ACCOUNT THAT CAN
    NOW EXIST.** The drawn ladder is `free` plus the three individual plans;
    `business`, `scale` and `enterprise` are the Enterprise band's conversation
    (#1833). An account he hand-sells Business is therefore NOT in `ladder`, so
    the old `ladder.findIndex(...) > currentIndex` answered **-1 < every index**
    and labelled every card **Upgrade** — including *Upgrade to Studio*, which
    for a Business account is a drop in allowance and in price at once.

    **The price answers it for every rung, including the ones this surface does
    not draw**, because `getStatus` serves the account's own price through
    `ownPlanFacts` precisely so an off-ladder account is not captioned from a
    list it is absent from (#391, PR #583 finding 1). `PLAN_TIERS`' prices
    ascend strictly — 0 · 2,700 · 6,800 · 15,900 · 84,000 · 480,000 · 1,500,000
    · 4,800,000 — so *costs more than I pay now* and *is further up the ladder*
    are one fact, and the first is also what the two words mean to a customer.
    The guard suite holds that strictness, so a future price that breaks the
    equivalence reddens instead of quietly mislabelling a button.

    Both figures are the MONTHLY list price, so the comparison is unaffected by
    the interval toggle — `priceOf` divides for display and is not read here.

    `null` only while nothing has answered, and the cards are not drawn then
    (`cannotArrange`). An unrecognised legacy tier value reads as price 0 —
    `ownPlanFacts`' own answer for it — so every card offers an upgrade, which
    is the conservative direction and the same one `creditsTail` already takes
    about that row.
  */
  const isUpgrade = (plan: LadderPlan): boolean | null =>
    ownPriceInCents === null ? null : plan.priceInCents > ownPriceInCents;
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

    ⚠ **AND #1747'S OWN SWEEP MISSED A SECOND WAY INTO THAT EXACT SENTENCE,
    FOUND BY #1832'S REBUILD AND CLOSED HERE (law 7: fix the class).** The
    `currentId === null` guard answers the UNREAD rung. It does not answer a
    rung that is real, read, and simply not on the drawn ladder — #391's hidden
    `ultimate` today, and every arranged-directly rung from this commit — for
    which `currentIndex` is ALSO -1 while `currentId` is a perfectly good
    string. `recommended` is null in that state too (`recommendPlan` refuses on
    `currentIndex < 0`), so the fallback ran and `ladder[0]` is **Free**: an
    account on the top rung the product sells would have been shown *"Upgrade to
    Free"* as its one ink button, with the free card carrying the primary. It
    was never reachable — #391 records zero rows on the hidden rung and nobody
    is hand-sold yet — which is exactly the shape #1747 named: a wrong value
    behind a gate becomes a wrong answer the day the gate moves, and this commit
    is the day it moves, because the band makes those rungs ordinary.

    So the fallback requires the account to be ON the drawn ladder, which is one
    condition stating both facts rather than two guards that can come apart.
  */
  const offered =
    currentIndex < 0
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
        ) : currentName && ownPriceInCents !== null ? (
          /*
            WHERE YOU ARE, when there is no run-out to warn about — #1832, the
            design's §3 frame (*"You are on Free."* with the balance beside
            it).

            ⚠ **IT IS THE SAME SLOT AS THE BURN BLOCK ABOVE, NOT A SECOND ONE,
            AND THE BURN BLOCK WINS WHERE BOTH COULD SPEAK.** §6a's block is the
            stronger sentence by a distance — it names the DAY the credits run
            out and what the change costs — so a surface drawing both would be
            arguing with itself in two paragraphs. This is the branch for the
            state the approved frames were actually taken in: the prototype's
            fixture is on Free, and a free account has no cycle, no burn and no
            run-out date, so §6a drew NOTHING there and the pane opened on a
            billing toggle with no reason beside it.

            ⚠ **AND THAT IS EVERY ACCOUNT ON PRODUCTION TODAY** — the design's
            §1 read it at the rows: six accounts, all free, no subscriber. So
            the block the brief shows him is the block nobody could see.

            It claims nothing it has not been told: `currentName` is `null` until
            `getPlans`/`getStatus` answer (the header's own rule), and the
            balance comes from `status.balance` through the display helper rather
            than from the plan's allowance — what a customer has left is their
            own number, not their rung's.
          */
          <div className="dp-plan__reason dp-plan__reason--plain">
            <div>
              <p className="dp-plan__reasonhead">You are on {currentName}.</p>
              <p className="dp-plan__reasonbody">
                {grantsMonthly(ownPriceInCents)
                  ? "Your credits top up at the start of every billing period."
                  : "Your free credits arrived once when you signed up. A plan tops you up every month."}
              </p>
            </div>
            {status ? (
              <div className="dp-plan__reasonstat">
                <span className="dp-set__minilabel">CREDITS LEFT</span>
                <p className="dp-plan__credits">{formatCredits(displayBalance(status.balance))}</p>
              </div>
            ) : null}
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

            ⚠ **AND ITS RETURN LABEL NAMES WHERE IT GOES, NOT A MECHANISM —
            #1850.** It read *"Back to the nearest three"* until Phase 2, which
            was literal while `compareWindow` showed the five rungs nearest the
            account and the cards showed the nearest three. #1832 deleted that
            window (`planLadder.ts`'s own header: *"three rungs are the whole
            individual ladder, so there is nothing left to window"*), so the
            label was the last survivor of a mechanism that had gone — and it
            told a customer their plan cards were a moving selection out of
            something longer, which is not what the surface does and is the
            machinery showing through a label.
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
            {compare ? "Back to plans" : "Compare plans"}
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
            plans={ladder}
            currentId={currentId}
            interval={interval}
            oneCharacterCredits={oneCharacterCredits}
            pending={pending}
            onAct={act}
            isUpgrade={isUpgrade}
            intervalDiffers={intervalDiffers}
            switchBillingLabel={switchBillingLabel}
            sliderCeilingCredits={sliderCeilingCredits}
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
            {cards.map((plan) => {
              const isCurrent = plan.id === currentId;
              const isRecommended = plan.id === recommended?.id;
              const rollover = rolloverSentence(plan.rolloverPercent);
              /* ⚠ THE DIAL IS IN BOTH FIGURES (#1832). `creditsWithSlider`
                 answers the plan's own credits on every card but the one with
                 the slider, so the other two are the expressions they were. */
              const planCredits = creditsWithSlider(plan);
              const example = exampleSentence(charactersFor(planCredits, oneCharacterCredits));
              const blurb = blurbFor(plan.id);
              const stepUp = isUpgrade(plan);
              const hasDial = sliderOn(plan);
              /*
                ⚠ **HAS THE DIAL ACTUALLY MOVED — because the card a customer
                is ALREADY ON draws no button, and a dial with no button is a
                control that does nothing (#1832).**

                The three branches below were *switch the cycle* / *Current* /
                *Upgrade or Downgrade*, and the slider adds a fourth thing a
                customer can change on the plan they already hold. Without
                this, somebody on the slider's rung could drag the thumb,
                watch the price and the credits move, and find no way to buy
                it — the machinery showing through at the one place on this
                surface that costs money.

                It compares against the SERVED position, not against zero: the
                question is *is this different from what you are paying for*,
                and `sliderPosition.units` is the subscription's own quantity.
                While that is unread `hasDial` is already false.
              */
              const dialMoved = hasDial && sliderUnits !== (sliderPosition?.units ?? null);
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
                  {/*
                    ⚠ **NO RATE ON A PLAN CARD — HIS WORD, 2026-10-02, AND IT
                    RETIRES CARD 390 ITEM 4'S CHIP.** Verbatim on the Free card:
                    *"on the free card remove the free CREDITS PER $1 line thats
                    stupid"*; then, on the reading that the rate belongs on Add
                    credits and not on a plan card at all: *"yes i like this"*.
                    **The slot is ABSENT, not refilled** — the card's done-when
                    asks for nothing in its place.

                    **The free card was the instance; this expression was the
                    class.** `formatCreditsPerDollar` answers the literal
                    `"free"` when there is no divisor, so `free CREDITS PER $1`
                    was one expression meeting a price of 0 rather than a
                    free-card branch — which is why his word about one card
                    takes the chip off all seven. The compare table's `Credits
                    per dollar` row went with it in the same act.

                    ⚠ **THE WRAPPER STAYS, ON ONE CHILD, ON PURPOSE.**
                    `dp-plan__tierhead` is the anchor three guard suites slice
                    the card from (cards 390, 425 and 1607 all do
                    `indexOf("dp-plan__tierhead")`); tidying the wrapper away
                    turns that into `-1` and reds all three for a reason that
                    has nothing to do with what they assert.
                  */}
                  <span className="dp-plan__tierhead">
                    <span className="dp-plan__tiername">{plan.name}</span>
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
                  ) : isCurrent && dialMoved ? (
                    /*
                      THE DIAL'S OWN ACTION ON THE PLAN THE CUSTOMER ALREADY
                      HOLDS (#1832). Without it the slider is a control that
                      does nothing: this card draws `Current` and no button,
                      so somebody on the dial's rung could drag the thumb,
                      watch the price and the credits move, and find no way to
                      buy it — the machinery showing through at the one place
                      on this surface that costs money.

                      ⚠ **IT SITS BELOW THE CYCLE'S BRANCH, AND THE ORDER IS
                      THE PRECEDENCE.** When the cycle AND the dial have both
                      moved, one press changes both — `updateSubscriptionPlan`
                      moves the two subscription items in one update, one
                      proration, one invoice — and the confirm step's figure is
                      the quote for all of it. So the bigger change names the
                      button, and the branch order says so without a nested
                      conditional inside the label.

                      ⚠ **THE LABEL SAYS `monthly`** so it cannot be read as
                      the one-off Add credits road, which sits in this same
                      pane's footer and sells packs rather than an allowance.
                    */
                    <Button
                      variant="secondary"
                      disabled={pending === plan.id}
                      onClick={() => act(plan)}
                    >
                      {pending === plan.id ? "Working…" : "Update monthly credits"}
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
                        : stepUp === false
                          ? "Downgrade"
                          : "Upgrade"}
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
                        {formatCredits(displayBalance(planCredits))}
                      </span>{" "}
                      {creditsTail(plan.priceInCents)}
                    </span>
                    {/*
                      THE CREDIT SLIDER (#1832, his approved brief #1774 §5 —
                      *"3 individual plans the biggest one has a slider for
                      credits"*, at his $9 for each extra 5,000 a month).

                      ⚠ **IT SITS BELOW THE ACTION, INSIDE THE CREDITS BLOCK,
                      AND THAT POSITION WAS DECIDED BY LOOKING** (the design's
                      §3, working law 6 on the prototype): put above the
                      action, it pushed this card's button out of line with
                      the other two, and the grid is `auto-fill` rather than a
                      flex row precisely so the three read like-for-like.

                      ⚠ **IT IS A REAL `<input type="range">`.** The native
                      control is the one a keyboard, a screen reader and a
                      touch drag all already know, and this surface has no
                      business re-implementing one — Add credits' slider is
                      the same element, which is the design's answer to *what
                      must the customer learn*: they have met this control
                      before, at the same step, with the same readout shape.

                      ⚠ **NO STEP COUNT IS ON SCREEN.** The thumb's value is a
                      number of 5,000-credit steps, which is the machinery's
                      unit; what is drawn is the credits figure above it and
                      the characters line below it, both already there and
                      both already the customer's own words. A `34 steps`
                      readout would be the disappearing-technology law's
                      clause 6 — a number they have no basis to act on.
                    */}
                    {hasDial ? (
                      <span className="dp-plan__dial">
                        <input
                          /* The system's one range style, promoted out of
                             Add credits when this became its second real
                             consumer — see the stylesheet's own note. */
                          className="dp-range"
                          type="range"
                          min={0}
                          max={sliderSpec?.maxUnits ?? 0}
                          step={1}
                          value={sliderUnits ?? 0}
                          onChange={(event) =>
                            setSliderChoice(Number(event.currentTarget.value))
                          }
                          aria-label="Extra credits a month"
                          /* What the thumb MEANS, for a screen reader: the
                             allowance, not the step count — the same figure
                             the sighted customer reads above it. */
                          aria-valuetext={`${formatCredits(displayBalance(planCredits))} credits a month`}
                        />
                      </span>
                    ) : null}
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
          {/*
            WHAT EVERY PLAN CARRIES, AND WHAT IS COMING — one block under the
            three cards (#1832, the design's §3).

            ⚠ **IT IS THE ANSWER TO WHAT MADE THE OLD TABLE READ AS A WALL OF
            REPEATS, pointed at the cards.** A fact every rung shares has no
            decision value in a per-rung slot; drawn three times it is noise and
            drawn once under them it is the floor the comparison stands on. The
            per-card tick stays exactly where it is on his #425 word — moving it
            in here would have been tidier and would have undone a ruling.
          */}
          <div className="dp-plan__includes">
            <span className="dp-set__minilabel">ON EVERY PLAN</span>
            <p className="dp-plan__includesline">{OPEN_TODAY}</p>
            <p className="dp-plan__includesline">
              <span className="dp-plan__coming">COMING</span>
              {COMING_LINE}
            </p>
          </div>
          {/*
            THE ENTERPRISE BAND — #1833, and it REPLACES #391's email line
            rather than sitting beside it.

            ⚠ **#391'S RULING IS HONOURED, NOT OVERRULED, AND THE DISTINCTION IS
            WORTH READING.** His 2026-09-05 word was *"just an email link for
            now, keep it simple"*, and the line's own comment said: do not grow
            this into a form, a request table or a greyed-out card — **each of
            which was declined by name.** This is none of the three. It is still
            one email link; what changed is his own brief of 2026-10-02 —
            *"anything really high would be a sale department chat"* — which
            moves three PRICED rungs into the same conversation the hidden rung
            was already in, and a band is what carries three of them without
            publishing a price for any.

            **The one word that matters is "for now".** The band names no price,
            no allowance and no rung — exactly the #391 rule — and collects
            nothing. The action is a mailto, which is the simple road he asked
            for, with the account's own plan and balance in the subject so the
            reply does not open by asking.

            ⚠ **It is drawn in CARD mode only**, where the frames put it. The
            compare table has no Enterprise column on purpose (the design's §4:
            a column of dashes is not a comparison) and its footnote carries the
            sentence instead — so the promise is in both modes and the ACTION is
            in the one the frames show it in.
          */}
          {bandName ? (
            <div className="dp-plan__ent">
              <span className="dp-plan__entbody">
                <span className="dp-plan__tiername">{bandName}</span>
                {blurbFor(BAND_TIER) ? (
                  <span className="dp-plan__blurb">{blurbFor(BAND_TIER)}</span>
                ) : null}
                <span className="dp-plan__entnote">{ENTERPRISE_BODY}</span>
              </span>
              <span className="dp-set__spacer" />
              <Button variant="secondary" size="small" onClick={openSalesMail}>
                Let&apos;s talk
              </Button>
            </div>
          ) : null}
          </>
        )}

        <p className="dp-plan__trust">{TRUST_LINE}</p>

        {/* §6f — the honest version of "Expand credit limit" */}
        {/*
          ⚠ **THE SECOND SENTENCE WENT FALSE THE DAY ADD CREDITS GREW A
          CHECKOUT — #1606 slice 2.** It read *"Pick an amount and the plan
          moves with it — same thing, fewer decisions."* and it was true while
          Add credits had no road into `addTopupCredits` at all (`41a765ea` took
          it in February), so the only way to answer *I need more credits* was
          to move the plan. From this commit a plan holder pressing this button
          buys a one-off pack and their plan does not move — so the sentence
          described the mechanism it no longer uses, on the row whose whole job
          is to say where the button leads.

          The label stays: *Just need more credits* is still exactly what this
          row is for, and is now literally what it does.
        */}
        {/*
          ⚠ **AND IT IS NOT DRAWN TO A FREE ACCOUNT AT ALL — #1836, his word
          2026-10-03:** *"you shouldnt be able to use add credits if your on the
          free plan at all , not sure why i could click the button it should be
          greyed out or only display plans when i click it im in a free
          account"*. **This is the button.** It is the only control in the
          product labelled `Add credits`, and a free account pressing it read a
          surface headed *Add more credits* that offered a plan.

          ⚠ **HIDING IT IS NOT THE SOFT OPTION HERE, IT IS THE TRUE ONE**, and
          the row's own two sentences are why: *"Buy a one-off pack instead"* —
          instead of what? The plans are on this very screen, and the ladder
          above is the only road a free account has. *"your plan stays exactly
          as it is"* — there is no plan to keep. Both clauses are statements
          about a subscriber, so on a free account the row is not merely a wrong
          destination; it is two false sentences and a button that cannot do
          what it says.

          ⚠ **AND IT IS `may-buy` RATHER THAN `!== "free"`, SO AN UNREAD RUNG
          DECLINES.** `topupEligibility` is the one declaration of who may buy a
          pack ({@link shared/creditTopups.ts}), already read by the Add-credits
          door — a second spelling of the same rule one file over is working law
          4 at its smallest. Hiding on unread is the same safe direction `Drop to
          Free` takes below, and the same three-state answer the eight cards
          before it (#1703 → #1755) were each filed about: a subscriber would
          otherwise lose this row for the beat their status is in flight, which
          is the cheap error, where SHOWING it to a free account is the one his
          word forbids.
        */}
        {topupEligibility(status?.planTier) === "may-buy" ? (
          <div className="dp-plan__cross">
            <span className="dp-set__rowtext">
              <span className="dp-set__label">Just need more credits</span>
              <span className="dp-set__note">
                Buy a one-off pack instead — your plan stays exactly as it is.
              </span>
            </span>
            <span className="dp-set__spacer" />
            <Button variant="secondary" size="small" onClick={onAddCredits}>
              Add credits
            </Button>
          </div>
        ) : null}
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
          body={describeChange(
            confirming,
            changeQuote.data,
            /* The allowance the dial is being moved TO — the card's own figure,
               so the sentence and the card cannot disagree (#1832). `null`
               when this plan has no dial, which turns the branch off. */
            sliderOn(confirming) ? creditsWithSlider(confirming) : null,
          )}
          confirmLabel={
            /* ⚠ A refused change offers no Confirm (#1987): a button whose only
               answer is no is the machinery showing. It closes the dialog. */
            changeQuote.data.refusal
              ? "Got it"
              : changeQuote.data.immediateCharge > 0
                ? `Confirm · about ${formatDollars(changeQuote.data.immediateCharge)}`
                : "Confirm change"
          }
          busyLabel="Changing…"
          busy={changePlan.isPending}
          cancelLabel="Not now"
          tone="primary"
          onConfirm={() => {
            if (!confirming) return;
            if (changeQuote.data?.refusal) {
              setConfirming(null);
              return;
            }
            setPending(confirming.id);
            changePlan.mutate({
              newPlan: confirming.id as never,
              interval,
              /* ⚠ THE SAME EXPRESSION THE QUOTE WAS TAKEN WITH (#1832) — and
                 the server clamps and re-quotes it rather than trusting it,
                 so the figure confirmed and the figure charged are one
                 arithmetic. `undefined` is *keep the dial where it is*, which
                 is what a plain cycle switch sends. */
              creditUnits: sliderOn(confirming) ? sliderStepsOn(confirming) : undefined,
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
 * §6d — compare mode, REBUILT TO HIS PHASE 2 BRIEF (#1834).
 *
 * His complaint is the ground, verbatim: *"our compare features needs a way
 * better design"*. The redesign's answer is not a bigger table — it is
 * **groups**, and the reason is the finding in the design's §2, which is the
 * most useful thing in that document:
 *
 * ⚠ **FOUR FACTS DIFFER BETWEEN PLANS. THAT IS THE ENTIRE LIST, READ AT THE
 * CODE.** `planTier` is consulted in exactly three kinds of place — the plan's
 * own facts (`routes/billing.ts`), staff reporting (`db/admin.ts`), and
 * `topupEligibility` (`@shared/creditTopups`). **Nowhere in the product does a
 * plan rung gate a capability**: no per-plan refine cap, no per-plan
 * concurrency, no per-plan view count, no per-plan feature. So the four are the
 * allowance, what the allowance makes, what happens to unspent credits, and
 * whether credit packs may be bought — plus the price.
 *
 * ⚠ **WHICH MAKES A TABLE ORGANISED BY WHAT A CUSTOMER MAKES THE TRAP THIS HAD
 * TO WALK PAST.** It *invites* rows headed *views per cast*, *refines a month*,
 * *rolls at once* — and every one of them would be inventing a difference. His
 * own avoid-list on #1607 says the same thing from the other side: no
 * unlimited, no seat claims, no SLAs, no priority support. **A row exists here
 * only where the plans differ at the code, and `plansRedesign1832-guard.test.ts`
 * derives that row set from the constants, so a fifth identical row cannot be
 * added by hand.**
 *
 * **What the groups fix is the thing he was looking at.** Today's table draws
 * agreement across five columns — a wall of cells that mostly say the same
 * thing. A fact every column shares is now stated ONCE under its group, and a
 * group with one honest line in it is also the labelled slot his #425 ruling
 * asked for: *"eventually i need to make benefits between each plan which will
 * be a reminder for me."*
 *
 * **Value before price**, unchanged from §6d — the gain is established before
 * the number. **No rate row**, on his word of 2026-10-02 (#1773): the rate
 * lives on Add credits and nowhere else. **No Enterprise column** — it has no
 * published price, and a column of dashes is worse than a sentence, so the
 * footnote carries it and the band (#1833) carries the action.
 */
type CompareRow = {
  label: string;
  mono?: boolean;
  price?: boolean;
  read: (plan: LadderPlan) => string;
};

/**
 * A group: a heading, the rows that genuinely differ under it, and the one
 * sentence that is true of every column.
 *
 * `rows` may be EMPTY and that is not a degenerate case — it is the point.
 * *Cinema* and *Help* have nothing that differs by rung, so each is a heading
 * and a line rather than four identical cells; drawing them as rows is exactly
 * what made the old table read as repetition.
 */
type CompareGroup = {
  title: string;
  rows: CompareRow[];
  /** Said once, under the group. `undefined` for a group with nothing to add. */
  note?: string;
  /** Marks the note as unshipped capability — the `COMING` chip (#1774). */
  coming?: boolean;
};

function CompareGrid({
  plans,
  currentId,
  interval,
  oneCharacterCredits,
  pending,
  onAct,
  isUpgrade,
  intervalDiffers,
  switchBillingLabel,
  sliderCeilingCredits,
}: {
  plans: LadderPlan[];
  /* `null` while the account's own rung is unread — #1747. Every `plan.id ===
     currentId` below is then false, which is the answer wanted: no column is
     marked current. The pane declines to draw the table at all in that state
     (`cannotArrange`), so this is the value behind a closed door said
     correctly rather than a branch anybody reaches. */
  currentId: string | null;
  interval: Interval;
  oneCharacterCredits: number;
  pending: string | null;
  onAct: (plan: LadderPlan) => void;
  /* `null` when the direction cannot be known — the table claims neither
     Upgrade nor Downgrade then. #1832's own reading: the account may be on a
     rung this table does not draw. */
  isUpgrade: (plan: LadderPlan) => boolean | null;
  intervalDiffers: boolean;
  switchBillingLabel: string;
  /* The credit slider's ceiling, for the footnote's own clause (#1832) —
     `null` when there is no dial, and the clause is then absent rather than
     quoting a control nobody can find. */
  sliderCeilingCredits: number | null;
}) {
  /* The same one expression the cards read — the head price and the `Price a
     month` row are two readings of ONE number and must not be computed twice
     (#661). */
  const priceOf = (plan: LadderPlan) => priceAMonth(plan.priceInCents, interval === "annual");

  const cellClass = (plan: LadderPlan, extra?: string) =>
    [
      "dp-plan__cell",
      extra ?? "",
      plan.id === currentId ? "dp-plan__cell--current" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const groups: CompareGroup[] = [
    {
      title: "What you make",
      rows: [
        {
          /*
            ⚠ **THE LABEL CARRIES `a month` AND THE CELLS DO NOT QUALIFY
            THEMSELVES** — the opposite of the `Credits` row below, and the
            difference is real rather than a style slip. A free account's grant
            makes about one character ONCE; a plan's allowance makes its figure
            every month. The qualifier belongs where the figure can be wrong,
            and here the group's own note says what a finished character IS, so
            the cells stay numbers and the free column's `—` says nothing false.
          */
          label: "Finished characters a month",
          /* `—` keeps its meaning: the divisor is not known yet, or no whole
             character fits. Both are "nothing to state", and neither is 0.

             ⚠ **THE PHRASE COMES FROM `charactersPhrase` AND IS NOT COMPOSED
             HERE.** It was, for one afternoon, and it read `about 1
             characters` on the free column — a second copy of the card's noun
             rule, which is working law 4 with the shortest drift this
             repository has measured. */
          read: (plan) =>
            charactersPhrase(charactersFor(plan.credits, oneCharacterCredits)) ?? "—",
        },
      ],
      /*
        ⚠ **BOTH HALVES ARE CAPABILITY CLAIMS AND BOTH WERE READ AT THE CODE.**
        The composition is `CASTING_V2_ONE_CHARACTER_CREDITS`' own — Roll +
        Refine + Sign — which is the divisor the cells above divide by, so the
        sentence and the number cannot come apart. **`five` is
        `CAST_PACKAGE_VIEWS.length`**, and no plan rung changes it; the guard
        suite holds the spelled word against that array, so a sixth view
        reddens this sentence rather than quietly making it false.
      */
      note:
        "A finished character is a roll to find her, a refine to correct her, and a sign that fixes her face. Every signed cast comes with the same five views, on every plan.",
    },
    {
      title: "Credits",
      rows: [
        {
          /*
            ⚠ **THE QUALIFIER IS IN THE CELL, NOT THE LABEL, AND THAT IS #1607'S
            FINDING SOLVED RATHER THAN DODGED.** The free column's figure is a
            ONE-TIME signup grant (`FREE_SIGNUP_GRANT_CREDITS`' own
            declaration), so a row headed *"Credits a month"* states something
            false about one of its four columns — which is why #1607 took the
            words off the label. But a bare number then says nothing about WHEN
            it arrives, and a like-for-like read is this table's whole job. A
            per-column qualifier is the honest answer, and it is derived from
            the same `grantsMonthly(priceInCents)` the cards' own sentence
            reads, so the two can never disagree.
          */
          label: "Credits",
          mono: true,
          read: (plan) =>
            `${formatCredits(displayBalance(plan.credits))}${grantsMonthly(plan.priceInCents) ? " a month" : " to start"}`,
        },
        {
          label: "Unspent credits",
          read: (plan) => rolloverSentence(plan.rolloverPercent).text,
        },
        {
          /*
            THE FOURTH DIFFERING FACT (the design's §2), and it is read from the
            RULE rather than from the price. `topupEligibility` is the one
            declaration that decides whether a customer may buy a pack, and it
            is what Add credits' own door asks — so this row cannot drift from
            the behaviour it describes. Its `unread` answer cannot reach here:
            the columns are catalogue rungs, never the account's own, so the
            argument is always a real tier id.
          */
          label: "Buy extra credits",
          read: (plan) =>
            topupEligibility(plan.id) === "may-buy" ? "Any time, in packs" : "On a plan",
        },
      ],
      /*
        One pool: there is one `points.balance` and every tool spends it.

        ⚠ **AND THE NEVER-EXPIRE HALF IS CUT (#1939) — IT WAS TRUE OF THE
        SURFACE IT WAS QUOTED FROM AND FALSE WHERE IT WAS SAID.** The sentence
        read *"… and credits you have paid for never expire"*, quoting Add
        credits' own shipped line (*"Purchased credits never expire"*), which
        #1660 made true of PURCHASED credits: `refreshMonthlyCredits` adds
        `purchasedCreditsRemaining(row)` back whole at every renewal.

        **But this is the plan compare table, and a customer paying for a plan
        has paid for their plan credits too** — and those partly expire on two
        of the three rungs drawn here: `PLAN_TIERS.starter.rolloverPercent` is
        50 and `pro` is 75. **The table says so itself, in the `Unspent
        credits` row of this very group**, which reads through
        `rolloverSentence`: *"Half of anything unspent expires"*, *"A quarter of
        anything unspent expires"*. So the contradiction sat inside ONE table,
        on a money surface, in the one place a customer is choosing between
        those exact rungs.

        What is left says only what is true of every column, which is the whole
        job of a group note. Nothing honest is lost by stopping the sentence
        short: what expires and what does not is already stated PER RUNG by the
        row above, which is where a per-rung fact belongs. Any wider expiry
        wording waits on his separate top-up ruling.
      */
      note: "One pool. Every tool spends the same credits.",
    },
    {
      /*
        HIS BRIEF'S FORWARD-LOOKING HALF, in the table as on the cards: *"way
        better copy based on future development not just what exists today"*,
        with anything unshipped marked **coming**. No rows, because there is
        nothing to compare yet — a heading and one honest line is the labelled
        slot for the day there is.
      */
      title: "Cinema",
      rows: [],
      note: COMING_LINE,
      coming: true,
    },
    {
      /*
        ⚠ **IT CLAIMS NO SLA AND NO PRIORITY SUPPORT, WHICH IS #1607'S
        AVOID-LIST.** The help centre is the same help centre on every plan —
        the pane's own footer says so — and the second sentence is the band's
        promise, not a tier of service.
      */
      title: "Help",
      rows: [],
      note: "The help centre, on every plan. Enterprise is arranged with us directly.",
    },
    {
      title: "Price",
      rows: [
        {
          /*
            ⚠ **THE LABEL DOES NOT MOVE WITH THE TOGGLE** (card 390 item 2, and
            §6d's row 6 says `Price a month` flatly). A comparison whose unit
            changes under the customer is not a comparison; the interval changes
            the RATE and the row goes on measuring the same thing.

            `Free` rather than `$0`: a price of nothing is a word, and the
            column's own name already says it.
          */
          label: "Price a month",
          mono: true,
          price: true,
          read: (plan) =>
            plan.priceInCents === 0 ? "Free" : formatWholeDollars(priceOf(plan)),
        },
      ],
    },
  ];

  /*
    THE ORDER ON A PHONE: the account's own column first, then the ladder.
    Derived from the same `plans` the wide table reads, so the two shapes
    cannot hold different populations — which is the one thing a second layout
    must never be allowed to do (working law 4).
  */
  const phoneOrder = [
    ...plans.filter((plan) => plan.id === currentId),
    ...plans.filter((plan) => plan.id !== currentId),
  ];

  const actionFor = (plan: LadderPlan) => {
    const stepUp = isUpgrade(plan);
    if (plan.id === currentId && intervalDiffers) {
      /* The same offer card mode makes (#664, law 7): the customer's own
         column is exactly where a billing-cycle switch lives. */
      return (
        <Button
          variant="secondary"
          size="small"
          disabled={pending === plan.id}
          onClick={() => onAct(plan)}
        >
          {pending === plan.id ? "Working…" : switchBillingLabel}
        </Button>
      );
    }
    if (plan.id === currentId) {
      /* The instance he named (card 425 item 2). This column already says so
         twice — the tint and `YOU ARE HERE` — so a third statement needs to be
         the quietest of the three, not a chip with a border in a row of
         buttons. */
      return <span className="dp-plan__here">Current</span>;
    }
    /*
      ⚠ **A FREE COLUMN CARRIES NO ACTION, AND THAT IS A DECISION RATHER THAN AN
      OMISSION.** Free is now a column and not a card (#1832), so this is the
      only place a *Downgrade to Free* button could appear — and leaving a plan
      for Free is a SUBSCRIPTION CANCELLATION. It already has a road, in the
      footer, with its own confirm step and its own sentence about what happens
      at the renewal date. A quiet secondary button in a table row would be a
      second way into the one move on this surface that a click cannot take
      back.
    */
    if (plan.priceInCents === 0) return null;
    return (
      <Button
        variant="secondary"
        size="small"
        disabled={pending === plan.id}
        onClick={() => onAct(plan)}
      >
        {pending === plan.id ? "Working…" : stepUp === false ? "Downgrade" : "Upgrade"}
      </Button>
    );
  };

  /* The price under the column's name, so a column can be read without
     scrolling to the Price group — and it is the SAME `priceOf` that group
     states, never a second arithmetic (#661). A rung whose name is its price
     says it once. */
  const headPrice = (plan: LadderPlan) =>
    plan.priceInCents === 0 ? null : (
      <span className="dp-plan__cellprice">{formatWholeDollars(priceOf(plan))}/mo</span>
    );

  return (
    <div className="dp-plan__compare">
      {/*
        ⚠ **TWO SHAPES, ONE DECLARATION — AND THE PHONE ONE IS A DIFFERENT DOM
        RATHER THAN A RESTYLED ONE, BECAUSE A TRANSPOSITION IS NOT A STYLE.**
        The design's §4: *"four columns in 390px is not a comparison, it is a
        row of truncations"*, so a phone gets one block per plan with the rows
        as label/value pairs. Turning cells from row-major into column-major
        blocks means cells leaving their rows, which is not something a media
        query can do to one grid.

        **Both shapes read `groups` above**, so the population, the labels and
        the readings are one declaration and cannot drift; what differs is only
        the arrangement. The hidden shape is `display: none`, which takes it out
        of the accessibility tree as well as out of the paint — so a screen
        reader meets exactly one table, not two.
      */}
      <div className="dp-plan__comparewide">
        <div
          className="dp-plan__comparegrid"
          /* The column count is DERIVED from the population. A typed
             `repeat(4, 1fr)` is the stale figure this program keeps digging out
             of stylesheets, and the self-serve ladder's length is the server's
             to change (`SELF_SERVE_PLAN_ORDER`). */
          style={{ ["--dp-plan-cols" as string]: String(plans.length) }}
        >
          <span className="dp-plan__cell dp-plan__cell--label" />
          {plans.map((plan) => (
            <span key={plan.id} className={cellClass(plan, "dp-plan__cell--head")}>
              {plan.id === currentId ? (
                <span className="dp-plan__youarehere">YOU ARE HERE</span>
              ) : null}
              {plan.name}
              {headPrice(plan)}
            </span>
          ))}

          {groups.map((group) => (
            <Fragment key={group.title}>
              <span className="dp-plan__grouptitle">{group.title}</span>
              {group.rows.map((row) => (
                <ComparisonRow key={row.label} row={row} plans={plans} cellClass={cellClass} />
              ))}
              {group.note === undefined ? null : (
                <p className="dp-plan__groupnote">
                  {group.coming ? <span className="dp-plan__coming">COMING</span> : null}
                  {group.note}
                </p>
              )}
            </Fragment>
          ))}

          {/* §6d — "then an action row per column". Every one of them is
              SECONDARY: the single ink button lives in the footer, because the
              table is taller than the pane and a primary here sits below the
              fold. */}
          <span className="dp-plan__cell dp-plan__cell--label" />
          {plans.map((plan) => (
            <span key={plan.id} className={cellClass(plan)}>
              {actionFor(plan)}
            </span>
          ))}
        </div>
      </div>

      <div className="dp-plan__comparephone">
        {phoneOrder.map((plan) => (
          <div
            key={plan.id}
            className={[
              "dp-plan__cmpcard",
              plan.id === currentId ? "dp-plan__cmpcard--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="dp-plan__cmpcardhead">
              <span className="dp-plan__tiername">{plan.name}</span>
              <span className="dp-set__spacer" />
              {plan.id === currentId ? (
                <span className="dp-plan__youarehere">YOU ARE HERE</span>
              ) : (
                headPrice(plan)
              )}
            </div>
            <dl className="dp-plan__cmppairs">
              {groups.flatMap((group) =>
                group.rows.map((row) => (
                  <div className="dp-plan__cmppair" key={`${group.title}-${row.label}`}>
                    <dt>{row.label}</dt>
                    <dd className={row.mono ? "dp-plan__cell--mono" : undefined}>
                      {row.read(plan)}
                    </dd>
                  </div>
                )),
              )}
            </dl>
            {actionFor(plan)}
          </div>
        ))}
        {/* The group notes collect BELOW the blocks — inside them they would be
            read four times, which is the repetition the groups exist to end.
            Each keeps its group's name, so a sentence still says what it is
            about once it has left its heading. */}
        <div className="dp-plan__includes">
          {groups
            .filter((group) => group.note !== undefined)
            .map((group) => (
              <p className="dp-plan__includesline" key={group.title}>
                <span className="dp-plan__notegroup">{group.title}.</span>{" "}
                {group.coming ? <span className="dp-plan__coming">COMING</span> : null}
                {group.note}
              </p>
            ))}
        </div>
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
        {/*
          ⚠ **AND IT POINTS AT THE RUNGS THAT HAVE NO COLUMN — the design's §4,
          AND THE SLIDER'S CLAUSE HAS LANDED WITH THE SLIDER (#1832).**

          This block carried a note saying the brief's clause about the dial's
          ceiling was deliberately HELD BACK, because quoting a control nobody
          could find would be the stale-figure class with his approval attached
          to it (#1607's rule: re-derive every string against present
          capability before shipping). The dial exists now, so the sentence is
          owed and is here — and `plansRedesign1832-guard`'s arm that held the
          absence is the arm that now holds the presence.

          ⚠ **THE CEILING IS A DERIVED CREDITS FIGURE, NEVER A TYPED ONE.** It
          is the top of the dial on the card next door — base plus every step —
          computed from the served spec, so a price move or a rung added above
          moves it without anybody editing a sentence. `null` means there is no
          dial and the clause is simply absent.

          The plan it names is the top of the drawn ladder, read off the
          population — not the word "Studio", which would go stale the day he
          adds a rung above it, and which his own rename makes a live question
          this week (#1900).
        */}
        {plans.length > 0 && sliderCeilingCredits !== null ? (
          <>
            {" "}
            {plans[plans.length - 1].name} goes up to{" "}
            {formatCredits(displayBalance(sliderCeilingCredits))} credits a month on its own
            slider.
          </>
        ) : null}
        {plans.length > 0 ? (
          <> Need more than {plans[plans.length - 1].name}? Enterprise is arranged with us directly.</>
        ) : null}
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
    /* The dial on each side of the change (#1832) — served by
       `previewPlanChange`, which clamps both to the target rung. */
    currentCreditUnits?: number;
    targetCreditUnits?: number;
    /* Whether this change happens today or at the period boundary, and when
       (#1936) — the server's own answer, so the confirm step and the charge
       cannot disagree about it either. */
    deferred?: boolean;
    effectiveAtSec?: number;
    /* Why this change cannot go ahead, in the server's own sentence — or
       null (#1987). The same words the press would be refused with. */
    refusal?: string | null;
  },
  /**
   * WHAT THE DIAL'S MOVE BUYS, when the dial is the only thing moving (#1832)
   * — the whole monthly allowance at the new position, in ledger credits.
   *
   * ⚠ **THIS BRANCH EXISTS BECAUSE `isUpgrade` IS ABOUT THE RUNG AND THE DIAL
   * BROKE IT — and the sentence it would have reached was wrong in both
   * halves.** A customer on the dial's rung dragging the thumb UP changes
   * neither plan nor cycle, so `quote.isUpgrade` is `false` and the
   * same-interval fall-through below would have told them *"Nothing to pay
   * today. Unused time on your current plan comes back as billing credit"* —
   * while Stripe invoiced them for the extra steps and added credits rather
   * than returning any. The server's own confirmation toast had the mirror
   * image of this defect, fixed in the same commit.
   *
   * `null` means the dial is not what changed, and every sentence below is the
   * one it always was.
   */
  dialAllowanceLedger: number | null,
): string {
  /*
    ⚠ **A CHANGE THE SERVER WILL REFUSE SAYS SO HERE, BEFORE THE PRESS (#1987).**
    Until this branch the confirm step told a customer whose plan was set to end
    that her downgrade "starts on 7 Nov" — and the press then met a refusal. The
    sentence is the server's (`planChangeRefusal`), never composed here, so the
    two cannot say different things. It sits above every other branch because
    nothing below it is true of a change that is not going to happen.
  */
  if (quote.refusal) {
    return quote.refusal;
  }

  /*
    ⚠ **A DECREASE DOES NOT HAPPEN TODAY, AND THIS IS THE ONLY SENTENCE IT EVER
    GETS (#1936).** His option 1: a decrease takes effect at the next renewal,
    with no refund and no credit take-back.

    It sits FIRST, above every other branch, for the reason the server's own
    deferred branch sits above the charge: three of the arms below promise that
    *"unused time comes back as billing credit"*, which was true while the
    change was instant and is false of every change that reaches this line
    today. One sentence at the top is what makes those three unreachable rather
    than merely unlikely — and they are rewritten below as well, because the
    knife-edge instant (a decrease asked for in the second the period ends,
    where the quote is 0 and nothing is deferred) can still reach them.

    No figure is quoted but the date. There is no charge, no credit balance and
    no allowance change TODAY, so the only number that means anything to her is
    when it happens.
  */
  if (quote.deferred && quote.effectiveAtSec) {
    return (
      `${plan.name} starts on ${formatShortDate(new Date(quote.effectiveAtSec * 1000))}. ` +
      `Nothing is charged today, and you keep your current plan and credits until then.`
    );
  }

  const dialMoved =
    quote.kind === "same-interval"
    && quote.currentCreditUnits !== undefined
    && quote.targetCreditUnits !== undefined
    && quote.targetCreditUnits !== quote.currentCreditUnits;
  if (dialMoved && dialAllowanceLedger !== null) {
    const monthlyFigure = formatCredits(displayBalance(dialAllowanceLedger));
    if ((quote.targetCreditUnits ?? 0) > (quote.currentCreditUnits ?? 0)) {
      return (
        `About ${formatDollars(quote.immediateCharge)} is due today — the extra credits for the ` +
        `${quote.daysRemaining} ${quote.daysRemaining === 1 ? "day" : "days"} left in this cycle. ` +
        `${plan.name} then comes with ${monthlyFigure} credits a month` +
        (quote.creditAdjustment > 0
          ? `, and ${formatCredits(displayBalance(quote.creditAdjustment))} credits land on your balance the moment it goes through.`
          : ".")
      );
    }
    /* ⚠ The refund clause that was here is GONE (#1936) — a dial-down returns
       no money and claws back no credits now. Reachable only at the knife
       edge; it says what happens and nothing more. */
    return (
      `Nothing to pay today. ${plan.name} comes with ${monthlyFigure} credits a month from now.`
    );
  }
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
    /* ⚠ The refund clause that closed this sentence is GONE (#1936): a switch
       to monthly hands money back, so it is DEFERRED and answered by the
       sentence at the top of this function. What is left is the knife-edge
       instant, where the charge is positive or zero and nothing comes back. */
    return (
      `${plan.name} moves to ${formatDollars(quote.newPlanPrice)} a month, starting today. ` +
      (quote.immediateCharge > 0
        ? `About ${formatDollars(quote.immediateCharge)} is due today. This month's allowance takes the place of what was left of your year's.`
        : `Nothing to pay today. This month's allowance takes the place of what was left of your year's.`)
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
  /* ⚠ THE PLAIN DOWNGRADE'S SENTENCE, AND IT IS THE THIRD OF THE THREE (#1936).
     It promised the refund AND the credit take-back, which is precisely the
     pair his option 1 removes — so a real downgrade is deferred and never
     arrives here. The knife-edge instant keeps the one clause that is still
     true: the new allowance starts at the renewal. */
  return (
    `Nothing to pay today, and the ${plan.name} allowance starts at your next renewal.`
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
