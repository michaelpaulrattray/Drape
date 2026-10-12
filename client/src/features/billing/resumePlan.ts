/**
 * TAKING A CANCEL BACK — #2395.
 *
 * Before this card a customer who pressed **Cancel plan** and then changed
 * their mind had no way back inside Klieg. Settings → Billing said *"ends
 * {date} · won't renew"* with only Change plan beside it; Change plan still
 * offered Cancel plan as if nothing had happened; and a lower plan was refused
 * with *"Resume your plan first"* — naming a control that existed nowhere.
 * `billing.reactivateSubscription` had been on the server the whole time with
 * no caller in the client.
 *
 * ⚠ **ONE MODULE FOR BOTH SURFACES (working law 4).** The Billing tab and the
 * Change plan dialog each offer Resume plan; they read the same decision and
 * fire the same mutation from here, so the two can never disagree about when
 * a plan counts as cancelled or what the receipt says.
 */
import { toast } from "sonner";
import { planResumedReceipt } from "@shared/planCancelCopy";

import { trpc } from "@/lib/trpc";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

/**
 * Is this plan set to end at its period end? Read off
 * `billing.getSubscriptionDetails`, which asks Stripe — there is no column
 * holding it, so this is the only reader there is.
 *
 * `null` = NOT READ YET (or unreadable). It is never "not cancelled": an
 * unread state offers neither Resume nor Cancel, rather than guessing.
 */
export type CancelState = "cancelled" | "renewing" | null;

export function cancelStateOf(
  details: { cancelAtPeriodEnd: boolean } | null | undefined,
  settled: boolean,
): CancelState {
  if (!settled) return null;
  /* A settled read with no details is a subscription Stripe could not
     describe. Treat it as renewing: hiding Cancel plan from a paying customer
     because one read failed would leave them no way to stop paying. */
  if (!details) return "renewing";
  return details.cancelAtPeriodEnd === true ? "cancelled" : "renewing";
}

/**
 * Which plan control the Change plan dialog's footer offers. A subscriber on
 * a renewing plan may cancel; a subscriber whose plan is set to end may
 * resume it, and is NOT offered Cancel plan a second time.
 */
export function planFootControl(
  hasSubscription: boolean | null,
  cancelState: CancelState,
): "cancel" | "resume" | null {
  if (hasSubscription !== true) return null;
  if (cancelState === null) return null;
  return cancelState === "cancelled" ? "resume" : "cancel";
}

/**
 * The mutation, with its receipt. `periodEnd` is the same `getStatus` period
 * end the cancel receipt and the Billing line quote, so the date a customer
 * is told it renews on is the date they were told it would end.
 */
export function useResumePlan(periodEnd: Date | string | null | undefined) {
  const utils = trpc.useUtils();
  return trpc.billing.reactivateSubscription.useMutation({
    onSuccess: () => {
      toast.success(planResumedReceipt(periodEnd));
      /* The cancelled state lives on the details read; the plan line lives on
         status. Both, or the Billing tab goes on saying "won't renew". */
      void utils.billing.getSubscriptionDetails.invalidate();
      void utils.billing.getStatus.invalidate();
    },
    onError: (error) => {
      logRawFailure("billing.reactivateSubscription", error);
      toast.error(
        readableFailure(error, "We couldn't resume your plan. Check Billing before trying again."),
      );
    },
  });
}
