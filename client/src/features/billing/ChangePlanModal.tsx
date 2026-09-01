/**
 * CHANGE PLAN — *"which plan should I be on"* (brief §6).
 *
 * The plan-picker half of `BillingModal`, on its own surface. §1 forbids
 * folding it into a Settings section and gives the reason: a pricing comparison
 * does not fit an 880px modal that has already spent 186px on a nav column, and
 * it opens from four places Settings does not.
 *
 * **Nothing about the mutations changed.** `previewPlanChange` still previews,
 * `changePlan` still changes, `createSubscriptionCheckout` still opens Stripe
 * for an account with no subscription, `cancelSubscription` is still what
 * dropping to Free means. §1: *"Only where they live and how they look."*
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
 * 4. **`FITS YOUR USE` outranks `YOU ARE HERE`.** In the prototype the
 *    recommendation fell into a faint fallback branch, making the plan being
 *    sold the dimmest thing in the view built for comparing.
 *
 * ## What the reconciliation changed (BRIEF-RECONCILIATION Q3)
 *
 * The brief's ladder is five rungs at `2.79¢ … 1.87¢`; **ours is twelve** at
 * 0.036¢ down to 0.016¢ a credit. The population of both modes is derived from
 * `billing.getPlans` in `planLadder.ts` — see its header for the whole reading
 * — and the compare control says `Compare plans` rather than `Compare all 5`.
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
 * 5. **§6c's blurb slot ships EMPTY and says so** — the frames line that was
 *    filling it is what the credits make and now sits in the credits block.
 * 6. **`.dp-plan__tab--inline`** replaces an inline style override.
 */
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { ConfirmDialog } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
  formatShortDate,
  formatWholeDollars,
  formatCreditsPerDollar,
  monthlyEquivalent,
  monthsFree,
  readBurn,
  readCycle,
} from "@/features/settings/planMath";
import {
  cardTrio,
  compareWindow,
  framesFor,
  recommendPlan,
  rolloverSentence,
  type LadderPlan,
} from "@/features/settings/planLadder";

type Interval = "monthly" | "annual";

/**
 * The one thing that is true of every rung, said ONCE for both modes.
 *
 * §6d: *"a row where all plans agree carries no decision value; it belongs in
 * the footnote."* Card mode used to say it twelve times as a check-mark list on
 * every card and compare mode said it once, correctly, underneath. Two copies
 * of one sentence in one file is working law 4 in miniature — so there is one,
 * and the two modes read it.
 */
const ONE_FOR_EVERY_PLAN =
  "Every plan carries every model and every tool — the only differences are the ones shown above.";

