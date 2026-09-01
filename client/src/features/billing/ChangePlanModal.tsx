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
 * 0.036¢ down to 0.016¢. The population of both modes is derived from
 * `billing.getPlans` in `planLadder.ts` — see its header for the whole reading
 * — and the compare control says `Compare plans` rather than `Compare all 5`.
 */
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { ConfirmDialog } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import "@/features/settings/settings.css";
import {
  annualPrice,
  formatDollars,
  formatShortDate,
  formatWholeDollars,
  formatCentsPerCredit,
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

  const priceOf = (plan: LadderPlan) =>
    interval === "annual" ? annualPrice(plan.priceInCents) : plan.priceInCents;

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
        <span className="dp-set__workspace">
          {ladder.find((plan) => plan.id === currentId)?.name ?? "Free"} today
        </span>
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
          <span className="dp-plan__segments" role="group" aria-label="Billing interval">
            <button
              type="button"
              className="dp-plan__segment"
              aria-pressed={interval === "monthly"}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className="dp-plan__segment"
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
                      {formatCentsPerCredit(plan.priceInCents, plan.credits)} A CREDIT
                    </span>
                  </span>
                  <span className="dp-plan__price">
                    {formatWholeDollars(priceOf(plan))}
                    <span className="dp-plan__per">
                      / {interval === "annual" ? "year" : "month"}
                    </span>
                  </span>
                  <span className="dp-plan__credits">
                    {plan.credits.toLocaleString()}{" "}
                    <span className="dp-plan__creditsunit">A MONTH</span>
                  </span>
                  {frames > 0 ? (
                    <span className="dp-plan__blurb">
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
                  <span className="dp-plan__perks">
                    <span className="dp-plan__perk">
                      <Check size={12} strokeWidth={1.8} />
                      Every model and every tool
                    </span>
                  </span>
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
                </article>
              );
            })}
          </div>
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
            {pending === offered.id
              ? "Working…"
              : `Upgrade to ${offered.name} · ${formatDollars(priceOf(offered))}`}
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
        label: "Cost per credit",
        mono: true,
        read: (plan) => formatCentsPerCredit(plan.priceInCents, plan.credits),
      },
      {
        label: "Unspent credits",
        read: (plan) => rolloverSentence(plan.rolloverPercent).text,
      },
      {
        label: interval === "annual" ? "Price a year" : "Price a month",
        mono: true,
        price: true,
        read: (plan) =>
          formatWholeDollars(interval === "annual" ? annualPrice(plan.priceInCents) : plan.priceInCents),
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
              <span className="dp-plan__tab" style={{ position: "static", display: "inline-block" }}>
                FITS YOUR USE
              </span>
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
        Every plan carries every model and every tool — the rows above are the only things
        that change.
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
