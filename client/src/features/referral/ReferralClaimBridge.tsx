import { useReferralClaim } from "./useReferralClaim";

/**
 * The client half of the referral link, mounted ONCE at the app root.
 *
 * Settings hands every customer `…/?ref=DRAPE-XXXXXX` under a Copy button
 * (`ReferralBlock.tsx`), and `useReferralClaim` is the hook written to catch
 * that code on landing and claim it after login. Its only importer ever was
 * `pages/Dashboard.tsx`, deleted on 2026-04-04 (`98931f66`, *"Removed the
 * legacy /dashboard page"*) — so for five months the link a customer sent a
 * friend did nothing when the friend opened it (#1010). This is the wire.
 *
 * Renders nothing. It sits beside `GenerationOperationBridge` because it has
 * the same shape: a root-mounted effect that needs `useAuth` and `trpc`, on
 * every route, including the anonymous landing page where the code arrives.
 */
export function ReferralClaimBridge() {
  useReferralClaim();
  return null;
}