export function ChangePlanModal({
  onClose,
  onAddCredits,
}: {
  onClose: () => void;
  onAddCredits: () => void;
}) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [compare, setCompare] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmingDrop, setConfirmingDrop] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.billing.getStatus.useQuery();
  const { data: costs } = trpc.credits.getCosts.useQuery();
  const utils = trpc.useUtils();

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
    },
  });

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

  const currentId = status?.planTier ?? "free";
  const hasSubscription = !!status?.hasSubscription;
  const costPerFrame = costs?.castingImage ?? 0;

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

  const currentName = ladder.find((plan) => plan.id === currentId)?.name ?? null;

  const cycle = useMemo(() => readCycle(status), [status]);
  const burn = useMemo(() => (cycle ? readBurn(cycle) : null), [cycle]);
  const projected = cycle && burn ? Math.round(burn.perDay * cycle.cycleLength) : 0;
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
  */
  const priceOf = (plan: LadderPlan) =>
    interval === "annual" ? monthlyEquivalent(plan.priceInCents) : plan.priceInCents;

  const act = (plan: LadderPlan) => {
    setPending(plan.id);
    if (!hasSubscription) {
      checkout.mutate({ plan: plan.id as never, interval });
      return;
    }
    changePlan.mutate({ newPlan: plan.id as never, clientRequestId: crypto.randomUUID() });
  };

  /*
    §6c: EXACTLY ONE ink button per view — the next tier up. Everything beyond
    it is a further move rather than the offer being made, and downgrades are
    secondary on purpose.
  */
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
  const offered =
    recommended ?? ladder.find((plan, index) => index === currentIndex + 1) ?? null;
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
                {cycle.spent.toLocaleString()} of {(cycle.spent + cycle.remaining).toLocaleString()}{" "}
                spent with {cycle.daysLeft} {cycle.daysLeft === 1 ? "day" : "days"} still to go
                {burn.dryDays > 0
                  ? `, which leaves you ${burn.dryDays} ${burn.dryDays === 1 ? "day" : "days"} short of ${formatShortDate(cycle.renewsAt)}`
                  : ""}
                . {recommended.name} covers the way you are actually working, and today&apos;s
                charge is only the difference for the days left.
              </p>
            </div>
            <div className="dp-plan__reasonstat">
              <span className="dp-set__minilabel">THIS MONTH</span>
              <p className="dp-plan__credits">
                {cycle.spent.toLocaleString()} / {(cycle.spent + cycle.remaining).toLocaleString()}
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
          <span className="dp-segmented" role="group" aria-label="Billing interval">
            <button
              type="button"
              className={`dp-segmented__seg${interval === "monthly" ? " dp-segmented__seg--on" : ""}`}
              aria-pressed={interval === "monthly"}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`dp-segmented__seg${interval === "annual" ? " dp-segmented__seg--on" : ""}`}
              aria-pressed={interval === "annual"}
              onClick={() => setInterval("annual")}
            >
              Annual
              <span className="dp-plan__badge">{monthsFree()} MONTHS FREE</span>
            </button>
          </span>
          <button
            type="button"
            className="dp-plan__modeswitch"
            onClick={() => setCompare((open) => !open)}
          >
            {compare ? "Back to the nearest three" : "Compare plans"}
          </button>
        </div>

        {compare ? (
          <CompareGrid
            plans={window5}
            currentId={currentId}
            recommendedId={recommended?.id ?? null}
            interval={interval}
            costPerFrame={costPerFrame}
            currentIndex={currentIndex}
            ladder={ladder}
            pending={pending}
            onAct={act}
          />
        ) : (
          <>
          <div className="dp-plan__grid">
            {trio.map((plan) => {
              const isCurrent = plan.id === currentId;
              const isRecommended = plan.id === recommended?.id;
              const rollover = rolloverSentence(plan.rolloverPercent);
              const frames = framesFor(plan.credits, costPerFrame);
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
                      {formatCreditsPerDollar(plan.priceInCents, plan.credits)} CREDITS PER $1
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
                    ⚠ **§6c'S BLURB SLOT IS DELIBERATELY EMPTY, AND THAT IS THE
                    HONEST ANSWER RATHER THAN A GAP NOBODY NOTICED** (card 390
                    item 5). It asks for *"one line, a positioning statement"*.
                    There is no server field for one, and there never was —
                    what filled the slot was `About N casting frames`, which is
                    not a positioning statement but what the CREDITS make, so
                    it has moved into the credits block below where §6c puts
                    it. Writing twelve marketing lines here would be inventing
                    user-visible claims (the quotation-not-requirement law), and
                    #391 may fold the ladder to seven rungs, so eleven of them
                    could be discarded copy. **The slot is his to fill: carded.**
                  */}
                  {isCurrent ? (
                    <span className="dp-plan__here">ON THIS ONE</span>
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
                    <span className="dp-plan__credits">
                      {plan.credits.toLocaleString()}{" "}
                      <span className="dp-plan__creditsunit">A MONTH</span>
                    </span>
                    {frames > 0 ? (
                      <span className="dp-plan__makes">
                        About {frames.toLocaleString()} casting frames.
                      </span>
                    ) : null}
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
                </article>
              );
            })}
          </div>
          {/*
            ⚠ **THE ONE PERK ON THE CARDS WAS THE ONE THAT DOES NOT DIFFER**
            (card 390 item 3). Every card carried the same `✓ Every model and
            every tool`, which is §6d's own test of a worthless row —
            *"a row where all plans agree carries no decision value; it belongs
            in the footnote"* — applied to a card instead of a table. It is a
            true sentence and it is not lost: it moves to the footnote, which
            is the same place compare mode already, correctly, put it.
            **The check-mark list returns the day a perk actually moves per
            rung, which today none does.**
          */}
          <p className="dp-plan__footnote">{ONE_FOR_EVERY_PLAN}</p>
          </>
        )}

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
        {hasSubscription ? (
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
  recommendedId,
  interval,
  costPerFrame,
  currentIndex,
  ladder,
  pending,
  onAct,
}: {
  plans: LadderPlan[];
  currentId: string;
  recommendedId: string | null;
  interval: Interval;
  costPerFrame: number;
  currentIndex: number;
  ladder: LadderPlan[];
  pending: string | null;
  onAct: (plan: LadderPlan) => void;
}) {
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
        label: "Credits a month",
        mono: true,
        read: (plan) => plan.credits.toLocaleString(),
      },
      {
        label: "What that makes",
        read: (plan) =>
          costPerFrame > 0
            ? `about ${framesFor(plan.credits, costPerFrame).toLocaleString()} frames`
            : "—",
      },
      {
        label: "Credits per dollar",
        mono: true,
        read: (plan) => formatCreditsPerDollar(plan.priceInCents, plan.credits),
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
        read: (plan) =>
          formatWholeDollars(
            interval === "annual" ? monthlyEquivalent(plan.priceInCents) : plan.priceInCents,
          ),
      },
    ];

  return (
    <div className="dp-plan__compare">
      <div className="dp-plan__comparegrid">
        <span className="dp-plan__cell dp-plan__cell--label" />
        {plans.map((plan) => (
          <span key={plan.id} className={cellClass(plan, "dp-plan__cell--head")}>
            {plan.name}
            {/* FITS YOUR USE outranks YOU ARE HERE — §6d. */}
            {plan.id === recommendedId ? (
              /*
                ⚠ **A MODIFIER, NOT AN INLINE STYLE** (card 390 item 6). This
                read `style={{ position: "static", display: "inline-block" }}`,
                which made `.dp-plan__tab` correct in only one of its two
                contexts — the card's absolute tab — and left the other one
                overridden at the element. *"Inline styles beating a class is
                how the CSS drifts."*
              */
              <span className="dp-plan__tab dp-plan__tab--inline">FITS YOUR USE</span>
            ) : plan.id === currentId ? (
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
            {plan.id === currentId ? (
              <span className="dp-plan__here">ON THIS ONE</span>
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
