/**
 * Moderation's sections — the vocabulary, in one place.
 *
 * It used to live inside `TabNavigation.tsx` along with the pill markup that
 * drew it. Brief 05 moves the drawing to the staff bar and leaves the list
 * here, which is where it belongs: WHICH sections moderation has is a fact
 * about moderation, not about a bar.
 *
 * ⚠ **The order is the one `TabNavigation` already had.** The founder's
 * prototype draws six tabs in a different order and under different names
 * (`Flagged`, `Referrals`, `Reconciliation`…); his own §5 settles it —
 * *"the repo's routes are the truth … do not drop a tab because my list lacks
 * it."*
 *
 * ⚠ **The labels are SENTENCE CASE now** (§5, *"`Audit logs`, not `Audit
 * Logs`"*) — house voice, matching the seven admin tabs beside them.
 */
export type ModeratorTab =
  | "audit-logs"
  | "users"
  | "blocked-ips"
  | "flagged-referrals"
  | "my-requests";

export const MODERATOR_TABS: { id: ModeratorTab; label: string }[] = [
  { id: "audit-logs", label: "Audit logs" },
  { id: "users", label: "User investigation" },
  { id: "blocked-ips", label: "Blocked IPs" },
  { id: "flagged-referrals", label: "Flagged referrals" },
  { id: "my-requests", label: "My requests" },
];
