/**
 * Settings → Billing (brief §5).
 *
 * **State only** — what you are on, what you have paid, how to change it. The
 * pricing table is the Change plan modal and never appears here; that is §1's
 * whole reason for three surfaces rather than one.
 *
 * ## What the reconciliation changed (BRIEF-RECONCILIATION Q3)
 *
 * - **`Visa ···· 4417` has no reader.** Nothing on `billing.*` returns a card
 *   brand or its last four — `getSubscriptionDetails` answers with the tier,
 *   the renewal date and the status. So the payment row keeps its ACTION, which
 *   is real (`createPortalSession` opens Stripe's own portal), and states where
 *   the card lives instead of drawing a card nobody read.
 * - **`4 seats` has no reader either.** There is no membership anywhere in the
 *   product (§8), so the plan line names credits and the renewal and stops.
 * - **The credits bar fill is `--ink`, not accent** — §5: *"A quantity is not a
 *   state; the sentence beside it carries the warning."*
 *
 * ## ⚠ THE PLAN ROW IS A CARD AND THE INVOICES ARE A BORDERED LIST (#381)
 *
 * The prototype draws the plan as `padding: 16px 17px; border: 1px solid
 * var(--borderCard); border-radius: 12px` and the invoices as one bordered
 * container with hairlines between the rows. The brief's hairline grammar put
 * the plan — the most important line on the page, and the one carrying two
 * money buttons — in the same undivided column as everything else.
 *
 * The heading is `Billing & plan`, which is the prototype's, not `Plan`.
 */
import { toast } from "sonner";
import { displayBalance, formatCredits } from "@shared/creditDisplay";
/* #1836 — the one declaration of who may buy credits, read here so this
   section, §6f and the Add-credits door cannot answer it differently. */
import { topupEligibility } from "@shared/creditTopups";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

import { Bar, SettingsCard, SettingsGroup, SettingsList } from "../parts";
import { ReferralBlock } from "../ReferralBlock";
import {
  creditStepsPriceAMonth,
  formatDollars,
  formatShortDate,
  formatWholeDollars,
  priceAMonth,
} from "../planMath";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import { cancelledPlanSegment } from "@shared/planCancelCopy";
import { cancelStateOf, useResumePlan } from "@/features/billing/resumePlan";

/**
 * WHAT THIS CUSTOMER PAYS AND RECEIVES, said the way Change plan says it — #2392.
 *
 * The plan card used to print `planPriceInCents` and `allowance` as they
 * arrived, and both are the rung's LIST facts (`ownPlanFacts` on the server
 * reads `PLAN_TIERS[tier]` and nothing else). So a Pro customer billed yearly
 * read **"$68.00/mo"** here while Change plan, one click away, priced the same
 * plan at **"$56 / month, billed yearly"**; and a Pro Plus customer who had
 * moved the credit slider read the bottom of the dial for both the price and
 * the credits.
 *
 * ⚠ **NO ARITHMETIC OF ITS OWN (working law 4).** The price goes through the
 * two `planMath` functions Change plan's own `priceOf` is built from —
 * `priceAMonth` for the plan and `creditStepsPriceAMonth` for the dial — and is
 * printed with the same `formatWholeDollars`, so the two surfaces cannot name
 * different figures for one plan. The credits add the dial through
 * `planCreditSliderLedgerCredits`, the one declaration the server's grant and
 * Change plan's `creditsWithSlider` also read.
 *
 * ⚠ **AND AN UNREAD INPUT HOLDS THE FIGURE (#1727 / #1741 / #1763).**
 * - `billingInterval` that is not `"month"` or `"year"` on a paid plan is
 *   unknown, never monthly — #1763 is the same collapse on Change plan.
 * - `sliderUnits === null` is the dial's position not read yet (or the server
 *   saying it could not read the subscription), never the bottom of the dial;
 *   both the price and the credits stand down, because the dial moves both.
 * - `0` slider units is a real answer: a rung with no dial, or the dial at rest.
 *
 * `"No charge"` is decided by the plan's own price before anything else is
 * asked: a rung with nothing to charge has no interval and no dial.
 */
