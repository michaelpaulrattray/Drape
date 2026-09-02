import { RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import type { ReactNode } from "react";

import { BRAND_NAME, SurfaceBar, type SurfaceBarSegment } from "@/foundation";
import { useCrewTabVisible } from "@/features/admin/components/crew/useCrewState";

/**
 * The staff bar — one bar for Admin and Moderation (brief 05 §4).
 *
 * ## What it replaced, and why the old shape had to go
 *
 * Two headers, not one. `AdminHeader` and `ModeratorHeader` were the same
 * component written twice: each drew its own sticky header, its own `Studio`
 * button, its own `max-w-7xl` column and its own `Live` / `Paused` pair, in
 * its own hex literals. The founder's brief names only the first, because it
 * was drawn on a canvas with no codebase in view; the second is the reason a
 * rename alone would have left the moderator page wearing two headers.
 *
 * **The `Studio` button is gone from both.** It existed because staff used to
 * be somewhere else — nine full-page routes that replaced the app. Now that
 * staff renders inside the shell the rail is always there and is the way back,
 * and a second way back is a control to maintain and explain for no gain.
 *
 * ## The bar is a composition, not a new component
 *
 * `SurfaceBar` in `foundation/` already IS this bar — its own docblock said so
 * before this card existed (*"Cinema's production bar and the staff ops bar
 * are one component with two consumers"*), and its CSS matches the brief's §4
 * container line for line. So what lives here is the part that is genuinely
 * staff's: the two tab sets and the refresh cluster. Anything visual belongs
 * one layer down in the foundation, where the other consumers get it too.
 *
 * ## The refresh cluster is three optional parts, not one block
 *
 * The brief draws stamp + toggle + button as a unit. The pages do not have
 * one: `AdminOverview` and `AdminAuditLogs` keep a `lastRefresh` and an
 * auto-refresh preference; `AdminUserManagement` and `AdminChangeRequests`
 * have only a refetch; four surfaces have nothing at all. **Inventing a
 * timestamp or a polling toggle for the pages that keep neither would be a
 * number no state produces**, so each part appears only when its surface
 * supplies it.
 *
 * ## Both bars are titled `Klieg Console`, and the tagline is gone (#417)
 *
 * His instruction, verbatim: *"in the top bar where it says klieg studio change
 * this on both the admin and the mod pages to be somthing more relevant e.g
 * just Klieg or Klieg Studio is fine or Klieg Control or somthing i dont know
 * whatever is industry standard."* He delegated the choice, so `Console` is a
 * decision taken rather than a question returned — one line reverses it.
 *
 * `Console` is the industry term for exactly this surface (AWS, Google Cloud,
 * Twilio): an operator panel sitting behind a product. And the taglines went
 * because they were the third statement of one fact — the eyebrow already says
 * `ADMIN`, the tabs already say what is in it, and *"— everything"* said it a
 * third time. A tagline on a tool used daily is read once.
 *
 * ⚠ **THE REASON THAT IS NOT ABOUT TASTE, AND IT IS SHARPER THAN THE CARD'S.**
 * `Klieg Studio` is the WORKSPACE name (`brand.ts`), and that constant's own
 * docblock says what happens to it: when a workspace row exists, it becomes
 * that row's default and the Profile field edits it. **Staff sits ABOVE
 * workspaces** — an admin oversees every account, not one — so the day a
 * customer renames their workspace, an admin panel titled from it is a bug
 * that will be filed as a data leak.
 *
 * ⚠ **The card said this bar READ `WORKSPACE_NAME`. Read at the code, it did
 * not** — these were two hardcoded literals that merely SPELT the workspace
 * name, which is the same fault one layer over and a quieter one: a coupling
 * shows up in a rename, a hand-copied duplicate does not. Either way the
 * repair is the same and the title is composed from `BRAND_NAME`, never from a
 * literal, so the deferred rebrand moves it.
 */

/** ADMIN — one tab per live route, in the founder's §5 order. */
const ADMIN_TABS: { value: string; label: string }[] = [
  { value: "/admin/overview", label: "Overview" },
  { value: "/admin/change-requests", label: "Change requests" },
  /* Crew is spliced in here when visible — see `useCrewTabVisible` below. */
  { value: "/admin/users", label: "Users" },
  { value: "/admin/audit-logs", label: "Audit logs" },
  { value: "/admin/invite-codes", label: "Invite codes" },
  { value: "/admin/bug-reports", label: "Bug reports" },
];

/** Where Crew sits when it is there at all: third, after Change requests. */
const CREW_TAB_INDEX = 2;
const CREW_TAB = { value: "/admin/crew", label: "Crew" };

/**
 * ⚠ **`/admin/foundation` IS NOT HERE AND MUST NOT BE ADDED.** It is the
 * component specimen sheet — a house tool that happens to sit behind an admin
 * guard, not a staff surface. The founder ruled it in the brief itself: *"It
 * does not get a tab."*
 */

export type StaffRefreshControls = {
  /** The stamp. Absent = no stamp; nothing is invented. */
  lastRefresh?: Date;
  /** Both together or neither: a toggle needs a state and a setter. */
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  onRefresh?: () => void;
  isRefetching?: boolean;
};

/**
 * The admin bar. Its tabs are ROUTES — clicking Users navigates to
 * `/admin/users` — so deep links, bookmarks and the back button keep working,
 * and no page's data loading is restructured by this card.
 */
export function StaffBarAdmin({
  refreshControls,
  right,
}: {
  refreshControls?: StaffRefreshControls;
  right?: ReactNode;
}) {
  const [location] = useLocation();
  const crewVisible = useCrewTabVisible();

  /*
    Derived, never a second list (working law 4). The Crew entry is spliced
    into the one source above rather than kept as a parallel array — and it is
    the single legitimately-conditional tab: `crew.getState` answers NOT_FOUND
    outside `CREW_TAB_SCOPE`, so the query SUCCEEDING is the flag, and no flag
    value ever reaches the client.
  */
  const tabs = crewVisible
    ? [...ADMIN_TABS.slice(0, CREW_TAB_INDEX), CREW_TAB, ...ADMIN_TABS.slice(CREW_TAB_INDEX)]
    : ADMIN_TABS;
  const options: SurfaceBarSegment[] = tabs.map((tab) => ({ ...tab, href: tab.value }));

  return (
    <SurfaceBar
      eyebrow="ADMIN"
      title={`${BRAND_NAME} Console`}
      segments={{ value: location, options, label: "Section" }}
      right={<StaffBarRight refreshControls={refreshControls} extra={right} />}
    />
  );
}

/**
 * The moderation bar.
 *
 * ⚠ **Its tabs are local state, and that is deliberate.** `ModeratorDashboard`
 * is ONE route with five in-page tabs, each gating its own query with
 * `enabled: activeTab === …`. Turning them into routes would restructure that
 * page's data loading, which this brief puts out of scope. The brief's *"tabs
 * are routes, not local state"* is a rule against CONVERTING the admin
 * sections, which really are seven URLs — it is not an instruction to convert
 * one page's panes into five.
 */
export function StaffBarModeration({
  tabs,
  value,
  onChange,
  refreshControls,
  right,
}: {
  tabs: SurfaceBarSegment[];
  value: string;
  onChange: (value: string) => void;
  refreshControls?: StaffRefreshControls;
  right?: ReactNode;
}) {
  return (
    <SurfaceBar
      eyebrow="MODERATION"
      title={`${BRAND_NAME} Console`}
      segments={{ value, options: tabs, onChange, label: "Section" }}
      right={<StaffBarRight refreshControls={refreshControls} extra={right} />}
    />
  );
}

function StaffBarRight({
  refreshControls,
  extra,
}: {
  refreshControls?: StaffRefreshControls;
  extra?: ReactNode;
}) {
  const stamp = refreshControls?.lastRefresh;
  const hasToggle =
    refreshControls?.onToggleAutoRefresh !== undefined &&
    refreshControls?.autoRefresh !== undefined;
  const cluster = Boolean(stamp || hasToggle || refreshControls?.onRefresh);

  return (
    <>
      {cluster && (
        <span className="dp-staffbar__refresh">
          {stamp && <span className="dp-staffbar__stamp">{stamp.toLocaleTimeString()}</span>}
          {stamp && hasToggle && <span aria-hidden="true" className="dp-staffbar__rule" />}
          {hasToggle && (
            <button
              type="button"
              className="dp-staffbar__auto"
              onClick={refreshControls?.onToggleAutoRefresh}
              aria-pressed={refreshControls?.autoRefresh}
              /* The label says what it does; the switch says which way it is
                 set. A title repeating "AUTO 30s" would say neither. */
              title={
                refreshControls?.autoRefresh
                  ? "Refreshing every 30 seconds — click to stop"
                  : "Not refreshing on its own — click to refresh every 30 seconds"
              }
            >
              <span
                className={`dp-staffbar__track${
                  refreshControls?.autoRefresh ? " dp-staffbar__track--on" : ""
                }`}
              >
                <span className="dp-staffbar__knob" />
              </span>
              <span className="dp-staffbar__autolabel">AUTO 30s</span>
            </button>
          )}
          {refreshControls?.onRefresh && (
            <button
              type="button"
              className="dp-iconbtn"
              onClick={refreshControls.onRefresh}
              disabled={refreshControls.isRefetching}
              title="Refresh now"
              aria-label="Refresh now"
            >
              <RefreshCw
                className={refreshControls.isRefetching ? "dp-staffbar__spin" : undefined}
                width={13}
                height={13}
              />
            </button>
          )}
        </span>
      )}
      {extra}
    </>
  );
}
