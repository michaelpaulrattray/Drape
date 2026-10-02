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
 */
import { useMemo, useState } from "react";
import { displayBalance, displaySpent, formatCredits } from "@shared/creditDisplay";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
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
import { framesFor } from "@/features/settings/planLadder";
import { useCycleSpend } from "./useCycleSpend";

/**
 * ⚠ **ONE SENTENCE, TWO SURFACES — #1734.** The picker and the button below it
 * both have to say what is true of an account with no rung above its own, and
 * the card's own requirement is that they AGREE. Two copies of four words agree
 * until somebody edits one of them, which is working law 4 at its smallest; one
 * constant agrees by construction.
 */
const NO_HIGHER_PLAN = "No higher plan";

export function AddCreditsModal({ onClose }: { onClose: () => void }) {
  /* ⚠ The toggle opens on the interval the customer is BILLED on (#664) —
     `null` until they touch it, so an annual subscriber is not shown a
     monthly purchase they did not choose. */
  const [annualChoice, setAnnualChoice] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();
  const { data: costs } = trpc.credits.getCosts.useQuery();
  const utils = trpc.useUtils();

  const annual = annualChoice ?? status?.billingInterval === "year";

  const currentId = status?.planTier ?? "free";
  const hasSubscription = !!status?.hasSubscription;
  const costPerFrame = costs?.castingImage ?? 0;

  /* Every rung ABOVE the current one — the only ones that add credits. */
  const options = useMemo(() => {
    if (!plans) return [] as { id: string; name: string; credits: number; price: number }[];
    const order = plans.planOrder as string[];
    const currentIndex = order.indexOf(currentId);
    /* #391 — an account on the hidden rung is not on the offered ladder;
       indexOf answers -1 and every offered rung would then read as "above",
       turning downgrades into a top-up offer. There is nothing to add from
       up there, so the honest answer is no options. */
    if (currentIndex < 0) return [];
    const currentCredits =
      plans.tiers[currentId as keyof typeof plans.tiers]?.monthlyCredits ?? 0;
    return plans.subscriptions
      .filter((entry) => order.indexOf(entry.id as string) > currentIndex)
      .map((entry) => ({
        id: entry.id as string,
        name: entry.name,
        credits: entry.credits,
        price: entry.priceInCents,
        delta: entry.credits - currentCredits,
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
  const laddered = Boolean(plans);
  const nothingAbove = laddered && options.length === 0;

  /* The interval rides the preview (#664), so `due today` below is the
     charge for the purchase the toggle describes — not the monthly figure
     wearing an annual page. */
  const { data: preview, isError: previewFailed } = trpc.billing.previewPlanChange.useQuery(
    { newPlan: selectedId as never, interval: annual ? "annual" : "monthly" },
    { enabled: hasSubscription && !!selectedId },
  );

  /*
    #385 — the cycle spend is SUMMED from the ledger, never taken off
    `getStatus`, whose only spend field is a lifetime counter. `null` while it
    loads, which `readCycle` carries through as no rate rather than a zero one.
  */
  const periodStart = status?.currentPeriodStart ? new Date(status.currentPeriodStart) : null;
  const cycleSpend = useCycleSpend(periodStart);
  const rawCycle = useMemo(
    () => readCycle(status, cycleSpend),
    [status, cycleSpend],
  );
  const cycle = useMemo(
    () => (rawCycle ? alignToPreview(rawCycle, preview) : null),
    [rawCycle, preview],
  );
  const burn = useMemo(() => (cycle ? readBurn(cycle) : null), [cycle]);

  const currentCredits = plans?.tiers[currentId as keyof typeof plans.tiers]?.monthlyCredits ?? 0;
  /*
    ⚠ A FREE PLAN HAS NO RATE TO BE BEATEN, so there is nothing to say "up
    from" about — seen in the running app on a free account, where the sentence
    read *"2,778 credits per $1, up from free"*. The old cents-per-credit
    sentence had the same shape (*"down from free"*) and #403 is the commit
    that rewrites it, so it is corrected here rather than filed. On a paid plan
    the comparison is real and the clause is drawn.
  */
  const currentPrice = plans?.tiers[currentId as keyof typeof plans.tiers]?.price ?? 0;
  const delta = selected ? selected.credits - currentCredits : 0;

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
  const dueToday: number | null = hasSubscription
    ? (preview?.immediateCharge ?? null)
    : selected
      ? annual
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
  const quoteReady = dueToday !== null && (!hasSubscription || (!!preview && !previewFailed));

  const submit = () => {
    if (!selected || !quoteReady) return;
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

  const framesNow = framesFor(currentCredits, costPerFrame);
  const framesNext = selected ? framesFor(selected.credits, costPerFrame) : 0;

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

        {/* §7.1 — the reason, from the same four constants as §6a. */}
        {cycle && burn?.emptyOn ? (
          <p className="dp-topup__reason">
            {formatCredits(displaySpent(cycle.spent, cycle.remaining))} of {formatCredits(displayBalance(cycle.spent + cycle.remaining))}{" "}
            spent with {cycle.daysLeft} {cycle.daysLeft === 1 ? "day" : "days"} left in this cycle
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

          <div className="dp-topup__pricerow">
            {annual && !hasSubscription && fullYear > 0 ? (
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
              {formatCreditsPerDollar(priceAMonth(selected.price, annual), selected.credits)}{" "}
              credits per $1
              {currentPrice > 0
                ? `, up from ${formatCreditsPerDollar(priceAMonth(currentPrice, annual), currentCredits)}`
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
              {selected
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
                    + {formatCredits(displayBalance(option.credits - currentCredits))} credits a month
                    <span className="dp-topup__optionprice">
                      {formatDollars(annual ? annualPrice(option.price) : option.price)}
                      {annual ? " / yr" : " / mo"}
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
            {delta > 0
              ? `${formatCredits(displayBalance(delta))} credits land on your balance the moment this goes through — nothing to wait for.`
              : "Your balance updates the moment this goes through."}
          </span>
          {costPerFrame > 0 && selected ? (
            <span className="dp-topup__bullet">
              <Check size={12} strokeWidth={1.8} />
              That is about {framesNext.toLocaleString()} casting frames a month, up from about{" "}
              {framesNow.toLocaleString()} — you would move to {selected.name}.
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
        <p className="dp-topup__renewal">
          {hasSubscription && preview?.kind === "interval-switch"
            ? annual
              ? "Billed for the whole year today — your new billing year starts now, and the year's credits land with the payment."
              : "Billed monthly from today — unused time from your year comes off future bills automatically."
            : hasSubscription && cycle
              ? `Prorated for the ${cycle.daysLeft} ${cycle.daysLeft === 1 ? "day" : "days"} left in this cycle, then ${formatShortDate(cycle.renewsAt)}.`
              : "Charged today, then on the same date each period."}
          {!annual ? ` Pay yearly instead and ${monthsFree()} of the twelve months are free.` : ""}
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
          {working
            ? "Working…"
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
