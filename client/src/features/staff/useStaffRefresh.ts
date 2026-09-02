import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { StaffRefreshControls } from "./StaffBar";

/**
 * THE REFRESH CLUSTER, AS ONE THING (#413).
 *
 * **His question, 2026-09-01, verbatim:** *"why when scrolling through the
 * admin pages only some pages contain the updated time the auto refresh toggle
 * and a notification button? overview contains it but not all the other pages"*
 *
 * He named three parts. This hook produces all three or none, so a surface
 * cannot ship one of them again.
 *
 * # ⚠ THE CARD'S OWN TABLE UNDERSTATED THIS BY TWO PAGES, AND THE REASON IS
 * WORTH MORE THAN THE FIX
 *
 * #413 measured the problem by grepping every staff page for `refreshControls`
 * and reported five pages as having the cluster. **Read at what those five
 * actually PASS, only three did.** `AdminUserManagement` and
 * `AdminChangeRequests` provided `onRefresh` and `isRefetching` alone — a lone
 * manual button, no stamp, no toggle — so they failed exactly two of the three
 * things he named while satisfying a grep for the prop.
 *
 * That is a shape-match standing where a declaration exists, which is a named
 * class in this repository (CLAUDE.md, the Atlas collectors). **A property is
 * proven at the values, never at the prop name.**
 *
 * # ⚠ AND THE REASON THOSE TWO PAGES GAVE FOR THE OMISSION IS FALSE AT THE CODE
 *
 * Both carried a docblock saying the page *"keeps no `lastRefresh` and no
 * auto-refresh preference … inventing the other two would be state no reader
 * produces (brief 05 §4)."* **Every TanStack query produces `dataUpdatedAt`**,
 * and `AdminOverview` has read the stamp from exactly that field since brief 05
 * shipped. The state was never missing; it was never wired. Brief 05 §4's
 * sentence — *"several surfaces do not poll"* — was true of one surface (Crew),
 * not of several, and is corrected in the brief in the same commit.
 *
 * # What this hook does NOT own
 *
 * The queries. Each page keeps its own `refetchInterval: autoRefresh ? … :
 * false` and its own refetch list, because pages poll different readers at
 * different rates (audit stats at 60s, its logs at 30s) and folding that in
 * would be a second decision wearing this card's clothes.
 *
 * # ⚠ THREE PAGES DELIBERATELY DO NOT USE THIS YET
 *
 * `AdminOverview`, `AdminAuditLogs` and `ModeratorDashboard` already had the
 * whole cluster working before this card and are **left exactly as they are**.
 * Their inline copies differ in ways that are decisions rather than accidents —
 * Overview defaults auto-refresh ON and toasts *"Dashboard refreshed"*, the
 * other two default OFF and toast *"Data refreshed"*, and two of them stamp
 * beside the refetch call rather than off `dataUpdatedAt` — so folding them in
 * is a promotion pass with his eye on the copy, not a side effect of this fix. They
 * are the remaining three consumers and they are named here so the pass can
 * find them. ⚠ **The guard that matters is not "everyone uses this hook" but
 * "no surface shows a PARTIAL cluster"** — that arm is in
 * `section05-guard.test.ts`, it is derived from the pages folder, and it holds
 * across both shapes.
 */
export function useStaffRefresh(options: {
  /** The page's own auto-refresh state. It lives on the page because the
      query's `refetchInterval` needs it one line BEFORE this hook can run. */
  autoRefresh: boolean;
  setAutoRefresh: (next: boolean) => void;
  /** The reader whose freshness the stamp reports — normally the page's list query. */
  dataUpdatedAt: number;
  /** True while any of the page's readers is in flight; spins the manual button. */
  isRefetching: boolean;
  /** Refetch everything the page shows. Called by the manual button. */
  onRefresh: () => void;
}): StaffRefreshControls {
  const { autoRefresh, setAutoRefresh, dataUpdatedAt, isRefetching, onRefresh } = options;

  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());

  /*
    ⚠ THE STAMP IS DERIVED FROM THE QUERY, NEVER SET BESIDE A REFETCH CALL.
    Working law 4. A `setLastRefresh(new Date())` next to `refetch()` stamps the
    moment the request LEFT, so a slow or failed reader reports fresh data that
    never arrived. `dataUpdatedAt` moves only when data actually landed.
  */
  useEffect(() => {
    if (dataUpdatedAt) setLastRefresh(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  /*
    The toast is raised beside the setter rather than inside an updater
    function: React strict mode invokes an updater twice, so a side effect in
    one fires twice and the founder sees two toasts per click.
  */
  const onToggleAutoRefresh = useCallback(() => {
    setAutoRefresh(!autoRefresh);
    toast.info(autoRefresh ? "Auto-refresh paused" : "Auto-refresh enabled (30s)");
  }, [autoRefresh, setAutoRefresh]);

  /*
    ⚠ ALL THREE PARTS ARE RETURNED TOGETHER AND THERE IS NO WAY TO ASK FOR ONE.
    That is the whole point of the hook: the defect this card fixes is a surface
    passing `onRefresh` alone, which satisfies every grep for `refreshControls`
    and still fails two of the three things he named.
  */
  return { lastRefresh, autoRefresh, onToggleAutoRefresh, onRefresh, isRefetching };
}

/** The interval every surface using this hook polls at, when auto-refresh is on. */
export const STAFF_REFRESH_INTERVAL_MS = 30_000;
