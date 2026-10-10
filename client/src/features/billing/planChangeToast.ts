/**
 * THE ONE WAY A PLAN CHANGE'S ANSWER IS SAID (#2190) — both doors to
 * `billing.changePlan` (the plan picker and Add credits) close their dialog on
 * success, so the toast is the only surface left to carry the answer (D-110's
 * fallback channel), and the two must say it the same way.
 *
 * The ordinary answer is one short sentence. The new case is a change held for
 * the customer's BANK to confirm: nothing has happened yet, and the only thing
 * that finishes it is the confirmation page, so that page sits behind a
 * "Confirm payment" button on the toast, and the toast waits for the customer
 * rather than vanishing in two seconds. A new tab is opened from the click
 * itself, which a browser allows; opening it when the request resolves would
 * be a pop-up that most browsers block.
 */
import { toast } from "sonner";

/** How long the confirmation toast stays without a click — long enough to read
 *  two sentences and decide. A customer who lets it go has lost nothing: the
 *  change stays held at most 23 hours and lapses unpaid, and asking for it
 *  again raises a fresh confirmation. */
const CONFIRM_TOAST_MS = 30_000;

export function announcePlanChange(data: {
  message: string;
  confirmPaymentUrl?: string | null;
}): void {
  const url = data.confirmPaymentUrl;
  if (!url) {
    toast.success(data.message);
    return;
  }
  toast(data.message, {
    duration: CONFIRM_TOAST_MS,
    action: {
      label: "Confirm payment",
      onClick: () => {
        window.open(url, "_blank", "noopener");
      },
    },
    actionButtonStyle: {
      background: "var(--surface)",
      color: "var(--ink)",
      borderRadius: 999,
      padding: "4px 10px",
      font: "600 11.5px/1.35 var(--font-sans)",
      marginLeft: 8,
      flexShrink: 0,
    },
  });
}
