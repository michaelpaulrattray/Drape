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
  formatCentsPerCredit,
  formatDollars,
  formatShortDate,
  monthsFree,
  readBurn,
  readCycle,
} from "@/features/settings/planMath";
import { framesFor } from "@/features/settings/planLadder";

export function AddCreditsModal({ onClose }: { onClose: () => void }) {
  const [annual, setAnnual] = useState(false);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();
  const { data: costs } = trpc.credits.getCosts.useQuery();
  const utils = trpc.useUtils();

  const currentId = status?.planTier ?? "free";
  const hasSubscription = !!status?.hasSubscription;
  const costPerFrame = costs?.castingImage ?? 0;

  /* Every rung ABOVE the current one — the only ones that add credits. */
  const options = useMemo(() => {
    if (!plans) return [] as { id: string; name: string; credits: number; price: number }[];
    const order = plans.planOrder as string[];
    const currentIndex = order.indexOf(currentId);
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

  const { data: preview } = trpc.billing.previewPlanChange.useQuery(
    { newPlan: selectedId as never },
    { enabled: hasSubscription && !!selectedId },
  );

  const rawCycle = useMemo(() => readCycle(status), [status]);
  const cycle = useMemo(
    () => (rawCycle ? alignToPreview(rawCycle, preview) : null),
    [rawCycle, preview],
  );
  const burn = useMemo(() => (cycle ? readBurn(cycle) : null), [cycle]);

  const currentCredits = plans?.tiers[currentId as keyof typeof plans.tiers]?.monthlyCredits ?? 0;
  const delta = selected ? selected.credits - currentCredits : 0;

  const fullYear = selected ? selected.price * 12 : 0;
  const dueToday = hasSubscription
    ? (preview?.immediateCharge ?? 0)
    : selected
      ? annual
        ? annualPrice(selected.price)
        : selected.price
      : 0;

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

  const submit = () => {
    if (!selected) return;
    setWorking(true);
    if (!hasSubscription) {
      checkout.mutate({
        plan: selected.id as never,
        interval: annual ? "annual" : "monthly",
      });
      return;
    }
    changePlan.mutate({ newPlan: selected.id as never, clientRequestId: crypto.randomUUID() });
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
            {cycle.spent.toLocaleString()} of {(cycle.spent + cycle.remaining).toLocaleString()}{" "}
            spent with {cycle.daysLeft} {cycle.daysLeft === 1 ? "day" : "days"} left in this cycle
            — at this rate the balance runs out on {formatShortDate(burn.emptyOn)}
            {burn.dryDays > 0
              ? `, ${burn.dryDays} ${burn.dryDays === 1 ? "day" : "days"} before it resets`
              : ""}
            .
          </p>
        ) : (
          <p className="dp-topup__reason">
            {(status?.balance ?? 0).toLocaleString()} credits on the balance today.
          </p>
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
              onClick={() => setAnnual((on) => !on)}
            />
          </div>

          <div className="dp-topup__pricerow">
            {annual && !hasSubscription && fullYear > 0 ? (
              <span className="dp-topup__struck">{formatDollars(fullYear)}</span>
            ) : null}
            <span className="dp-topup__due">{formatDollars(dueToday)}</span>
            <span className="dp-topup__duenote">due today</span>
          </div>

          {/*
            ⚠ THE UNIT PRICE IS ON ITS OWN LINE, NOT RIGHT-ALIGNED BESIDE THE
            FIGURE. §7.2 draws it beside; at 436px it does not fit — a 30px
            tabular figure plus `due today` plus two unit prices ran past the
            card and clipped on `overflow: hidden`, which is §3 rule 2's failure
            in a different guise. Seen in the running app before it shipped.
          */}
          {selected ? (
            <span className="dp-set__value">
              {formatCentsPerCredit(selected.price, selected.credits)} a credit, down from{" "}
              {formatCentsPerCredit(
                plans?.tiers[currentId as keyof typeof plans.tiers]?.price ?? 0,
                currentCredits,
              )}
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
              {selected ? `+ ${delta.toLocaleString()} credits a month` : "No higher plan"}
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
                    + {(option.credits - currentCredits).toLocaleString()} credits a month
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
              ? `${delta.toLocaleString()} credits land on your balance the moment this goes through — nothing to wait for.`
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

        {/* §7.4 — the renewal line, branching on interval. */}
        <p className="dp-topup__renewal">
          {hasSubscription && cycle
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
        <Button variant="primary" size="small" onClick={submit} disabled={!selected || working}>
          {working ? "Working…" : `Add credits · ${formatDollars(dueToday)}`}
        </Button>
      </div>
    </ModalScrim>
  );
}
