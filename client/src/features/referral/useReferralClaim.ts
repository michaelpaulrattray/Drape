import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { keepsReferralCodeAfterError } from "./referralClaimRetry";

const REFERRAL_STORAGE_KEY = "drape_referral_code";

/**
 * Captures ?ref=CODE from the URL on landing and stores it in localStorage.
 * After the user logs in, automatically claims the referral.
 */
export function useReferralClaim() {
  const { user } = useAuth();
  const claimMutation = trpc.referral.claim.useMutation();
  const hasClaimed = useRef(false);

  // Step 1: Capture ref param from URL on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, refCode);
      // Clean the URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Step 2: Claim referral after login
  useEffect(() => {
    if (!user || hasClaimed.current) return;

    const storedCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!storedCode) return;

    hasClaimed.current = true;
    claimMutation.mutate(
      { referralCode: storedCode },
      {
        onSuccess: () => {
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        },
        onError: (error) => {
          // A designed refusal (invalid / self / already used) is a 200 with
          // `claimed: false` and lands above. An ERROR is kept for the next
          // login unless the code can never succeed (#1016).
          if (!keepsReferralCodeAfterError(error)) {
            localStorage.removeItem(REFERRAL_STORAGE_KEY);
          }
        },
      }
    );
  }, [user, claimMutation]);
}
