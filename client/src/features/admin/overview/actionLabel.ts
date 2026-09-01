/**
 * A readable name for an audit action, for the two surfaces that show one.
 *
 * ## Why this exists — the map can never be complete, by construction
 *
 * `AlertsFeed` and `NeedsHuman` both carried `LABEL[action] ?? action`, and the
 * fallback is reached constantly: `getRecentAlerts` selects
 * `severity IN ('critical','warning') OR action IN (…thirteen names…)`, so the
 * **severity arm admits any action the product ever writes** while the label
 * map only knows the thirteen. Driven on the real dashboard, **nine of twelve
 * rows printed a raw dotted identifier** — `credits.admin_added`,
 * `admin.action`, `auth.email_verification_failed`, and the critical card at
 * the very top of the page read `security.unauthorized_admin_access`.
 *
 * Extending the map is not the fix; the map is a list shadowing a source of
 * truth and would drift again the next time an action is added (working law 4).
 * **The fix is a derivation**: turn the identifier the code already carries
 * into words, and keep the hand-written labels only where a better phrase
 * exists than the identifier can give.
 *
 * It deliberately invents no meaning. `credits.admin_added` becomes
 * "Credits · admin added", not "An admin granted credits" — the second would be
 * a claim about what happened, and this module cannot know that. It is a
 * typographic change, not an interpretation.
 */

/** The thirteen with a phrase better than their identifier. */
const NAMED: Record<string, string> = {
  "account.auto_frozen": "Auto-frozen",
  "account.frozen": "Frozen by staff",
  "account.unfrozen": "Unfrozen",
  "admin.account_suspended": "Suspended",
  "admin.account_unsuspended": "Unsuspended",
  "admin.ip_blocked": "IP blocked",
  "security.rate_limit": "Rate limit",
  "abuse.detected": "Abuse detected",
  "abuse.credits_exploit_attempt": "Credit exploit attempt",
  "abuse.billing_anomaly": "Billing anomaly",
  "abuse.global_attack_detected": "Global attack detected",
  "security.emergency_action": "Emergency action",
  "billing.stripe_refund_issued": "Refund issued",
};

export function actionLabel(action: string): string {
  const named = NAMED[action];
  if (named) return named;

  const segments = action
    .split(".")
    .map((segment) => segment.replace(/_/g, " ").trim())
    .filter(Boolean);
  if (segments.length === 0) return action;

  /* Sentence case on the first segment only — the rest are qualifiers, and
     title-casing every word is how an audit feed starts shouting. */
  const [first, ...rest] = segments;
  const lead = first.charAt(0).toUpperCase() + first.slice(1);
  return [lead, ...rest].join(" · ");
}
