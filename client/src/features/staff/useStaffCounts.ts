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
      No `refetchInterval`. The bar is not a live surface — the pill is a
      reason to look, and a number that appears within thirty seconds of a
      request landing is soon enough. On Overview it updates with the page
      anyway, because it is the same query.
    */
    retry: false,
  });

  /*
    ⚠ ZERO WHILE LOADING, AND THAT IS THE HONEST DEFAULT rather than a
    placeholder: `SurfaceBarSegment` omits the pill at zero, so an unanswered
    query draws NO pill instead of a wrong one. The failure this avoids is a
    bar that flashes a stale or invented number on every navigation.
  */
  return { pendingChangeRequests: query.data?.governance.pendingChangeRequests ?? 0 };
}
