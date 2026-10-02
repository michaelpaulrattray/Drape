/**
 * ADD CREDITS — *"I need more credits now"* (brief §7).
 *
 * `CreditTopupModal`, on the brief's 436px surface, one decision deep. The
 * mutations are untouched: `previewPlanChange` for the charge,
 * `createSubscriptionCheckout` for an account with no subscription, `changePlan`
 * for one that has.
 *
 * ## Why it is separate from Change plan even though it is the same mutation
 *
 * §1: *"They stay separate because the questions are different: one is
 * deliberative, one is urgent. Someone who has just hit a wall mid-shoot should
 * not be handed a five-column comparison."* This is also why the topbar credits
 * chip opens THIS and not Change plan — someone clicking their balance has a
 * credits question.
 *
 * ## The two rules in §7 that are decisions
 *
 * - **The dropdown defaults to the next tier up.** Somebody opening this needs
 *   more credits; the smallest step that solves it is the right default.
 * - **Name the delta, not the tier** — `+ 9,000 credits a month` is what they
 *   are buying — *"and the tier change is the mechanism, which bullet two
 *   states plainly. This framing is not a euphemism … hiding it would not be."*
 *
 * ## ⚠ The charge and the copy read the SAME two numbers
 *
 * `alignToPreview` re-cuts the cycle from `previewPlanChange`'s own
 * `daysRemaining` / `totalDays` — the pair Stripe's proration was computed from
 * — so the renewal line beside the figure cannot disagree with it. That
 * disagreement is a real defect the brief records from the prototype: hand
 * written dates put *"the 21st"* against a proration of 19/31 days, which
 * implies the 24th.
 *
 * ⚠ **AND THAT WAS TRUE ONLY ONCE THE PREVIEW EXISTED — #1730.** For the held
 * second it had nothing to say, and the sentence rendered anyway, off the
 * unaligned cycle: **"Prorated for the 8 days left in this cycle"** became
 * **"Prorated for the 343 days"** when the quote landed. The paragraph above
 * described the settled state and read as a promise about every state, which
 * is how it survived review. `alignsToPreview` makes the question askable, and
 * the renewal line asks it before it says anything.
 *
 * ## ⚠ AND THE OTHER SENTENCE IS NOT ABOUT THE CHARGE AT ALL — #1739
 *
 * The burn band says how long the balance they already hold will last. That is
 * a claim about THIS account's own period, so it is the one sentence here the
 * quote's period must never reach: a monthly subscriber reading the Annual
 * option was told *"343 days left in this cycle"* and *"80 days before it
 * resets"* about a balance that resets in 8. The two readings are `ownCycle`
 * and `chargeCycle` below, and the comment there carries the measurement.
 *
 * ⚠ **The two repairs are one shape read twice**: #1730 asked WHETHER the
 * quote has spoken before quoting it, #1739 asks WHICH sentence may listen.
 *
 * ## ⚠ AND THE DELTA ITSELF WAS IN THE WRONG UNIT ON THE BOTTOM RUNG — #1761
 *
 * Every `+ N credits a month` here is a subtraction, and on the free rung the
 * figure it subtracted is a ONE-TIME signup grant. So the pane's one headline
 * number mixed units: a monthly allowance minus a one-off, printed as monthly.
 * A free account read **"+ 11,300 credits a month"** where Starter's whole
 * allowance is **14,000**.
 *
 * ⚠ **IT IS NOT THE THREE-STATE SHAPE THE EIGHT CARDS ABOVE ARE ABOUT.** Every
 * figure involved had been read and none of them was null; the arithmetic was
 * simply over two different kinds of number. `currentMonthlyCredits` below is
 * the one baseline all three sentences take, and *monthly* is derived from the
 * PRICE through `planLadder`'s `grantsMonthly` — the same declaration the plan
 * cards' arrival word has used since #1607.
 */
import { useMemo, useState } from "react";
import { displayBalance, displaySpent, formatCredits } from "@shared/creditDisplay";
import {
  TOPUP_MAX_UNITS,
  TOPUP_PACKS,
  bestValueTopupUnits,
  isSellableTopupUnits,
  topupEligibility,
  topupLedgerCredits,
  topupPriceInCents,
} from "@shared/creditTopups";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { LabelledField } from "@/foundation/LabelledField";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
  alignsToPreview,
  alignToPreview,
  annualPrice,
  formatCreditsPerDollar,
  formatDollars,
  formatShortDate,
  monthsFree,
  priceAMonth,
  readBurn,
  readCycle,
} from "@/features/settings/planMath";
import { charactersFor, charactersPhrase, grantsMonthly } from "@/features/settings/planLadder";
import { useCycleSpend } from "./useCycleSpend";

/**
 * ⚠ **ONE SENTENCE, TWO SURFACES — #1734.** The picker and the button below it
 * both have to say what is true of an account with no rung above its own, and
 * the card's own requirement is that they AGREE. Two copies of four words agree
 * until somebody edits one of them, which is working law 4 at its smallest; one
 * constant agrees by construction.
 */
const NO_HIGHER_PLAN = "No higher plan";

/**
 * THE UPGRADE OFFER — what an account with NO PLAN is shown here (#1606).
 *
 * ⚠ **IT WAS THE WHOLE OF THIS SURFACE UNTIL NOW, AND IT IS KEPT WORD FOR WORD
 * RATHER THAN REPLACED.** Until the credit packs existed there was no road into
 * `addTopupCredits` at all (`41a765ea` took it in February), so *"I need more
 * credits now"* could only ever be answered with a bigger plan. The packs
 * answer it directly for a plan holder; this pane is the branch the card's own
 * sentence names — *"Free accounts are offered an upgrade, not a pack."*
 *
 * ⚠ **AND ITS SUBSCRIBER CLAUSES ARE UNREACHABLE FROM THIS SURFACE NOW, WHICH
 * IS STATED RATHER THAN QUIETLY LEFT** (working law 7's sweep: when a road
 * closes, ask what was bolted to it). A plan holder reaching Add credits gets
 * the packs, so the proration basis (#1730), the interval-switch renewal line
 * (#664) and the inert-until-quoted gate (#1725) can no longer be drawn here —
 * `previewPlanChange`'s own `enabled` has always required
 * `hasSubscription === true`. **Not one line of them is removed**, for two
 * reasons that point the same way: their subject is live on `ChangePlanModal`,
 * which is where a subscriber now changes a plan and which the nudge under the
 * packs leads to; and a free account whose subscription row appears mid-session
 * takes exactly those branches. Deleting them would be retiring correct
 * controls to fit a route change, which is the class this repository has paid
 * for three times.
 */
