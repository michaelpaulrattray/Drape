import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

import { useStaffAutoRefresh } from "./stores/useStaffAutoRefreshStore";
import { STAFF_REFRESH_INTERVAL_MS } from "./useStaffRefresh";

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
 * # What it costs — corrected by #457, which put it on a timer
 *
 * TanStack Query keys on procedure + input, so on `/admin/overview` this hook
 * and the page share one cache entry: same request, same data, and the page's
 * own 30s poll already refreshed the pill for free.
 *
 * ⚠ **Everywhere else it was one call per mount until 2026-09-10, and it is a
 * 30s poll now** — his word on #457, *"the cost of polling is accepted"*,
 * because nothing else can make an ARRIVING request reach the bar while he sits
 * still. It follows the shared `AUTO 30s` switch, so it is a poll he can stop.
 * The full cost, including the account-menu badge carrying it onto non-staff
 * pages for an admin, is written out at the option itself.
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
  const [autoRefresh] = useStaffAutoRefresh();
  const query = trpc.admin.getOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: STALE_MS,
    /*
      ⚠ **IT POLLS NOW, AND HE ORDERED THE COST** (#457, 2026-09-10, verbatim):
      *"fix it — a moderator request arriving while he sits still must reach the
      bar without him moving; the cost of polling is accepted."*

      Everything the previous note said about the mechanics is still true and is
      why the poll is the only repair: **`staleTime` makes a refetch PERMISSIBLE
      at the next trigger; it schedules nothing**, and the QueryClient is stock
      (`main.tsx`), so the triggers are remount and window refocus. Neither
      fires while he sits on one page. Invalidation cannot close it either — the
      mutation that RAISES the count runs in the moderator's session, and a
      moderator's browser cannot invalidate an admin's cache.

      **It follows the shared `AUTO 30s` switch rather than a timer of its
      own**, so the control he already has over the panel's polling governs this
      too: switch it off and the pill goes back to moving on navigation and
      refocus. The interval is imported from the hook that draws the label, so
      the switch cannot come to say `30s` while this reads something else (#455
      was exactly that defect, four readers deep).

      ⚠ **THE COST, NAMED RATHER THAN LEFT TO BE DISCOVERED.** `getOverview`
      runs seven aggregations, and this hook feeds the account-menu badge as
      well as the bar — so for an ADMIN account, with the switch on, that query
      now runs every 30s wherever the chrome renders, which includes the lobby
      and casting, not only the eight staff pages. `enabled` keeps every other
      role at zero calls. This is stated on #457 and in the PR; a cheaper
      count-only reader is the repair if it is ever measured to matter, and it
      is one file, exactly as this hook's own note above says.

      ⚠ **`refetchInterval` IS OBSERVER-SCOPED, WHICH IS WHY IT MAY BE SET
      HERE AT ALL.** On `/admin/overview` this hook and the page observe the
      SAME query key; a FETCH-level option (`retry` and friends) set here is
      resolved from the last observer and changes the PAGE's behaviour, which is
      the defect the gate review of PR #456 caught. Each observer keeps its own
      interval timer, so the page's poll is untouched — the two timers can land
      apart inside one 30s window, and the only consequence is that Overview may
      answer twice in a window instead of once.
    */
    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,

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
