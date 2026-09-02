import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * THE ADMIN BAR'S ATTENTION COUNT (#415).
 *
 * **His ask, 2026-09-01, verbatim:** *"the notification button needs to count
 * any requests sent from moderators to admin. e.g if mods sent 5 requests to
 * the admin panel it shold show 5 requests pending and they should sit as
 * cards at the top of the overview page and when i click the card itl take me
 * to the requests page"*
 *
 * The cards half was already live (`NeedsHuman`, #397). What was missing is
 * the number in the bar, and the card's answer is a count pill on the
 * `Change requests` tab rather than a separate notification button — a button
 * beside the tab would be two doors to one room.
 *
 * # ⚠ ONE NUMBER, ONE READER — THIS IS THE WHOLE REASON THE HOOK EXISTS
 *
 * The pill, the Overview `NeedsHuman` card and (next, on #416) the account
 * menu's `Admin` badge must all show the SAME number. A bar saying `5` above a
 * card saying `4` is worse than a bar saying nothing, and working law 4 says a
 * second list shadowing a source of truth always drifts from it.
 *
 * So this does not count anything. It calls `admin.getOverview` — the query
 * `AdminOverview` already runs — and reads `governance.pendingChangeRequests`
 * off it. **There is exactly one reader of that fact in the product
 * (`getGovernanceMetrics`), and this adds no second one.**
 *
 * ⚠ **A dedicated lighter procedure was considered and NOT taken**, and the
 * reason is worth recording because it is the tempting one: `getOverview` runs
 * seven aggregations to produce a number two of them would answer. But a new
 * `getStaffCounts` procedure is a second CALLER that must be kept pointing at
 * the same db function forever, and #415's own §2 asked for the overview data
 * at the bar in those words. If the cost is ever measured to matter, the
 * repair is to make this hook call something cheaper — one file, and the
 * single-source property survives it. **The pill's source is a private detail
 * of this hook by construction; no page reaches past it.**
 *
 * # Why it costs nothing on Overview and one call elsewhere
 *
 * TanStack Query keys on procedure + input, so on `/admin/overview` this hook
 * and the page share one cache entry: same request, same data, and the page's
 * 30s poll refreshes the pill for free. On the other admin pages it is one
 * call per mount, held for `STALE_MS` so moving between tabs does not re-ask.
 *
 * # The gate
 *
 * `enabled` mirrors `useCrewTabVisible`: admins only, and only once auth has
 * answered. `adminProcedure` would refuse anyone else anyway — but a query
 * that fires and fails on every non-admin render is a round trip spent
 * learning something the client already knows.
 */

/** Held this long before a navigation between admin tabs re-asks. */
const STALE_MS = 30_000;

export function useStaffCounts(): { pendingChangeRequests: number } {
  const { user, isAuthenticated } = useAuth();
  const query = trpc.admin.getOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: STALE_MS,
    /*
      ⚠ **NO `refetchInterval`, AND THE SENTENCE THAT USED TO SIT HERE WAS
      FALSE** — it said *"a number that appears within thirty seconds of a
      request landing is soon enough"*, which describes a poll this hook does
      not have. **`staleTime` makes a refetch PERMISSIBLE at the next trigger;
      it schedules nothing.** The QueryClient is stock (`main.tsx`), so the
      triggers are remount and window refocus. Corrected on the gate review of
      PR #456 rather than left as a claim nobody had driven (law 7b).

      What actually refreshes the pill, stated exactly:

      - **Navigating between admin pages** — the bar remounts, and a stale
        query refetches on mount. This is the common case by a distance.
      - **Refocusing the window** — TanStack's default, and the case that
        covers coming back to a tab left open.
      - **Resolving a request** — `AdminChangeRequests` invalidates this query
        in both mutation handlers, so the number he just changed is right
        immediately, on the page where he changed it.

      **What does NOT refresh it: a request ARRIVING while he sits on one page
      without touching anything.** That reaches the pill on his next navigation
      or refocus, and it is filed as #457 with a recommendation rather than
      fixed quietly — wiring this to the shared `AUTO` switch would put seven
      aggregations on a 30s timer across eight pages, which is a decision about
      cost, not a repair.

      On Overview none of this arises: it is the same query the page already
      polls, so the pill moves with the page.
    */

    /*
      ⚠ **NO `retry` OPTION HERE, AND ITS ABSENCE IS THE DECISION** (gate review
      of PR #456, finding 1). This hook had `retry: false`, copied from
      `useCrewState` where it is right for a different reason — that query
      answers NOT_FOUND outside a flag scope, so retrying is three round trips
      to rediscover a permanent no.

      **Here it reached a page it was never about.** `retry` is a FETCH-level
      option: TanStack resolves it from the last observer to set options on the
      query, not per observer the way `staleTime` works. On `/admin/overview`
      this hook and the page observe the SAME key, and the bar renders as a
      child of the page — so `retry: false` landed last and stripped the page's
      three default retries. One transient blip on its 30s poll, which `main`
      absorbs silently, would have drawn *"The dashboard could not load."* over
      a dashboard still showing live data.

      It bought nothing: the non-admin round trip is already prevented by
      `enabled`, and a retried fetch only delays a number that omits itself
      until it arrives.

      **The general shape, worth more than the line: sharing a query key shares
      more than the request.** The PR body's *"on Overview it costs nothing —
      same query key, same request"* was true of COST and not of behaviour.
    */
  });

  /*
    ⚠ ZERO WHILE LOADING, AND THAT IS THE HONEST DEFAULT rather than a
    placeholder: `SurfaceBarSegment` omits the pill at zero, so an unanswered
    query draws NO pill instead of a wrong one. The failure this avoids is a
    bar that flashes a stale or invented number on every navigation.
  */
  return { pendingChangeRequests: query.data?.governance.pendingChangeRequests ?? 0 };
}