function PlanStepUpPane({ onClose }: { onClose: () => void }) {
  /* ⚠ The toggle opens on the interval the customer is BILLED on (#664) —
     `null` until they touch it, so an annual subscriber is not shown a
     monthly purchase they did not choose. */
  const [annualChoice, setAnnualChoice] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();
  const utils = trpc.useUtils();

  /*
    ⚠ **AN UNREAD BILLING INTERVAL IS NOT "MONTHLY" — #1755, and it is the
    EIGHTH instance of this shape on this surface** (#1703, #1725, #1727,
    #1730, #1741, #1747, #1749 before it). This read

        annualChoice ?? status?.billingInterval === "year"

    and `status?.billingInterval` is `undefined` while the query is in flight,
    so `=== "year"` answered **false** — the same two meanings of `false` the
    seven cards above it are about, on a different field.

    ⚠ **#664's OWN COMMENT THREE LINES UP SAYS THIS IS THE THING TO PREVENT**:
    the toggle opens on the interval the customer is BILLED on, and
    `annualChoice` is `null` until they touch it *"so an annual subscriber is
    not shown a monthly purchase they did not choose"*. The `??` fallback did
    exactly that for the unread beat, which is the half #664 could not see
    because it was looking at the choice rather than at the read.

    `null` is this surface's house answer for not-known-yet — the balance
    (#1703), the charge (#1725), the rung (#1747), the subscription (#1749) —
    and the type is what makes every reader below answer in its own words
    rather than inherit a guess. Three of them are reachable while unread and
    each one says what it does about `null` where it stands.
  */
  const annual: boolean | null =
    annualChoice ?? (status ? status.billingInterval === "year" : null);

  /*
    ⚠ **AN UNREAD PLAN IS NOT THE FREE PLAN — #1747, the sibling of the same
    line on `ChangePlanModal` and of #1746's repair in Settings.**

    This read `?? "free"`, and on THIS surface the free rung is the bottom of
    the ladder, so the default did not merely mis-name a plan — it made **every
    paid rung read as above the customer's own**. A Pro subscriber opening Add
    credits was offered a pre-selected **Starter** top-up, a rung *below* the
    one they pay for, with its `+ N credits a month` computed against the FREE
    grant rather than their own allowance.

    ⚠ **AND IT IS PERMANENT RATHER THAN A BEAT.** `getPlans` and `getStatus`
    ride one batched request, but a tRPC batch reply carries one entry per call
    and either can fail alone — `getPlans` is a constant fold, `getStatus` reads
    the database. Nothing here retries or refuses, so `plans` answered beside an
    unanswered `status` holds for the life of the surface.
  */
  const currentId = status?.planTier ?? null;
  /*
    ⚠ **AN UNREAD SUBSCRIPTION IS NOT "NO SUBSCRIPTION" — #1749, and it is
    the line above ONE TYPE OVER.** #1747 made the unread PLAN representable
    and left this beside it still collapsing with `!!`, so the same unanswered
    `status` that can no longer mis-name a rung could still answer *"this
    customer has no subscription"* — which is the sentence the renewal line
    below reads off it. A paying subscriber was told **"Charged today, then on
    the same date each period."**, the checkout road's sentence, true of a new
    subscription and false of theirs.

    ⚠ **IT IS THREE-STATE AT THE POINT OF USE RATHER THAN GATED AT THE ONE
    OFFENDING LINE, and that is the whole repair.** Seven readers take this
    fact, and six of them are right today **by construction rather than by
    intent**: `options` is empty while `currentId` is null (#1747's doing), so
    `selected` and `selectedId` are null, so the figure em-dashes, the button
    is inert and `submit` cannot fire. Not one of those six says so. Gating the
    renewal line alone would leave the next reader of a `boolean` named
    *hasSubscription* to discover for itself that `false` has two meanings —
    the shape this card is the sixth instance of (#1703, #1725, #1727, #1730,
    #1741, #1747). With `boolean | null` the compiler asks every site, and each
    one answers in its own words below.

    `planRead` is DERIVED from it, never a second read of `status` — working
    law 4 at its smallest. The renewal line's yearly clause needs *has the
    status answered* rather than *is there a subscription*, and two reads of one
    query drift the moment one of them is edited.
  */
  const hasSubscription: boolean | null = status ? status.hasSubscription : null;
  const planRead = hasSubscription !== null;
  /*
    WHAT ONE FINISHED CHARACTER COSTS — the divisor behind the §7.3 bullet that
    says what the extra credits make, in LEDGER credits, off the same
    `getPlans` the options list is built from (#1758).

    ⚠ **THIS SURFACE DIVIDED BY `credits.getCosts`'s `castingImage` UNTIL NOW,
    AND THAT IS THE LEGACY STUDIO'S PRICE.** `CREDIT_COSTS` is declared in
    `castingCreditCosts.ts` as *"not part of the new scale"*, so the one
    sentence here telling a customer what their money buys was priced off a road
    they are not being sold — at 350 a frame against the 200 the studio they use
    actually charges, every figure read low by more than half. #1607 took the
    same defect off the plan cards one file over; this is its sibling, and the
    two surfaces now divide by one server-derived number rather than by two.

    ⚠ **THIS PARAGRAPH ALSO SAID the lane *"has been admin-only since #1654"*
    AND CALLED IT *"a surface they cannot reach"*, AND BOTH WERE FALSE** (#1786,
    2026-10-02). The repair is unaffected — the price-mismatch sentence above
    was always the real defect and is the whole of it. What was wrong is the
    reachability: the same constant is what the LIVE canvas charges, through
    three `protectedProcedure`s in `server/routes/boardOps.ts`, and
    `credits.getCosts` itself is a `publicProcedure`.

    `0` keeps its meaning — not known yet — and the bullet declines rather than
    guessing, exactly as it did while the price list was unread.
  */
  const oneCharacterCredits = plans?.oneFinishedCharacterCredits ?? 0;

  /* Every rung ABOVE the current one — the only ones that add credits. */
  const options = useMemo(() => {
    if (!plans) return [] as { id: string; name: string; credits: number; price: number }[];
    /* ⚠ Which rungs are ABOVE this account is unanswerable until we know which
       rung it is on, and `indexOf(null)` answering -1 happens to take the right
       road below — so this line is here to say it on purpose rather than by
       luck, and to keep the type honest (#1747). */
    if (currentId === null) return [];
    const order = plans.planOrder as string[];
    const currentIndex = order.indexOf(currentId);
    /* #391 — an account on the hidden rung is not on the offered ladder;
       indexOf answers -1 and every offered rung would then read as "above",
       turning downgrades into a top-up offer. There is nothing to add from
       up there, so the honest answer is no options. */
    if (currentIndex < 0) return [];
    /*
      ⚠ **A THIRD COPY OF THE DELTA LIVED HERE AND NOTHING HAS EVER READ IT —
      #1761.** The row carried `delta: entry.credits - currentCredits` beside a
      `currentCredits` read for it alone, and the annotation on the empty-array
      branch above does not even list the field: the delta is computed once
      below, the option list does its own subtraction in the JSX, and a grep for
      a per-row `delta` over this surface answers nothing. It is removed rather
      than corrected — a mirror of a figure three lines of arithmetic away is
      working law 4, and a WRONG mirror is what the next reader of this memo
      would have copied.
    */
    return plans.subscriptions
      .filter((entry) => order.indexOf(entry.id as string) > currentIndex)
      .map((entry) => ({
        id: entry.id as string,
        name: entry.name,
        credits: entry.credits,
        price: entry.priceInCents,
      }));
  }, [plans, currentId]);

  const selectedId = chosen ?? options[0]?.id ?? null;
  const selected = options.find((entry) => entry.id === selectedId) ?? null;

  /*
    ⚠ **AN EMPTY LADDER HAS TWO OPPOSITE CAUSES, AND THE PANE SAID THE SAME
    THING ABOUT BOTH — #1734.**

    `options` is `[]` when the catalogue has not answered AND when it has and
    this account is already at the top of it, so `selected` is null either way.
    The button then fell through to **"Checking the charge…"**, which is true of
    the first and a permanent lie about the second: the pane offers only the
    rungs ABOVE this account's own, so with none, `selectedId` is null,
    `previewPlanChange` never runs (its `enabled` says so), `dueToday` stays
    null — and the label sits there claiming a check that has nothing to check.
    Two ways in: the TOP rung, and a rung that is not on the offered ladder at
    all (#391's hidden one, where `currentIndex` is -1).

    Reachability, measured rather than assumed: **nobody can hit this on
    production today** — six accounts, all free, read for #1609's receipts on
    2026-10-01, and a free account always has rungs above it. Which is why it is
    a small fix and not an urgent one.

    ⚠ **AND THE PICKER ABOVE HAD THE SAME DEFECT POINTING THE OTHER WAY.** It
    drew **"No higher plan"** whenever `selected` was null, so a free account
    read *there is nothing above you* for the beat the catalogue was loading —
    which is the opposite of true. Fixing only the button would have made the
    two DISAGREE during that beat, which is worse than today; they say one
    thing because they read one fact and share one constant.
  */
  /*
    ⚠ **#1747 — THE EMPTY LADDER HAS A THIRD CAUSE, AND IT ARRIVES THROUGH THE
    ONE DOOR #1734's FIX LEFT OPEN.** That card separated *"the catalogue has
    not answered"* from *"there is nothing above you"* and gated the claim on
    `plans`. An unread RUNG is neither: `options` is empty because we do not
    know where the account stands, and with `plans` answered the old
    `Boolean(plans)` called that **"No higher plan"** — told to a Pro
    subscriber, which is the opposite of true and the same wrong direction
    #1734 recorded on the picker.

    So `laddered` is *"we know enough to say what is above you"*, which needs
    both facts. Without the rung it takes the em-dash road the unread catalogue
    already takes, and the button below waits on the same constant — they say
    one thing because they read one fact.
  */
  const laddered = Boolean(plans) && currentId !== null;
  const nothingAbove = laddered && options.length === 0;

  /* The interval rides the preview (#664), so `due today` below is the
     charge for the purchase the toggle describes — not the monthly figure
     wearing an annual page. */
  /*
    ⚠ **WHETHER A QUOTE IS COMING AT ALL — the query's own door, read once and
    used twice (#1730).** The renewal line below needs exactly this fact to tell
    *we have not been told yet* from *there is nothing to tell*, and a copy of
    the condition beside the query is the mirror working law 4 is about. It is
    the query's `enabled`, so the two cannot drift.

    The pane offers only the rungs ABOVE this account's own, so `selectedId` is
    null when there are none — the top rung, or a rung that is not on the
    offered ladder at all (#391's hidden one). Then the preview never runs and
    no quote is ever coming.
  */
  /*
    ⚠ **`annual !== null` IS A NO-OP TODAY AND IT IS STATED ANYWAY — #1755.**
    `hasSubscription === true` already implies the status answered, which is
    exactly when `annual` stops being null, so this gate can never be the one
    that closes. It is here because *what interval is this quote for* is a
    money question, and the card's done-when asks that no charge road derive
    its interval from an unread status — a claim held by an implication is a
    claim that dies the day either side of the implication moves. The same
    judgement `submit` states one screen down.
  */
  const quoteEnabled = hasSubscription === true && annual !== null && !!selectedId;
  const { data: preview, isError: previewFailed } = trpc.billing.previewPlanChange.useQuery(
    /* `annual === true`, not `annual ?`: an unread interval must not read as
       monthly here. The query cannot fire in that state — see the gate above —
       so this is the value behind a closed door said correctly rather than a
       branch anybody reaches. */
    { newPlan: selectedId as never, interval: annual === true ? "annual" : "monthly" },
    { enabled: quoteEnabled },
  );
  /* Enabled AND still trying: a failed read is not a read on its way. */
  const quoteComing = quoteEnabled && !previewFailed;

  /*
    #385 — the cycle spend is SUMMED from the ledger, never taken off
    `getStatus`, whose only spend field is a lifetime counter. `null` while it
    loads, which `readCycle` carries through as no rate rather than a zero one.
  */
  const periodStart = status?.currentPeriodStart ? new Date(status.currentPeriodStart) : null;
  const cycleSpend = useCycleSpend(periodStart);
  /*
    ⚠ **TWO CYCLES, AND THE NAMES ARE THE FIX — #1739.** This surface says two
    things about time, and only one of them is about the charge:

    · `ownCycle` — THIS account's billing period, off `getStatus`. The burn
      band (§7.1) is about today's balance and the day it resets, so this is the
      only basis that sentence can have.
    · `chargeCycle` — the period the quote prorated over, re-cut by
      `alignToPreview`. The renewal line (§7.4) stands beside the figure we are
      about to charge and must quote the server's own two numbers.

    They were `rawCycle` and `cycle` until #1739, and the burn band read the
    second one. **So a monthly subscriber with the Annual toggle on read the
    YEARLY plan's cycle in a sentence about the plan they are already on** —
    driven on the dev subscriber fixture: *"320 of 4,008 spent with 8 days left
    in this cycle — … runs out on 22 Jun."* became *"… 343 days left in this
    cycle — … runs out on 22 Jun, 80 days before it resets."* the beat the
    yearly quote landed, for an account whose balance resets in 8 days. Nothing
    was charged wrongly and no figure moved; the sentence was about the wrong
    month, and the `80 days before it resets` clause only exists because of it.

    ⚠ **THE GENERIC NAME IS WHAT LET IT HAPPEN.** `cycle` reads like *the*
    cycle, so a sentence needing this account's period reached for it and the
    mistake was invisible at the call site — which is why this is a rename and
    not a one-word repair. `burn` is computed from `ownCycle` here rather than
    at its reader, so a later sentence cannot be handed the quote's period by
    accident either.

    ⚠ **THE SIBLING WAS READ, NOT ASSUMED (law 7's sweep).**
    `alignToPreview` has exactly ONE caller in the product and it is this line;
    `ChangePlanModal` passes `readCycle` straight to `readBurn`, so its own burn
    band has always described the account's own cycle. `burnCycle1739-guard.test.ts`
    pins that too, so the sibling cannot quietly acquire the defect later.
  */
  const ownCycle = useMemo(
    () => readCycle(status, cycleSpend),
    [status, cycleSpend],
  );
  const chargeCycle = useMemo(
    () => (ownCycle ? alignToPreview(ownCycle, preview) : null),
    [ownCycle, preview],
  );
  const burn = useMemo(() => (ownCycle ? readBurn(ownCycle) : null), [ownCycle]);

  /*
    ⚠ **A LOOKUP KEYED ON A RUNG NOBODY HAS READ ANSWERED OUT OF THE FREE ROW,
    AND `?? 0` COULD NOT TELL THAT FROM A REAL ZERO — #1747.** Both figures
    below are now `null` until the rung is known, so a delta or a rate quoted
    against them has to decline rather than quietly use another plan's numbers.
  */
  const currentCredits =
    currentId === null
      ? null
      : plans?.tiers[currentId as keyof typeof plans.tiers]?.monthlyCredits ?? null;
  /*
    ⚠ A FREE PLAN HAS NO RATE TO BE BEATEN, so there is nothing to say "up
    from" about — seen in the running app on a free account, where the sentence
    read *"2,778 credits per $1, up from free"*. The old cents-per-credit
    sentence had the same shape (*"down from free"*) and #403 is the commit
    that rewrites it, so it is corrected here rather than filed. On a paid plan
    the comparison is real and the clause is drawn.
  */
  /* Named rather than inlined at the clause below: the 'up from' comparison
     needs BOTH figures, and spelling all three checks inside the JSX made
     the sentence unreadable and pushed the credit census's extraction past
     its window. One name says what the condition means. */
  const currentPrice =
    currentId === null
      ? null
      : plans?.tiers[currentId as keyof typeof plans.tiers]?.price ?? null;
  /*
    ⚠ **WHAT THIS ACCOUNT ALREADY GETS EVERY MONTH — AND ON THE FREE RUNG THE
    ANSWER IS NOTHING, WHICH IS NOT THE SAME AS 13,500 (#1761).**

    `currentCredits` above is the rung's declared `monthlyCredits`, and on the
    free rung that column is a **ONE-TIME signup grant** — its own declaration
    in `drizzle/schema.ts` says so, verbatim: *"`monthlyCredits` is a ONE-TIME
    signup grant on this rung and nothing else reads it as monthly"*. Every
    `+ N credits a month` on this pane subtracted it from a real monthly
    allowance and printed the difference as a monthly figure, so a free account
    opening Add credits read **"+ 11,300 credits a month"** where Starter's
    whole allowance is **14,000** — told it would get 2,700 fewer credits a
    month than it actually would, on the one line the brief's §7.2 calls the
    decision (*"name the DELTA, not the tier"*).

    ⚠ **IT IS ONLY WRONG ON THE FREE RUNG, AND THE REPAIR IS A NO-OP ABOVE IT.**
    Every paid rung's `monthlyCredits` really is monthly, so `grantsMonthly`
    answers true and this is `currentCredits` unchanged — a Starter subscriber
    reading the Pro option gets the same figure it got before. The free rung's
    baseline is **0**, which makes the delta the target rung's own allowance,
    and that figure is independently the one the ledger writes: the subscription
    grant's own line is `amount: monthlyCredits` (`refreshMonthlyCredits`,
    `server/db/billing.ts`), so the bullet below saying those credits *land on
    your balance* now names the number the transaction will.

    ⚠ **THE TEST IS THE PRICE, AND IT IS `planLadder`'s DECLARATION RATHER THAN
    A SECOND COPY OF IT.** `creditsTail` has drawn the plan cards' arrival word
    off the price since #1607 and for the same reason — a rung with nothing
    recurring to charge has nothing recurring to grant, whatever it is next
    called. Keying on `currentId === "free"` would be the fixed list his N3
    principle rules out, and keying on it HERE while the cards key on the price
    is the drift working law 4 is about.

    `null` keeps the one meaning it has everywhere on this surface — the rung or
    the catalogue is unread (#1747) — because the free rung's answer is a real
    0 rather than an absence. The two states stay distinguishable, which is the
    discipline eight cards on this pane have paid for (#1703, #1725, #1727,
    #1730, #1741, #1747, #1749, #1755).
  */
  const currentMonthlyCredits =
    currentCredits === null || currentPrice === null
      ? null
      : grantsMonthly(currentPrice)
        ? currentCredits
        : 0;

  /* A delta against an unknown allowance is a number with no meaning, not a
     zero — `null` so the sentences below drop rather than print `+ 0`. */
  const delta =
    selected && currentMonthlyCredits !== null
      ? selected.credits - currentMonthlyCredits
      : null;

  /* A rate is only comparable against a plan we have actually been told about. */
  const rateComparable = currentPrice !== null && currentPrice > 0 && currentCredits !== null;

  const fullYear = selected ? selected.price * 12 : 0;
  /*
    ⚠ **A CHARGE NOBODY HAS READ YET IS NOT A CHARGE OF ZERO — #1725, and it is
    #1703 one noun over.** `preview?.immediateCharge ?? 0` printed a 30px
    tabular **"$0.00 due today"** for the beat the quote was in flight, and the
    figure that replaced it was **$852.33** — measured on the dev subscriber
    fixture, both themes, before this line changed. #1703 fixed the same idiom
    on `balance` the day before and its guard is scoped to that noun, so it
    could not see a charge.

    `null` is the house answer for not-known-yet and the figure draws an em dash
    (`BoardHeader`, `UserCard`, `StudioSlimHeader`). **Both branches take it, not
    only the subscriber's**: a customer with no subscription reads `selected`
    out of `plans`, so before that query answers `selected` is `null` and the
    old `: 0` printed the same confident zero on the checkout road — the same
    defect, one branch over, and it would have survived a fix aimed only at the
    line the card named.
  */
  /* ⚠ #1749: the unread state is named FIRST rather than falling into the
     checkout branch. It lands on `null` either way today — `selected` is null
     while the rung is unknown — but *which road a charge is on* is not a
     question an unanswered query may be asked, and the branch it fell into is
     the one that quotes a brand-new subscription's full price. */
  const dueToday: number | null =
    hasSubscription === null
      ? null
      : hasSubscription
        ? (preview?.immediateCharge ?? null)
        : selected
          /* ⚠ #1755: `annual === true`, not `annual ?`. `selected` is null while
             the rung is unread, so this branch is unreachable in that state —
             but the figure under it is a PRICE, and a price quoted at a guessed
             interval is the defect this card is about. Said correctly where it
             stands rather than argued from the gate above it. */
          ? annual === true
            ? annualPrice(selected.price)
            : selected.price
          : null;

  const checkout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.info("Opening checkout…");
      setWorking(false);
      onClose();
    },
    onError: (error) => {
      logRawFailure("billing.createSubscriptionCheckout", error);
      toast.error(readableFailure(error, "Checkout could not be opened. Please try again."));
      setWorking(false);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setWorking(false);
      void utils.credits.getBalance.invalidate();
      void utils.billing.getStatus.invalidate();
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
      setWorking(false);
    },
  });

  /*
    ⚠ A SUBSCRIBER'S BUTTON IS INERT UNTIL ITS QUOTE EXISTS (#664 review
    finding 4). The charge is immediate now (`always_invoice`), and before
    this gate a click that beat the preview fired the real mutation under a
    button reading `Add credits · $0.00` — a purchase confirmed against a
    figure nobody had.

    ⚠ **AND `dueToday !== null` IS THE SAME SENTENCE SAID ONCE RATHER THAN
    TWICE (#1725).** The gate below asked whether the PREVIEW had answered; the
    button then printed `dueToday`, which is a different question on the
    checkout road — `!hasSubscription` made this `true` immediately, so a
    customer whose plan catalogue had not arrived read `Add credits · $0.00` on
    an enabled-looking button. Deriving the gate from the figure it guards is
    working law 4: one source, and the button cannot state a price the figure
    does not have.
  */
  const quoteReady = dueToday !== null && (hasSubscription === false || (!!preview && !previewFailed));

  const submit = () => {
    /* ⚠ #1749: `hasSubscription === null` is unreachable here while `quoteReady`
       is derived from a figure that is null without the rung — and it is stated
       anyway, because the two roads below are *buy a subscription* and *change
       the one you have*, and picking between them on an unanswered query is the
       one mistake on this surface that spends the customer's money. */
    /* ⚠ #1755: and `annual === null` beside it, for the same reason and with
       the same reachability. The two sends below name an INTERVAL — what the
       customer is charged and over what period — and the card's done-when is
       that it is never derived from an unread status. `quoteReady` keeps this
       unreachable today; the day either gate moves, this is the line that
       decides whether a yearly subscriber is billed monthly by accident. */
    if (!selected || !quoteReady || hasSubscription === null || annual === null) return;
    setWorking(true);
    if (!hasSubscription) {
      checkout.mutate({
        plan: selected.id as never,
        interval: annual ? "annual" : "monthly",
      });
      return;
    }
    changePlan.mutate({
      newPlan: selected.id as never,
      interval: annual ? "annual" : "monthly",
      clientRequestId: crypto.randomUUID(),
    });
  };

  /*
    `null` rather than 0: "up from about 0" is a claim about an allowance
    nobody has read (#1747), and a rung whose credits cover no finished
    character has nothing to compare either.

    The NOUN is said once, by `charactersPhrase`, and the clause after the comma
    carries the bare count — which is how the sentence read before and is the
    reason the phrase helper exists at all: the compare grid composed its own
    copy of the plural rule and printed `about 1 characters` (#1607, law 6).
    A second copy here would be the same mistake in the same feature.

    ⚠ **AND IT IS THE MONTHLY BASELINE IT COUNTS, WHICH MAKES THE FREE RUNG
    DECLINE RATHER THAN ANSWER (#1761).** The sentence this feeds is *"That is
    about 5 finished characters **a month**, up from about 1"*, and off the raw
    `monthlyCredits` that `up from` was a count of what the ONE-TIME signup
    grant covers — a figure that arrives once, said inside a clause governed by
    *a month*. On the free rung the baseline is 0, `charactersFor` answers 0, and
    0 is falsy where the clause is drawn, so the sentence loses its comparison
    and keeps its claim: a free account reads what the plan makes a month and is
    told nothing false about what it has now.

    It is `rateComparable`'s reasoning one noun over — *a free plan has no rate
    to be beaten* — and the same answer: there is nothing to be `up from`.
  */
  const nowCount =
    currentMonthlyCredits === null
      ? null
      : charactersFor(currentMonthlyCredits, oneCharacterCredits);
  const nextPhrase = selected
    ? charactersPhrase(charactersFor(selected.credits, oneCharacterCredits))
    : null;

  return (
    <ModalScrim
      label="Add more credits"
      scrimClassName="dp-topup__scrim"
      cardClassName="dp-topup__card"
      busy={working}
      onDismiss={onClose}
    >
      <div className="dp-topup__pane">
        <p className="dp-topup__eyebrow">CREDITS</p>
        <h2 className="dp-topup__title">Add more credits</h2>

        {/* §7.1 — the reason, from the same four constants as §6a, and all four
            off THIS account's own cycle (#1739): this sentence is about the
            balance they hold today, never about the plan they are looking at. */}
        {ownCycle && burn?.emptyOn ? (
          <p className="dp-topup__reason">
            {formatCredits(displaySpent(ownCycle.spent, ownCycle.remaining))} of {formatCredits(displayBalance(ownCycle.spent + ownCycle.remaining))}{" "}
            spent with {ownCycle.daysLeft} {ownCycle.daysLeft === 1 ? "day" : "days"} left in this cycle
            — at this rate the balance runs out on {formatShortDate(burn.emptyOn)}
            {burn.dryDays > 0
              ? `, ${burn.dryDays} ${burn.dryDays === 1 ? "day" : "days"} before it resets`
              : ""}
            .
          </p>
        ) : status ? (
          <p className="dp-topup__reason">
            {formatCredits(displayBalance(status.balance))} credits on the balance today.
          </p>
        ) : (
          /*
            ⚠ **NOT KNOWN YET IS NOT ZERO — #1703, and this is the surface it
            was measured on.** `status?.balance ?? 0` told a customer holding
            3,688 credits that they had **"0 credits on the balance today."** for
            about a second, under the one heading whose entire job is to talk
            about their balance — while the header chip above it read 3,688.

            A sentence cannot be em-dashed the way a figure can (`BoardHeader`,
            `UsageSection`, the two chips in this PR), so the honest shape here
            is to say NOTHING until the server has answered. It is one render
            beat, the modal's title and price already stand without it, and the
            sentence that replaces it a beat later is the real one. The
            alternative — a skeleton — would reserve space for a claim we do not
            have yet, which is the same confidence in a thinner coat.
          */
          null
        )}

        <div className="dp-topup__adjust">
          {/*
            ⚠ **THE ROW IS NOT DRAWN UNTIL THE INTERVAL IS KNOWN — #1755, and
            this is the one reader of it a customer could actually SEE.**

            A `role="switch"` has two states and both of them are assertions:
            `aria-checked={false}` does not mean *we have not been told*, it
            means **this customer is on monthly**. So for the beat
            `billing.getStatus` was in flight, a yearly subscriber opened Add
            credits and the control said they were billed monthly, then flipped
            under them when the status landed.

            ⚠ **A HELD STATE WAS CONSIDERED AND IS NOT AVAILABLE HERE.**
            `aria-checked="mixed"` is the obvious third position and ARIA does
            not allow it on `switch` — only on `checkbox` and
            `menuitemcheckbox` — so a held toggle would be an invalid state,
            announced to a screen reader as something else entirely. The card
            offers the other road in its own words (*"or the surface declines
            to draw the billing-adjustment row at all"*) and that is this.

            It is the same answer this pane already gives four times over: the
            balance sentence draws nothing until `status` answers (#1703), the
            charge draws an em dash (#1725), the button holds (#1734), the
            renewal line says nothing (#1749). **The price row below stays**,
            because its em dash is already the honest shape and hiding it would
            move the figure out of its slot.

            ⚠ **AND THE CLICK GOES WITH IT, WHICH IS HALF THE REPAIR.**
            `setAnnualChoice(!annual)` on a `null` reads `!null === true`, so a
            customer pressing a control that LOOKS off would have chosen
            ANNUAL — a purchase decision made by a negation over a value
            nobody had.
          */}
          {annual !== null ? (
            <div className="dp-topup__adjustrow">
              <span className="dp-set__label">Billing adjustment</span>
              <span className="dp-set__spacer" />
              <span className="dp-set__note">Annual</span>
              <span className="dp-plan__badge">{monthsFree()} MONTHS FREE</span>
              <button
                type="button"
                className="dp-set__toggle"
                role="switch"
                aria-checked={annual}
                aria-label="Pay yearly"
                onClick={() => setAnnualChoice(!annual)}
              />
            </div>
          ) : null}

          <div className="dp-topup__pricerow">
            {/*
              ⚠ **`annual === true`, NOT `annual &&` — #1755.** The struck
              full-year price declines while the status is unread either way
              today, and the card reads the reason as `fullYear > 0`; read at
              the code it is actually `hasSubscription === false`, which is
              `null === false` and therefore already false. **Both readings
              agree it declines and both are the wrong thing to rest on**: the
              gate that should carry it is the interval itself, because this
              line exists to strike out a year's list price BECAUSE the
              customer chose annual, and an unread interval is not a choice.
            */}
            {annual === true && hasSubscription === false && fullYear > 0 ? (
              <span className="dp-topup__struck">{formatDollars(fullYear)}</span>
            ) : null}
            {/*
              ⚠ **AN EM DASH, NOT `$0.00` — #1725.** The figure keeps its own
              slot and its own type size, so nothing below it moves when the
              real charge lands; what it declines to do is name a price it has
              not been told. `due today` stays beside it on purpose — the row
              still says WHAT the number will be, which is the honest half.
            */}
            <span className="dp-topup__due">{dueToday !== null ? formatDollars(dueToday) : "—"}</span>
            <span className="dp-topup__duenote">due today</span>
          </div>

          {/*
            ⚠ THE UNIT PRICE IS ON ITS OWN LINE, NOT RIGHT-ALIGNED BESIDE THE
            FIGURE. §7.2 draws it beside; at 436px it does not fit — a 30px
            tabular figure plus `due today` plus two unit prices ran past the
            card and clipped on `overflow: hidden`, which is §3 rule 2's failure
            in a different guise. Seen in the running app before it shipped.
          */}
          {/*
            ⚠ ONE FACT, ONE UNIT, ON BOTH BILLING SURFACES (#403). Change plan
            argues value as credits per dollar since card 390 item 4; this said
            the same thing in cents per credit, so a customer opening both in
            one session met one fact in two units — §6b's own rule about the
            annual badge, in a different place.
          */}
          {/*
            ⚠ **THE RATE FOLLOWS THE TOGGLE, BECAUSE THE PRICE ABOVE IT DOES**
            (#661). Turning Annual on changed the charge and left this sentence
            quoting the monthly rate, so the line UNDERSTATED what was being
            bought — two of the twelve months are free, which is precisely a
            better credits-per-dollar rate, and the one line that exists to say
            so did not say it.

            ⚠ **BOTH SIDES MOVE, OR THE COMPARISON LIES THE OTHER WAY.** An
            annual figure held up against a monthly one would OVERSTATE the
            gain by the discount, which is the direction that misleads. This
            reads the ladder at the interval the customer is looking at — a
            like-for-like rung comparison, not a claim about how they are
            billed today, which this surface does not know.

            ⚠ **AND IT DOES REPRODUCE FROM THE YEAR'S CHARGE ABOVE, WHICH IS
            THE OBVIOUS OBJECTION.** The big figure here is a YEAR (`due
            today`), while the rate is per month — but credits per dollar is
            the same number over either period as long as both sides use one:
            a year's credits over a year's dollars is `credits × 12` over
            `annualPrice / 100`, which is exactly `credits` over
            `monthlyEquivalent / 100`. That scale-invariance is why this unit
            can sit on a yearly confirm step and a monthly plan card and mean
            the same thing on both.
          */}
          {selected ? (
            <span className="dp-set__value">
              {/* ⚠ #1755: `annual === true` on both halves. `selected` is null
                  until the rung is read, so neither is reachable on an unread
                  status — and a RATE quoted at a guessed interval is still the
                  wrong number, so the narrowing is written where it is read
                  rather than inferred from the guard above. */}
              {formatCreditsPerDollar(priceAMonth(selected.price, annual === true), selected.credits)}{" "}
              credits per $1
              {rateComparable
                ? `, up from ${formatCreditsPerDollar(priceAMonth(currentPrice, annual === true), currentCredits)}`
                : null}
            </span>
          ) : null}

          {/* §7.2 — name the DELTA, not the tier. */}
          <div>
            <button
              type="button"
              className="dp-topup__select"
              aria-expanded={open}
              onClick={() => setOpen((isOpen) => !isOpen)}
            >
              {/*
                ⚠ Three states, not two (#1734). An empty ladder is "the
                catalogue has not answered" as often as it is "there is nothing
                above you", and this said the second about both — a free account
                read `No higher plan` for the beat `getPlans` was in flight. An
                em dash is the house answer for a slot whose content is not yet
                known, and it is what the button beside it waits on too.
              */}
              {selected && delta !== null
                ? `+ ${formatCredits(displayBalance(delta))} credits a month`
                : nothingAbove
                  ? NO_HIGHER_PLAN
                  : "—"}
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
            {open ? (
              <div className="dp-topup__options" role="listbox">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="dp-topup__option"
                    role="option"
                    aria-selected={option.id === selectedId}
                    onClick={() => {
                      setChosen(option.id);
                      setOpen(false);
                    }}
                  >
                    {/* ⚠ #1761: the monthly baseline, not the rung's raw
                        `monthlyCredits` — on the free rung that column is a
                        one-time grant and this sentence says `a month`. The
                        button above reads the same figure through `delta`. */}
                    {currentMonthlyCredits === null
                      ? "—"
                      : `+ ${formatCredits(displayBalance(option.credits - currentMonthlyCredits))} credits a month`}
                    <span className="dp-topup__optionprice">
                      {/* ⚠ #1755: the options list is empty until the rung is
                          read (#1747), so an unread interval cannot reach
                          here — said as `annual === true` all the same,
                          because every other price on this pane is. */}
                      {formatDollars(annual === true ? annualPrice(option.price) : option.price)}
                      {annual === true ? " / yr" : " / mo"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* §7.3 — what lands now, what it makes, how to reverse it. */}
        <div className="dp-topup__bullets">
          <span className="dp-topup__bullet">
            <Check size={12} strokeWidth={1.8} />
            {delta !== null && delta > 0
              ? `${formatCredits(displayBalance(delta))} credits land on your balance the moment this goes through — nothing to wait for.`
              : "Your balance updates the moment this goes through."}
          </span>
          {/*
            ⚠ **THE NOUN IS `finished characters`, AND IT CHANGED WITH THE
            DIVISOR RATHER THAN BESIDE IT (#1758).** This read *"about N casting
            frames a month"* — the pipeline's word for the unit a sheet slice
            bills in, which is also the only unit the legacy per-frame price
            could answer in. Divided by what a finished character costs, the
            honest noun is the one the plan cards already use; `charactersPhrase`
            is the single declaration of it, so the two surfaces cannot come to
            disagree about what a customer's credits make.

            `null` draws nothing, which is that helper's own rule: a plan whose
            credits do not cover one finished character has no claim to make,
            and *"about 0"* is a worse sentence than silence.
          */}
          {nextPhrase && selected ? (
            <span className="dp-topup__bullet">
              <Check size={12} strokeWidth={1.8} />
              That is {nextPhrase} a month
              {nowCount ? `, up from about ${nowCount.toLocaleString()}` : ""} — you
              would move to {selected.name}.
            </span>
          ) : null}
          <span className="dp-topup__bullet">
            <Check size={12} strokeWidth={1.8} />
            Move back down any time. Downgrades take effect at renewal, so you are never locked
            in.
          </span>
        </div>

        {/* §7.4 — the renewal line, branching on interval. An interval
            switch resets the cycle (#664), so quoting the OLD renewal date
            beside it would be the prototype's date-vs-charge defect again. */}
        {/*
          ⚠ **AND IT STATES NO BASIS UNTIL STRIPE HAS QUOTED ONE — #1730, the
          same defect one noun over from #1703 and #1725.**

          `chargeCycle` is `alignToPreview(ownCycle, preview)` (it was `cycle`
          and `rawCycle` when this was written — #1739 renamed the pair), and
          before the preview answers it is `ownCycle` — cut from `status`,
          which is the CREDIT
          cycle rather than the period Stripe prorates over. So this sentence
          read **"Prorated for the 8 days left in this cycle"** and became
          **"Prorated for the 343 days left in this cycle"** when the quote
          landed (the yearly fixture). Two bases for one charge, stated with
          equal confidence a second apart.

          The module's own header says the alignment exists so the copy and the
          charge read the same two numbers. That was true once the preview
          existed and had nothing to say about the held second, which is the
          gap `alignsToPreview` now closes — and it is the SAME predicate
          `alignToPreview` branches on, not a second copy of it.

          **Three states, and the third is the one that did not exist before:**
          a quote is coming (say so, name no number); a quote has arrived (the
          sentence as it always was); there is no quote to come — a failed read,
          or an account with no rung above its own, where `previewPlanChange`
          never runs. In that last state the line says nothing at all rather
          than claiming a basis for a charge that is not going to happen, which
          is what it did before.
        */}
        {/*
          ⚠ **AND THE FOURTH STATE IS *WE HAVE NOT BEEN TOLD WHICH ROAD THIS
          IS* — #1749.** The three above are all about the QUOTE; this one is
          about the customer. `!hasSubscription` was `true` the instant the
          surface mounted, so the first thing a Pro subscriber read under the
          figure was the checkout road's sentence — confident, and about
          somebody else's account. It is the only line here that spoke from an
          unanswered query: the figure beside it already drew an em dash
          (#1725), the button already held (#1734), and this sentence named a
          charging schedule.

          `hasSubscription === false` is the whole repair. The unread state
          falls through every branch below it — `chargeCycle` is cut from
          `status` and `quoteComing` needs the query — and lands on `null`,
          which is this line's own existing answer for *there is nothing
          honest to say*. No new copy, because the right amount to say about a
          fact nobody has is nothing.

          ⚠ **THE YEARLY NUDGE IS THE SAME DEFECT ONE CLAUSE OVER, AND IT
          WOULD HAVE BEEN THE ONLY TEXT LEFT IN THIS PARAGRAPH.** `annual` was
          `annualChoice ?? status?.billingInterval === "year"`, so it was
          `false` while unread — and #664's own comment on that default says
          the toggle exists so *"an annual subscriber is not shown a monthly
          purchase they did not choose"*. Unread, this offered a **yearly**
          subscriber the yearly deal they already pay for, and after the fix
          above it would have said it into an otherwise empty paragraph. It
          waits on `planRead`, which is the status having ANSWERED rather than
          the subscription existing — a customer with no subscription still
          gets the nudge, as they always did.

          ✅ **AND THE FIELD ITSELF IS THREE-STATE NOW — #1755 IS BUILT, so
          this clause no longer carries the repair on its own.** `annual` is
          `boolean | null`, the condition above reads `annual === false`
          rather than `!annual`, and `planRead` stays beside it because the two
          facts are genuinely different: an account with no subscription has a
          KNOWN monthly interval, and the nudge is for them.

          ✅ The three readers this block used to hand to #1755 — the
          toggle's own state, the struck price and the checkout interval — are
          answered where they stand: the billing-adjustment row is not drawn at
          all until the interval is known, the struck price rests on
          `annual === true`, and `submit` refuses on `annual === null` beside
          its other two gates.
        */}
        <p className="dp-topup__renewal">
          {hasSubscription === true && preview?.kind === "interval-switch"
            /* ⚠ #1755: `annual === true`. `hasSubscription === true` already
               means the status answered, so this cannot be the unread state --
               the spelling is the file's, not a second gate. */
            ? annual === true
              ? "Billed for the whole year today — your new billing year starts now, and the year's credits land with the payment."
              : "Billed monthly from today — unused time from your year comes off future bills automatically."
            : hasSubscription === false
              ? "Charged today, then on the same date each period."
              : chargeCycle && alignsToPreview(preview)
                ? `Prorated for the ${chargeCycle.daysLeft} ${chargeCycle.daysLeft === 1 ? "day" : "days"} left in this cycle, then ${formatShortDate(chargeCycle.renewsAt)}.`
                : quoteComing
                  ? "Working out how much of this cycle you are charged for."
                  : null}
          {/* ⚠ #1755: `annual === false`, not `!annual`. #1749 gated this on
              `planRead` because the unread state read as monthly and offered a
              yearly subscriber the deal they already pay for; with the interval
              three-state the condition says what it means directly, and
              `planRead` stays because the two facts are not the same one — an
              account with no subscription has a KNOWN monthly interval and
              still gets the nudge. */}
          {planRead && annual === false ? ` Pay yearly instead and ${monthsFree()} of the twelve months are free.` : ""}
        </p>
      </div>

      <div className="dp-topup__foot">
        <span className="dp-set__spacer" />
        <Button variant="quiet" size="small" onClick={onClose} disabled={working}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="small"
          onClick={submit}
          disabled={!selected || working || !quoteReady}
        >
          {/*
            `dueToday !== null` is true wherever `quoteReady` is — the gate is
            derived from it above — and it is written out because that is how
            the compiler narrows `number | null`. The alternative is a `?? 0`
            inside the label, which is the defect this card closed.
          */}
          {/*
            ⚠ **AND `Checking the charge…` IS NOW THE WAITING STATE ONLY —
            #1734.** With nothing above this account's rung there is no charge
            to check and there never will be, so that label was permanent. It
            says what the picker above it says instead, from the same constant,
            because the two disagreeing about whether a plan exists is a worse
            sentence than either of them alone.

            The order matters: `nothingAbove` is asked BEFORE the quote, because
            `quoteReady` is false in that state too and the first matching
            branch would otherwise be the waiting one again.
          */}
          {/*
            ⚠ **AND #1747 ADDS A FOURTH STATE AHEAD OF BOTH, FOUND BY LOOKING AT
            THE SURFACE RATHER THAN BY READING IT (working law 6).** Making
            `laddered` require the account's own rung — the repair above, so a
            subscriber is no longer TOLD there is nothing above them — takes
            `nothingAbove` false in that state, and the chain then fell through
            to **"Checking the charge…" forever**: `selectedId` is null, the
            preview never runs, `quoteReady` is false and no quote is ever
            coming. That is precisely the permanent waiting label #1734 was
            filed about, reached by a third road, and this card's own change is
            what opened it.

            So the held glyph, which is what the PICKER above says in the same
            state — #1734's rule that the two must not disagree about this
            account applies to not-knowing exactly as it applies to knowing.
            Ahead of `nothingAbove` for the same reason `nothingAbove` is ahead
            of the quote: the first matching branch would otherwise be a claim.
          */}
          {working
            ? "Working…"
            : currentId === null
              ? "—"
              : nothingAbove
                ? NO_HIGHER_PLAN
                : quoteReady && dueToday !== null
                  ? `Add credits · ${formatDollars(dueToday)}`
                  : "Checking the charge…"}
        </Button>
      </div>
    </ModalScrim>
  );
}

/**
 * THE CREDIT PACKS — what a plan holder is shown, and the whole of slice 2.
 *
 * His design, 2026-10-02 (terminal), verbatim: *"for our add credits we should
 * be inspired by how higgsfield does it but obviously in ur own design language
 * … they have a slider also."* Translated on #1606 and built here: three packs
 * biggest first, a 5,000-step slider, what each amount buys in Rolls and Signs
 * at the live prices, the credits-per-dollar chip, one *Best value* badge, and
 * the honest nudge instead of a discount banner.
 *
 * # ONE INPUT, AND THE PACKS ARE POSITIONS ON IT
 *
 * `units` is the only state, and it is what the checkout sends. His design
 * says *"The three packs are presets that snap the slider"*, so a pack row is
 * a slider position with a name rather than a second kind of thing to buy —
 * which is why there is no pack id anywhere on this surface or on the wire.
 * Every figure below (the price, the rate, the badge, what it buys) is read
 * from that one number through `shared/creditTopups.ts`.
 *
 * # WHAT IT BUYS IS DERIVED, NEVER TYPED
 *
 * His design: *"Each line says what it buys in the customer's words and at the
 * live prices … DERIVED from the price table through the display helper, never
 * typed."* The two divisors come off `getPlans` (`rollCredits`, `signCredits`,
 * added for this pane on the projection that already serves
 * `oneFinishedCharacterCredits`), so his next price word moves every count on
 * this surface with no copy edit anywhere — and the counts FLOOR, because a
 * claim about what a customer's money covers may never exceed what it covers
 * (`creditDisplay.ts`'s asymmetry, read on a different question).
 *
 * ⚠ **AND THE EXAMPLE IN HIS OWN DESIGN IS ALREADY STALE, WHICH IS THE ARGUMENT
 * FOR DERIVING IT.** He wrote *"about 104 Rolls, or 14 Signs for 25,000 (25,000
 * ÷ 240, ÷ 1,700)"* on 2026-10-02, hours before his one-price ruling the same
 * day (#1753) took a Roll from 240 to 320 display. The Signs figure still
 * holds; the Rolls figure is 78 at the prices the product charges tonight. A
 * typed count would have shipped his arithmetic and been wrong on the day it
 * landed.
 *
 * # WHAT IS DELIBERATELY NOT COPIED FROM HIGGSFIELD
 *
 * Each is on the card and each is a rule rather than a preference: no engine
 * name in what a pack buys (the disappearing-technology law — a customer buys
 * Rolls and Signs, not engines); no struck-through price, because there is no
 * former price to strike; no top-up discount for plan holders, because the
 * ladder's own design is that a plan is the better value; and no *valid for 90
 * days*, because purchased credits do not expire here (#1660 keeps them through
 * every renewal), which this pane says in plain words instead.
 *
 * # THE DISAPPEARING-TECHNOLOGY GATE
 *
 * 1. **What must the customer learn?** Nothing. Pick an amount, read what it
 *    buys, pay.
 * 2. **What decision, and on what basis?** How many credits — with the basis on
 *    every row in Rolls and Signs at the live prices, plus the one rate figure
 *    that compares a pack with a plan.
 * 3. **Where does the technology show?** Nowhere: no engine, no ledger figure,
 *    no lookup key, no unit count. The slider's arithmetic is the display
 *    helper's and its output is credits and dollars.
 */
function CreditPacksPane({
  onClose,
  onChangePlan,
}: {
  onClose: () => void;
  onChangePlan: () => void;
}) {
  /*
    The smallest pack is the opening position, not the biggest.

    A customer who came here is out of credits and wants the smallest thing
    that fixes it — the same reasoning the step-up pane's own default rests on
    (*"somebody opening this needs more credits; the smallest step that solves
    it is the right default"*). Biggest-first is how the ROWS are ORDERED, which
    is his design's word and a different question from which one is selected.
  */
  const [units, setUnits] = useState(1);
  const [working, setWorking] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();

  /*
    ⚠ **0 KEEPS ITS ONE MEANING — not known yet.** Every count below declines
    rather than guessing while the catalogue is unread, which is this surface's
    house answer on nine cards (#1703, #1725, #1727, #1730, #1741, #1747,
    #1749, #1755, #1761) and is why the sentences read `null` rather than
    `about 0`.
  */
  const rollCredits = plans?.rollCredits ?? 0;
  const signCredits = plans?.signCredits ?? 0;

  /*
    ⚠ **THE CHEAPEST BAND, ASKED OF THE LADDER AND NOT OF THE PACK LIST.** The
    slider charges a band's rate at any whole number of units, so *best value*
    is a property of the band — which is what makes the badge answerable for a
    slider position as well as for a pack. `null` when every band shares one
    rate: a badge on equal rates is a lie, and his design says so in terms.
  */
  const bestUnits = bestValueTopupUnits();

  /*
    ⚠ **THE CREDIT FIGURE A CUSTOMER READS COMES THROUGH THE DISPLAY HELPER,
    NEVER FROM `topupDisplayCredits` DIRECTLY — and the compiler is what says
    so.** P1-1's rule is that the helper is *the only source of any credit
    number a customer sees*, and `formatCredits` takes a BRANDED
    `DisplayCredits` to make that structural rather than remembered. The
    ladder's own `topupDisplayCredits` answers the same figure for the server
    and the arms; routing it through `displayBalance` is what makes it a number
    this surface is allowed to print.

    **`displayBalance` and not `displayPrice`**, because a pack is a GRANT: the
    asymmetry is that a balance rounds DOWN and a price rounds UP, and this
    figure is what lands on the balance. Nothing actually rounds — every unit
    is 25,000 ledger, which divides exactly — and `server/creditPriceScale.test.ts`
    already holds that for every sellable size. The direction is stated so a
    future unit that does not divide cannot overstate what arrives.
  */
  const displayCredits = displayBalance(topupLedgerCredits(units));
  const cents = topupPriceInCents(units);

  /*
    ⚠ **THE RATE IS THE SAME HELPER BOTH BILLING SURFACES USE (card 403), AND IT
    TAKES A LEDGER FIGURE.** `formatCreditsPerDollar` divides by five inside
    itself (#1600), so handing it `topupLedgerCredits` is the only way it lands
    on the customer's scale — passing the display figure would quote a fifth of
    the real rate and make every pack look twelve times worse than the plan
    beside it.

    ⚠ **AND THIS IS THE ONE FIGURE HIS 2026-10-02 WORD MOVED OFF THE PLAN CARDS
    AND ONTO THIS ONE** (*"the rate belongs on Add credits, not on plans"*), so
    it is the number a customer compares a pack with a plan by and it earns its
    place on every row.
  */
  const rateFor = (unitCount: number) =>
    formatCreditsPerDollar(topupPriceInCents(unitCount), topupLedgerCredits(unitCount));

  /*
    WHAT AN ORDER BUYS, FLOORED, IN THE TWO THINGS THE STUDIO SELLS.

    `null` while a price is unread, so the sentence drops rather than claiming a
    count it cannot have. The floor is the safety property: a count of what an
    amount COVERS may never exceed what it covers.

    ⚠ **IT TAKES UNITS AND ASKS THE LADDER FOR THE LEDGER FIGURE — there is no
    `× 5` on this surface, and that is `creditDisplay.ts`'s own rule rather than
    a preference.** Its header says `LEDGER_PER_DISPLAY_CREDIT` *"is not
    exported to be multiplied elsewhere"*, and the first draft of this helper
    did exactly that: took a display count and scaled it back up by hand, which
    is a second copy of the scale on a money surface. `topupLedgerCredits`
    already answers it, and taking `units` means the pack rows and the slider
    ask the identical question.
  */
  const buys = (unitCount: number) => {
    if (rollCredits <= 0 || signCredits <= 0) return null;
    const ledger = topupLedgerCredits(unitCount);
    return {
      rolls: Math.floor(ledger / rollCredits),
      signs: Math.floor(ledger / signCredits),
    };
  };

  const topup = trpc.billing.createTopupCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.info("Opening checkout…");
      setWorking(false);
      onClose();
    },
    onError: (error) => {
      logRawFailure("billing.createTopupCheckout", error);
      /*
        The server's own refusal sentence reaches the customer through
        `spokenError`, so a free account that got here by any road reads what
        was refused and what to do rather than a generic failure.
      */
      toast.error(readableFailure(error, "Checkout could not be opened. Please try again."));
      setWorking(false);
    },
  });

  const submit = () => {
    /*
      ⚠ The bound is asked HERE as well as in the input schema and in the
      ladder's own helpers. `units` is what decides the charge, and a surface
      that can compose an unsellable amount is a surface that can open a
      checkout for one.
    */
    if (working || !isSellableTopupUnits(units)) return;
    setWorking(true);
    topup.mutate({ units });
  };

  const chosenBuys = buys(units);

  return (
    <ModalScrim
      label="Add credits"
      scrimClassName="dp-topup__scrim"
      cardClassName="dp-topup__card"
      busy={working}
      onDismiss={onClose}
    >
      <div className="dp-topup__pane">
        <p className="dp-topup__eyebrow">CREDITS</p>
        <h2 className="dp-topup__title">Add credits</h2>

        {/*
          The reason, off THIS account's own balance. It says nothing at all
          until the server has answered — #1703's measured defect on this very
          surface was `status?.balance ?? 0` telling a customer holding 3,688
          credits that they had **0**, under the one heading whose job is to
          talk about their balance.
        */}
        {status ? (
          <p className="dp-topup__reason">
            {formatCredits(displayBalance(status.balance))} credits on the balance today.
          </p>
        ) : null}

        {/* His design: the three packs, biggest first. */}
        <div className="dp-topup__packs" role="radiogroup" aria-label="How many credits">
          {TOPUP_PACKS.map((pack) => {
            const packBuys = buys(pack.units);
            return (
              <button
                key={pack.units}
                type="button"
                className="dp-topup__pack"
                role="radio"
                aria-checked={pack.units === units}
                onClick={() => setUnits(pack.units)}
              >
                <span className="dp-topup__packhead">
                  <span className="dp-topup__packcredits">
                    {formatCredits(displayBalance(topupLedgerCredits(pack.units)))} credits
                  </span>
                  {pack.units === bestUnits ? (
                    <span className="dp-plan__badge">BEST VALUE</span>
                  ) : null}
                  <span className="dp-set__spacer" />
                  <span className="dp-topup__packprice">{formatDollars(pack.cents)}</span>
                </span>
                {/*
                  ⚠ **NO ENGINE NAME, AND THAT IS THE LAW RATHER THAN THE
                  WORDING.** Higgsfield's rows name their models here; a
                  customer buys the work, not the machine that does it.
                */}
                <span className="dp-topup__packbuys">
                  {packBuys
                    ? `About ${packBuys.rolls.toLocaleString()} Rolls, or ${packBuys.signs.toLocaleString()} Signs`
                    : "—"}
                  <span className="dp-topup__packrate">{rateFor(pack.units)} credits per $1</span>
                </span>
              </button>
            );
          })}
        </div>

        {/*
          THE SLIDER — his design's own control, and the packs above are
          positions on it.

          ⚠ **ITS STEP IS THE UNIT AND ITS END IS THE LADDER'S OWN BOUND**, both
          read rather than typed: a step that was not the unit would compose an
          amount the ladder refuses, and an end past `TOPUP_MAX_UNITS` would put
          a price on an order the server will not take. The thumb's value is
          `units` itself, so the slider, the packs, the price, the rate and the
          button cannot come to disagree — there is one number.
        */}
        {/*
          ⚠ **THE NAME OF THE CONTROL IS `LabelledField`'s, NOT A FOURTH
          TREATMENT.** The first draft wrote its own `<label className="dp-set__label">`
          and `section11-guard.test.ts` caught it at the gate: #841's fold left
          exactly one field-label treatment in the client, and a slider is a
          control with a name like any other. The row also wants what that
          component already owns — the label's confirm-shell `margin-top`
          zeroed, and a `helper` slot for the rule under the control, which is
          precisely where *what this amount buys* belongs.
        */}
        <LabelledField
          label="Or choose an amount"
          htmlFor="dp-topup-amount"
          className="dp-topup__slider"
          helper={
            <>
              {chosenBuys
                ? `About ${chosenBuys.rolls.toLocaleString()} Rolls, or ${chosenBuys.signs.toLocaleString()} Signs`
                : "—"}
              {" · "}
              {rateFor(units)} credits per $1
            </>
          }
        >
          <input
            id="dp-topup-amount"
            type="range"
            className="dp-topup__range"
            min={1}
            max={TOPUP_MAX_UNITS}
            step={1}
            value={units}
            aria-valuetext={`${formatCredits(displayCredits)} credits for ${formatDollars(cents)}`}
            onChange={(event) => setUnits(Number(event.target.value))}
          />
          <p className="dp-topup__sliderline">
            <span className="dp-topup__due">{formatDollars(cents)}</span>
            <span className="dp-topup__duenote">
              for {formatCredits(displayCredits)} credits
            </span>
          </p>
        </LabelledField>

        <div className="dp-topup__bullets">
          <span className="dp-topup__bullet">
            <Check size={12} strokeWidth={1.8} />
            {formatCredits(displayCredits)} credits land on your balance the moment the payment
            goes through — nothing to wait for.
          </span>
          {/*
            His words on the card, and the opposite of what Higgsfield's page
            says: *"Purchased credits never expire"*. #1660 is what makes it
            true — a renewal tops the monthly allowance up and leaves purchased
            credits alone.
          */}
          <span className="dp-topup__bullet">
            <Check size={12} strokeWidth={1.8} />
            Purchased credits never expire. They stay on your balance through every renewal.
          </span>
        </div>

        {/*
          §6f's MIRROR — the honest nudge, not a discount banner.

          His design: *"top-ups are worse value than a plan by his finance
          guy's design, so the row under the packs says what the existing path
          says today — a bigger plan gives more for the money — with the move-up
          action, no fake discount."*

          ⚠ **AND THE SENTENCE IS TRUE AT EVERY SLIDER POSITION, WHICH IS WHY
          THE LADDER WAS BUILT THE WAY IT WAS.** The best pack rate is 500
          credits per $1 and the cheapest plan is 519, so there is no amount a
          customer can choose here that beats a plan — the arm holding that
          lives in `server/creditTopupLadder.test.ts` against `PLAN_TIERS`
          itself, so a price edit that makes this row a lie goes red rather than
          shipping.
        */}
        <div className="dp-plan__cross">
          <span className="dp-set__rowtext">
            <span className="dp-set__label">A bigger plan gives more for the money</span>
            <span className="dp-set__note">
              Credits on a plan arrive every month and cost less each.
            </span>
          </span>
          <span className="dp-set__spacer" />
          <Button variant="secondary" size="small" onClick={onChangePlan} disabled={working}>
            Change plan
          </Button>
        </div>
      </div>

      <div className="dp-topup__foot">
        <span className="dp-set__spacer" />
        <Button variant="quiet" size="small" onClick={onClose} disabled={working}>
          Cancel
        </Button>
        <Button variant="primary" size="small" onClick={submit} disabled={working}>
          {/*
            The price is on the button before the press, which is the one thing
            a money button owes. It is never an em dash here: the figure is
            composed from the ladder and the chosen amount, both of which this
            surface holds — nothing about this price waits on a server, which is
            exactly what the step-up pane's `Checking the charge…` was about.
          */}
          {working ? "Working…" : `Add credits · ${formatDollars(cents)}`}
        </Button>
      </div>
    </ModalScrim>
  );
}

