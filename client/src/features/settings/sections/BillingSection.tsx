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
 */
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

import { Bar, SettingsGroup, SettingsRow } from "../parts";
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
  planName: string;
  planPriceInCents: number;
  allowance: number;
  balance: number;
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

  const remainingShare = allowance > 0 ? balance / allowance : 0;
  const invoices = invoicesData?.invoices ?? [];

  return (
    <>
      <SettingsGroup title="Plan">
        <SettingsRow
          label={planName}
          note={[
            planPriceInCents > 0 ? `${formatDollars(planPriceInCents)}/mo` : "No charge",
            allowance > 0 ? `${allowance.toLocaleString()} credits/mo` : null,
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
        </SettingsRow>
      </SettingsGroup>

      <div className="dp-set__cards" style={{ marginTop: "var(--s-7)" }}>
        <div className="dp-set__minicard">
          <span className="dp-set__minilabel">CREDITS REMAINING</span>
          <span className="dp-set__mininum">{balance.toLocaleString()}</span>
          <Bar ratio={remainingShare} token="--ink" />
          <span className="dp-set__note">
            {allowance > 0
              ? `${Math.round(remainingShare * 100)}% of this month's allowance left · `
              : ""}
            <button type="button" className="dp-set__linkbtn" onClick={onAddCredits}>
              more credits
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
          invoices.map((invoice) => (
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
          ))
          )}
        </SettingsGroup>
      </div>
    </>
  );
}
