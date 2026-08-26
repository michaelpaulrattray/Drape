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

/**
 * How often the PAGE re-reads it while it is open and visible (#133 — his
 * ask, verbatim: *"is there a way to have the desk page auto refresh on every
 * update or whatever to make it feel more live? because i keep hard
 * refreshing it"*). A deploy lands about every few minutes at the busiest;
 * a minute is the coarsest interval that still beats his hand on F5.
 */
export const CREW_LIVE_INTERVAL_MS = 60_000;

export function useCrewState(enabled: boolean, options?: { live?: boolean }) {
  const live = options?.live === true;
  return trpc.crew.getState.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: CREW_STALE_MS,
    /*
      THE DARK FLAG NEVER POLLS — AND A FAILED POLL NEVER LATCHES THE PAGE
      DEAD. staleTime only governs SUCCESSFUL data — a NOT_FOUND is always
      stale, so an unconditional focus refetch or interval would refire this
      on every window focus for every admin outside the scope, which is the
      repeat `retry: false` exists to avoid. Both are therefore gated on the
      query HOLDING DATA, and on the page asking to be live (the shared admin
      header asks only for the nav gate).

      Holding data, not `status === "success"` (Fable review of PR #135,
      finding 1): in TanStack v5 a failed REFETCH sets status to "error" while
      the cached briefing stays — and the likeliest poll to fail is the one
      that fires into a deploy restart, which is the only event that ever
      produces a new edition. Gated on status, that one 502 would have stopped
      every later tick and every focus refetch, and the page would have aged
      honestly until he hard-refreshed — #133's complaint, rebuilt. A
      NOT_FOUND query never acquires data, so the dark flag still makes one
      request per mount and none on focus.
    */
    refetchInterval: (query) => (live && query.state.data !== undefined ? CREW_LIVE_INTERVAL_MS : false),
    /* Paused while the tab is hidden — a briefing nobody is looking at needs
       no re-reading, and it resumes on the next visible tick. */
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => live && query.state.data !== undefined,
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