/**
 * ADD CREDITS — the shell, which reads the account's rung and nothing else.
 *
 * ⚠ **THE CHOICE BETWEEN THE TWO PANES IS ITSELF A READ, SO IT HAS THREE
 * ANSWERS.** `topupEligibility` is slice 1's declaration of the card's rule
 * (*"Plan holders only, enforced server-side"*) and it answers `unread` as its
 * own state for the reason nine cards on this surface have paid for: a boolean
 * would make an unanswered `getStatus` read as *"you have no plan"*, and a Pro
 * subscriber would be shown the upgrade offer for the beat their status is in
 * flight. So neither pane is drawn until the rung is known.
 *
 * ⚠ **AND THE HELD BEAT DRAWS THE CARD RATHER THAN NOTHING.** The scrim and the
 * title are true of both roads, so they stand immediately and the decision
 * arrives under them — which is #1703's answer on this very surface (*"say
 * NOTHING until the server has answered"*) applied to a pane instead of a
 * sentence. Dismissing works throughout; nothing is claimed.
 *
 * The panes are two components rather than two branches of one because each
 * owns its own queries and mutations, and a surface that fires a Stripe
 * proration read for a customer who is being sold a credit pack is the cost
 * `AccountSurfaces`'s own gate exists to avoid.
 */
