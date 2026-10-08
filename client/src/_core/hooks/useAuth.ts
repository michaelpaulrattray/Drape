import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

/**
 * WAS THE SESSION REFUSED, OR COULD IT NOT BE CHECKED? — #1997.
 *
 * Since #1990 the server answers `auth.me` with an error only when it could
 * not FINISH checking the session (a database blink is `503
 * SERVICE_UNAVAILABLE`); a session that is genuinely refused still answers
 * `null`, exactly as before. Before this, the query ran with `retry: false`,
 * so one blink on a cold page load left `user` null and `loading` false — and
 * every page that reads that pair as "signed out" (the lobby at `/app`, the
 * studio, the admin pages) sent a signed-in customer to the sign-in page.
 *
 * A check that could not finish is retried instead (react-query's own
 * backoff: 1s, 2s, 4s … capped at 30s) and the hook stays `loading` while it
 * does, so those pages keep showing their loading state and recover on their
 * own when the database answers. A DETERMINISTIC refusal (any 4xx but 429)
 * is not retried and behaves exactly as it did.
 *
 * This is presentation only — the server is what refuses. Nothing here can
 * grant access; at worst a page waits.
 */
export function isTransientSessionCheckFailure(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  const httpStatus: unknown = error.data?.httpStatus;
  // No status at all: the request never got an answer (network, a proxy
  // dropping the connection mid-deploy) — the same "could not check".
  if (typeof httpStatus !== "number") return true;
  return httpStatus >= 500 || httpStatus === 429;
}

export const AUTH_ME_QUERY_OPTIONS = {
  retry: (_failureCount: number, error: unknown) =>
    isTransientSessionCheckFailure(error),
  refetchOnWindowFocus: false,
} as const;

/**
 * WHEN A WAIT STOPS BEING A BLINK AND STARTS BEING SOMETHING TO SAY — #2018.
 *
 * Since #1997 a check that could not finish is retried with no count limit
 * and the hook stays `loading`, which is right: it never signs a customer
 * out. But the pages that guard themselves draw nothing while loading, so a
 * sustained outage read as a dead blank page. After this many failed
 * attempts in a row — with react-query's backoff (1s, 2s, 4s …) that is a
 * few seconds of trying, never an ordinary load and never a single blink —
 * the hook also says `reconnecting`, and those pages show a calm line while
 * the retries carry on underneath. The first success clears it.
 *
 * Only reached while still `loading`: a refused session settles at once
 * (no retry), so it can never show this and still redirects immediately; and
 * a signed-in page whose BACKGROUND re-check is failing keeps its data, so it
 * is never swapped for the notice (`failureCount` alone would do exactly that).
 */
export const AUTH_ME_RECONNECTING_AFTER_FAILURES = 3;

export function isSessionCheckReconnecting(result: {
  isLoading: boolean;
  failureCount: number;
}): boolean {
  return (
    result.isLoading &&
    result.failureCount >= AUTH_ME_RECONNECTING_AFTER_FAILURES
  );
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, AUTH_ME_QUERY_OPTIONS);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      reconnecting: isSessionCheckReconnecting(meQuery),
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    meQuery.failureCount,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