export function ownPlanTerms(input: {
  planPriceInCents: number | null;
  allowance: number | null;
  billingInterval: string | null | undefined;
  sliderUnits: number | null;
}): { price: string | null; allowance: number | null } {
  const { planPriceInCents, allowance, billingInterval, sliderUnits } = input;
  const withSlider =
    allowance === null || sliderUnits === null
      ? null
      : allowance + planCreditSliderLedgerCredits(sliderUnits);
  if (planPriceInCents === null) return { price: null, allowance: withSlider };
  if (planPriceInCents <= 0) return { price: "No charge", allowance: withSlider };
  if (sliderUnits === null) return { price: null, allowance: withSlider };
  if (billingInterval !== "month" && billingInterval !== "year") {
    return { price: null, allowance: withSlider };
  }
  const annual = billingInterval === "year";
  const cents = priceAMonth(planPriceInCents, annual) + creditStepsPriceAMonth(sliderUnits, annual);
  return {
    price: `${formatWholeDollars(cents)}/mo${annual ? ", billed yearly" : ""}`,
    allowance: withSlider,
  };
}

export function BillingSection({
  planName,
  planPriceInCents,
  allowance: listAllowance,
  balance,
  renewsAt,
  onChangePlan,
  onAddCredits,
}: {
  /**
   * ⚠ **`null` = NOT READ YET, AND IT IS NOT THE FREE PLAN (#1741).** The
   * plan card's title is its own SLOT, so this one draws the em dash rather
   * than being omitted — an absent title would collapse the row and walk the
   * two money buttons up the card, which is the same argument the Sign modal's
   * cost line makes. The header one screen up is a sentence and omits instead.
   */
  planName: string | null;
  /**
   * ⚠ **`null` = NOT READ YET, AND IT IS NOT A PRICE OF ZERO (#1727).**
   * `getStatus` is in flight for the first paint of every open of this modal,
   * so a paying customer's own plan card said **"No charge"** and then became
   * their real monthly price. The note below drops the price entry rather than
   * claiming either way — the same thing it already does for the allowance and
   * the renewal date, and the same thing `balance` does for the figures under
   * it (#1703).
   */
  planPriceInCents: number | null;
  /**
   * ⚠ **`null` = NOT READ YET, AND IT IS NOT A GRANT OF 0 (#1741).** Every
   * claim that quotes it — the `credits/mo` entry, the bar, the percentage —
   * stands down together, exactly as they already do for `balance`.
   */
  allowance: number | null;
  balance: number | null;
  renewsAt: Date | null;
  onChangePlan: () => void;
  onAddCredits: () => void;
}) {
  const { data: invoicesData } = trpc.billing.getInvoices.useQuery({ limit: 5 });
  /*
    #1836 — the rung, for the two credit controls below.

    ⚠ **IT COSTS NO REQUEST.** `AccountSurfaces` mounts this section and already
    holds `billing.getStatus`, so TanStack serves this from the same cache entry
    rather than asking again; reading it here instead of drilling the answer
    through `SettingsModal` keeps the rule where the controls are.

    ⚠ **AND IT IS READ AS `may-buy`, NEVER AS `planTier !== "free"`**, so the
    unread beat declines — the direction every one of the eight cards from #1703
    to #1755 was filed about, and the cheap error here: a subscriber loses two
    controls for the beat their status is in flight, where a free account
    SEEING them is the thing his word forbids.
  */
  const { data: status } = trpc.billing.getStatus.useQuery();
  /*
    #2392 — WHERE THE CREDIT DIAL SITS, read the way Change plan reads it: the
    dial's rung and reach come off `getPlans` (served, never a rung named
    here), and the position off `getPlanCreditUnits`, which is what bills.

    ⚠ The position is asked only when this customer IS on the dial's rung —
    every other rung's answer is 0 without a Stripe round trip. Until both
    the status and the catalogue have answered, nobody knows which rung has
    the dial, so the position is `null` (unread) rather than 0.
  */
  const { data: plans } = trpc.billing.getPlans.useQuery();
  const sliderSpec = plans?.creditSlider ?? null;
  const onDialRung =
    status !== undefined &&
    sliderSpec !== null &&
    sliderSpec.maxUnits > 0 &&
    status.planTier === sliderSpec.planId;
  const { data: sliderPosition } = trpc.billing.getPlanCreditUnits.useQuery(undefined, {
    enabled: onDialRung,
  });
  const sliderUnits: number | null =
    status === undefined || plans === undefined
      ? null
      : !onDialRung
        ? 0
        : sliderPosition === undefined
          ? null
          : sliderPosition.units;
  const terms = ownPlanTerms({
    planPriceInCents,
    allowance: listAllowance,
    billingInterval: status === undefined ? undefined : status.billingInterval,
    sliderUnits,
  });
  const allowance = terms.allowance;
  /*
    ⚠ **THE CHANGE WAITING AT THE PERIOD BOUNDARY (#1936) — AND WITHOUT THIS
    QUERY THE WHOLE DEFERRAL IS INVISIBLE.** Since his option 1, asking to drop
    a plan or lower the dial no longer does anything today: it is scheduled for
    the renewal. So a customer is told *"Pro starts on 7 Nov"* in one toast, and
    then every screen she looks at — this one most of all — goes on saying Pro
    Plus with nothing to show that a change is coming and no way to call it off.
    That is the machinery showing through by omission, and this is where it is
    closed.

    ⚠ **IT IS `getSubscriptionDetails` AND DELIBERATELY NOT A FIELD ON
    `getStatus`, for the reason the dial's own procedure already records: the
    answer costs TWO Stripe round trips** (retrieve the subscription, then
    retrieve its schedule), and `getStatus` is on the hot path that every
    surface in this product waits on. A pending change is worth a request on
    the one pane that shows plan state; it is not worth slowing down every
    paint everywhere.
  */
  const subscriptionDetailsQuery = trpc.billing.getSubscriptionDetails.useQuery();
  const subscriptionDetails = subscriptionDetailsQuery.data;
  /* #2395 — a plan set to end at its period end, read the one way the Change
     plan dialog reads it too (`features/billing/resumePlan.ts`). */
  const cancelled =
    cancelStateOf(
      subscriptionDetails,
      subscriptionDetailsQuery.isSuccess || subscriptionDetailsQuery.isError,
    ) === "cancelled";
  const resumePlan = useResumePlan(renewsAt);
  const pendingChange = subscriptionDetails?.pendingChange ?? null;
  /*
    WHAT IS CHANGING AND WHEN, in her words — `null` when nothing is pending.
    It names whichever thing is actually moving, because a dial move keeps the
    plan's own name and *"Pro Plus from 7 Nov"* on a Pro Plus account reads as
    nothing happening at all.

    ⚠ **IT IS A BLOCK RATHER THAN A TERNARY IN THE JSX, AND #1741's GUARD IS
    WHY.** The first draft compared `subscriptionDetails?.billingInterval ===
    "year"` inline, and `server/unreadPlanIdentity.test.ts` caught it: an
    optional chain there answers *monthly* about a customer nobody has read.
    It happened to be unreachable — `pendingChange` comes off the same query,
    so there is no paint where one is known and the other is not — but the
    SHAPE is the defect that file exists to keep out of this surface, and the
    early return below makes the interval a fact read off a value that is
    present rather than a comparison against `undefined`.
  */
  const pendingSentence = (() => {
    if (!subscriptionDetails?.pendingChange) return null;
    const pending = subscriptionDetails.pendingChange;
    const on = formatShortDate(new Date(pending.effectiveAt));
    if (pending.plan !== status?.planTier) return `${pending.planName} from ${on}`;
    const billedYearly = subscriptionDetails.billingInterval === "year";
    if ((pending.interval === "annual") !== billedYearly) {
      return `billed ${pending.interval === "annual" ? "yearly" : "monthly"} from ${on}`;
    }
    return `${formatCredits(displayBalance(pending.monthlyCredits))} credits/mo from ${on}`;
  })();
  const utils = trpc.useUtils();
  const cancelScheduledChange = trpc.billing.cancelScheduledChange.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      /* Both reads, because the pending change lives on one and the plan a
         customer sees lives on the other. */
      void utils.billing.getSubscriptionDetails.invalidate();
      void utils.billing.getStatus.invalidate();
    },
    onError: (error) => {
      logRawFailure("billing.cancelScheduledChange", error);
      toast.error(readableFailure(error, "That change could not be cancelled."));
    },
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (result) => {
      if (result?.portalUrl) window.open(result.portalUrl, "_blank");
    },
    onError: (error) => {
      logRawFailure("billing.createPortalSession", error);
      toast.error(readableFailure(error, "The billing portal could not be opened."));
    },
  });

  /*
    ⚠ **THE LAW-7 SWEEP OF #387 ITEM 2, AND IT FOUND A WORSE ONE HERE.**

    Item 2 was `of 5,000 this month` on an account whose credits never refresh:
    `refreshMonthlyCredits` is reached only from the Stripe invoice webhook and
    that webhook returns early for the free tier. The class is *a figure
    measured against a cycle the product does not run*, and this pane had two
    more of them, one row apart:

    - `${allowance} credits/mo` on the plan card — the free plan's 5,000 is a
      one-time signup grant (`INITIAL_CREDITS`), so `/mo` is simply false.
    - `${percent}% of this month’s allowance left`, which is worse than the one
      he reported because it does not merely mislead, it goes absurd: `Bar`
      clamps its ratio to 1 and **the sentence does not**, so on his own
      production row — balance 24,535 against a free allowance of 5,000 — the
      pane reads **"491% of this month's allowance left"** beside a bar that is
      simply full.

    So both are gated on a period that actually RENEWS. `renewsAt` is
    `currentPeriodEnd` and is already passed in; where it is null there is no
    cycle, and the honest thing is to show the balance without a denominator
    rather than invent one. Nothing is dropped on a paying account.
  */
  const renews = renewsAt !== null;
  /*
    ⚠ **AND A BALANCE NOBODY HAS READ YET IS NOT A BALANCE OF ZERO — #1703,
    2026-10-01.** `status?.balance ?? 0` upstream meant this pane printed a
    confident **0** in CREDITS REMAINING for the beat before `billing.getStatus`
    answered, under a label whose whole job is to state what a customer has. The
    bar's own comment one screen down already had the argument — *"an empty
    track under a real balance reads as nothing left, which is the opposite of
    true"* — and it is the same sentence about the number above it.

    So `null` travels the whole way here and every claim that quotes it stands
    down together: the figure, the track and the percentage. An em dash is the
    house answer for a figure not yet known (`BoardHeader`, `UsageSection`).
  */
  /*
    ⚠ **AND AN ALLOWANCE NOBODY HAS READ YET IS NOT AN ALLOWANCE OF ZERO —
    #1741, one noun further along the same sentence.** `allowance` arrived here
    as `0` while `getStatus` was in flight, and under a catalogue resolved off a
    defaulted plan id it arrived as the FREE rung's grant instead — a real
    number belonging to another plan. Both are claims nobody made, so the
    denominator is held exactly as the numerator above it is.
  */
  const granted = allowance !== null && allowance > 0;
  const remainingShare = balance !== null && renews && granted ? balance / allowance : 0;
  const quotable = balance !== null && renews && granted;
  /*
    ⚠ **A SHARE OVER 100% IS NOT A SHARE OF THIS MONTH'S ALLOWANCE — #2393.**
    The sweep above took *"491% of this month's allowance left"* off the free
    plan, and the same sentence stayed reachable on a paying one: a renewal
    writes `outside-plan + monthly grant + rollover`, so a Pro customer who
    spent nothing last month renews at 175% and a Pro Plus one at 200%, and any
    top-up lifts the balance past the grant too. `Bar` clamps; the sentence
    did not.

    It is DROPPED there rather than clamped. *"100% left"* on a balance that
    also holds top-ups is a different wrong sentence, so where the balance is
    more than a month's grant the figure above speaks for itself and the bar
    reads full, which is true.

    ⚠ **WHAT THIS DOES NOT REACH, stated rather than shipped quietly:** the
    numerator is still the TOTAL balance, so a subscriber under the grant who
    also holds top-up credits reads a share of the whole balance, not of the
    plan's part. The plan's part is `planAllowanceRemaining`
    (`server/db/credits.ts`), and `getStatus` does not serve it — that is a
    server change, filed on the card rather than guessed at here.
  */
  const percentQuotable = quotable && remainingShare <= 1;
  /*
    ⚠ **WHO HAS A CARD TO UPDATE — #2397.** `createPortalSession` refuses an
    account with no Stripe customer (*"No billing account found. Please
    subscribe to a plan first."*), and a free account only gets one by starting
    a checkout. So `Update card` on a free account was a button whose only
    answer was an error, the same shape #1836 took `Add credits` off this pane
    for. `Change plan` on the card above is the road.

    It is read off `stripeCustomerId`, never `canManage`: that one is keyed on a
    SUBSCRIPTION id, and would hide the card from a lapsed customer who still
    has a card on file and may want to change it. Unread holds it back, the
    direction #1836 chose for the credit controls: a subscriber waits a beat for
    a control; a free account is never shown one that only errors.
  */
  const hasBillingAccount =
    status !== undefined && "stripeCustomerId" in status && Boolean(status.stripeCustomerId);
  const invoices = invoicesData?.invoices ?? [];

  return (
    <>
      <SettingsGroup title="Billing & plan">
        <SettingsCard
          /* An em dash in the title's own slot — see the prop's docblock (#1741). */
          label={planName ?? "—"}
          note={[
            /* `planPriceInCents === null` holds it (#1727); the interval and
               the dial are read in `ownPlanTerms` (#2392). */
            planPriceInCents === null ? null : terms.price,
            renews && granted ? `${formatCredits(displayBalance(allowance))} credits/mo` : null,
            /*
              ⚠ **A PENDING CHANGE REPLACES THE RENEWAL SEGMENT RATHER THAN
              SITTING BESIDE IT (#1936).** Both facts land on the same date —
              the scheduled change happens AT the renewal — so printing both
              gives *"renews 7 Nov · Pro from 7 Nov"*, which says one date
              twice and makes a customer work out that they are the same
              event. One segment, the thing she actually wants to know.

              The sentence itself is `pendingSentence`, composed above — see
              its note for why it is not a ternary in here.
            */
            /*
              #1940 B26 — a cancelled plan says when it ENDS and that it won't
              renew, read off the cancelled state `getSubscriptionDetails`
              already serves (Yuna's C7). It outranks a pending change: a
              cancel releases the schedule first, so both cannot be true.

              ⚠ **THE DATE IS `renewsAt` — THE SAME `getStatus` PERIOD END THE
              "renews" SEGMENT, THE CANCEL DIALOG AND THE SERVER'S RECEIPT ALL
              QUOTE — AND NOT `subscriptionDetails.currentPeriodEnd`.** Seen at
              the frame on the dev fixture: the details read answered 9 Sept
              while the row (and so the dialog a moment earlier) said 9 Oct. One
              fact, one source, or the toast and this line name two days.
            */
            cancelled
              ? cancelledPlanSegment(renewsAt)
              : pendingSentence ?? (renewsAt ? `renews ${formatShortDate(renewsAt)}` : null),
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {/*
            ⚠ **THE WAY BACK OUT OF A SCHEDULED CHANGE (#1936), AND IT SHIPS IN
            THE SAME COMMIT AS THE DEFERRAL BECAUSE THE DEFERRAL CREATES THE
            STATE IT RESCUES.** Before his option 1 there was nothing to undo:
            a downgrade happened the moment it was asked for. Now she can ask
            to drop to Pro on the 1st and change her mind on the 3rd, and
            without this control her only road back is to buy an INCREASE she
            does not want and pay a proration for it.

            It stands IN PLACE of `Change plan` while something is pending,
            rather than beside it. Two buttons offering to change the plan —
            one of which cancels a change — is the busy, decide-this-first
            shape his candidate-count ruling refused; and `Change plan` still
            works from the modal, which is where a customer who wants a
            DIFFERENT change is going anyway (asking for one replaces the
            pending one on the server, by the same release rule).
          */}
          {/*
            ⚠ **THE WAY BACK OUT OF A CANCEL (#2395).** A plan set to end
            offers Resume plan IN PLACE of Change plan, on the precedent the
            scheduled-change control set just below: one button, the thing the
            customer can actually do. Changing a plan that is ending is refused
            by the server with *"Resume your plan first"*, so Change plan here
            would only lead to that refusal. It outranks a pending change for
            the reason the plan line gives: a cancel releases the schedule
            first, so both cannot be true.
          */}
          {cancelled ? (
            <Button
              variant="secondary"
              size="small"
              disabled={resumePlan.isPending}
              onClick={() => resumePlan.mutate()}
            >
              {resumePlan.isPending ? "Resuming…" : "Resume plan"}
            </Button>
          ) : pendingChange ? (
            <Button
              variant="secondary"
              size="small"
              disabled={cancelScheduledChange.isPending}
              onClick={() => cancelScheduledChange.mutate()}
            >
              Keep my plan
            </Button>
          ) : (
            <Button variant="secondary" size="small" onClick={onChangePlan}>
              Change plan
            </Button>
          )}
          {/*
            ⚠ **AND THIS ONE IS PRIMARY-WEIGHTED, WHICH IS WHY IT IS THE LIKELY
            BUTTON HE PRESSED — #1836.** His word, 2026-10-03: *"you shouldnt be
            able to use add credits if your on the free plan at all , not sure
            why i could click the button it should be greyed out or only display
            plans when i click it im in a free account"*.

            It sits on the plan card, in ink, beside `Change plan` — the loudest
            thing on Settings → Billing, offering a free account the one thing
            they cannot buy.

            ⚠ **FOUND BY LOOKING AT THE RUNNING APP, NOT BY GREPPING FOR IT
            (working law 6).** A repository-wide search for the string had
            already been run on this card and returned the §6f row and the
            modal's own titles; **this button and the link below it were missed
            because the sweep read for a SURFACE and these are controls.** They
            turned up the moment a free fixture opened this page.

            ⚠ **REMOVED RATHER THAN DISABLED**, which is the card's own
            recommendation and law 6's: *a disabled control with no road is a
            decision put in front of someone with nowhere to go.* `Change plan`
            is the road, it is already here, and for a free account it is the
            whole answer to *how do I get more credits*.
          */}
          {topupEligibility(status?.planTier) === "may-buy" ? (
            <Button variant="primary" size="small" onClick={onAddCredits}>
              Add credits
            </Button>
          ) : null}
        </SettingsCard>
      </SettingsGroup>

      <div className="dp-set__cards" style={{ marginTop: "var(--s-7)" }}>
        <div className="dp-set__minicard">
          <span className="dp-set__minilabel">CREDITS REMAINING</span>
          <span className="dp-set__mininum">
            {balance !== null ? formatCredits(displayBalance(balance)) : "—"}
          </span>
          {/* A bar needs a denominator. Without a renewing allowance there is
              none, and an empty track under a real balance reads as nothing
              left — which is the opposite of true. ⚠ And without a BALANCE it
              has no numerator either (#1703): a track drawn off an unread
              figure makes the same claim the figure does. */}
          {quotable ? <Bar ratio={remainingShare} token="--ink" /> : null}
          <span className="dp-set__note">
            {percentQuotable
              ? `${Math.round(remainingShare * 100)}% of this month's allowance left · `
              : ""}
            {/*
              ⚠ THE LINK CARRIES ITS OWN VERB WHEN NOTHING LEADS IT. Looked at
              in the running app after the sweep above removed the sentence:
              `more credits` was left alone under the balance, reading as a
              fragment rather than as a control. It is a continuation phrase and
              it only works as one — so where the sentence is gone, so is the
              continuation.
            */}
            {/* #1836 — the same rule under the balance. A free account reads
                `Add more credits` here, which is the same promise one weight
                down; the figure and its bar stay, because what they say is
                true. */}
            {topupEligibility(status?.planTier) === "may-buy" ? (
              <button type="button" className="dp-set__linkbtn" onClick={onAddCredits}>
                {/* Keyed on the SENTENCE it continues (#2393), so wherever
                    the percentage stands down — over the grant, or a balance
                    not read yet — the link carries its own verb. */}
                {percentQuotable ? "more credits" : "Add more credits"}
              </button>
            ) : null}
          </span>
        </div>
        {/* #2397 — only an account with a card on file is offered to update it. */}
        {hasBillingAccount ? (
          <div className="dp-set__minicard">
            <span className="dp-set__minilabel">PAYMENT METHOD</span>
            {/* No reader for brand or last four — see the docblock. */}
            <span className="dp-set__note">
              Your card is held by Stripe, and only Stripe can show it to you.
            </span>
            <span>
              <Button
                variant="secondary"
                size="small"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? "Opening…" : "Update card"}
              </Button>
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: "var(--s-8)" }}>
        <ReferralBlock />
      </div>

      <div style={{ marginTop: "var(--s-8)" }}>
        <SettingsGroup title="Invoices">
          {invoices.length === 0 ? (
            <p className="dp-set__note">No invoices yet.</p>
          ) : (
            <SettingsList>
              {invoices.map((invoice) => (
                <div className="dp-set__invoice" key={invoice.id}>
                  <span>{formatShortDate(new Date(invoice.date))}</span>
                  <span>{formatDollars(invoice.amount)}</span>
                  <span className="dp-set__spacer" />
                  {invoice.pdfUrl ? (
                    <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  ) : (
                    <span className="dp-set__value">—</span>
                  )}
                </div>
              ))}
            </SettingsList>
          )}
        </SettingsGroup>
      </div>
    </>
  );
}