export function AddCreditsModal({
  onClose,
  onChangePlan,
}: {
  onClose: () => void;
  /**
   * The road to the plan ladder, and it is REQUIRED on purpose.
   *
   * ⚠ `AccountSurfaces`'s own docblock records what an optional one costs:
   * *"the out-of-credits mounts open the top-up with no way to reach Change
   * plan from it, which is the cross-link §6f exists to provide."* The nudge
   * under the packs is that cross-link pointing the other way, so a mount that
   * could forget it would ship a nudge with nowhere to go. The compiler asks
   * every mount instead.
   */
  onChangePlan: () => void;
}) {
  const { data: status } = trpc.billing.getStatus.useQuery();
  const eligibility = topupEligibility(status?.planTier);

  if (eligibility === "may-buy") {
    return <CreditPacksPane onClose={onClose} onChangePlan={onChangePlan} />;
  }
  if (eligibility === "needs-a-plan") {
    return <PlanStepUpPane onClose={onClose} />;
  }
  return (
    <ModalScrim
      label="Add credits"
      scrimClassName="dp-topup__scrim"
      cardClassName="dp-topup__card"
      busy={false}
      onDismiss={onClose}
    >
      <div className="dp-topup__pane">
        <p className="dp-topup__eyebrow">CREDITS</p>
        <h2 className="dp-topup__title">Add credits</h2>
      </div>
      <div className="dp-topup__foot">
        <span className="dp-set__spacer" />
        <Button variant="quiet" size="small" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </ModalScrim>
  );
}
