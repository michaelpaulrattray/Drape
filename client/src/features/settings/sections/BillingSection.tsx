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

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

import { Bar, SettingsCard, SettingsGroup, SettingsList } from "../parts";
import { ReferralBlock } from "../ReferralBlock";
import { formatDollars, formatShortDate } from "../planMath";

export function BillingSection({
  planName,
  planPriceInCents,
  allowance,
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
  const invoices = invoicesData?.invoices ?? [];

  return (
    <>
      <SettingsGroup title="Billing & plan">
        <SettingsCard
          /* An em dash in the title's own slot — see the prop's docblock (#1741). */
          label={planName ?? "—"}
          note={[
            planPriceInCents === null
              ? null
              : planPriceInCents > 0
                ? `${formatDollars(planPriceInCents)}/mo`
                : "No charge",
            renews && granted ? `${formatCredits(displayBalance(allowance))} credits/mo` : null,
            renewsAt ? `renews ${formatShortDate(renewsAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <Button variant="secondary" size="small" onClick={onChangePlan}>
            Change plan
          </Button>
          <Button variant="primary" size="small" onClick={onAddCredits}>
            Add credits
          </Button>
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
            {quotable
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
            <button type="button" className="dp-set__linkbtn" onClick={onAddCredits}>
              {renews && granted ? "more credits" : "Add more credits"}
            </button>
          </span>
        </div>
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
