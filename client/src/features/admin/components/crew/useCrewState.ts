/**
 * The Crew tab's one query, and the nav gate that rides on it.
 *
 * `crew.getState` answers `NOT_FOUND` outside `CREW_TAB_SCOPE`, so the SUCCESS
 * of this query is the only thing the client needs to know about the flag —
 * there is no separate capability endpoint and no flag value on the wire.
 * `retry: false` matters: a retrying query would spend three round trips
 * discovering a `NOT_FOUND` that is never going to change, on every admin page
 * load, for every admin outside the scope (which today is all of them).
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/** How often the briefing is re-read. It only changes on a deploy. */
const CREW_STALE_MS = 30_000;

export function useCrewState(enabled: boolean) {
  return trpc.crew.getState.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: CREW_STALE_MS,
    /* staleTime only governs SUCCESSFUL data — a NOT_FOUND is always stale,
       so with the default focus refetch on, a dark flag would refire this on
       every window focus for every admin, which is the repeat `retry: false`
       exists to avoid. The nav updates on mount and on send; focus adds
       nothing a briefing needs. */
    refetchOnWindowFocus: false,
  });
}

/**
 * Whether the Crew tab exists for this viewer — asked by the shared admin
 * header, which every admin page renders.
 *
 * The same query key as the page's own, so opening `/admin/crew` from the nav
 * costs nothing extra: TanStack Query already holds the answer the header
 * asked for.
 */
export function useCrewTabVisible(): boolean {
  const { user, isAuthenticated } = useAuth();
  const query = useCrewState(isAuthenticated && user?.role === "admin");
  return query.isSuccess;
}
