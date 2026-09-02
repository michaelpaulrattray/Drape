export { StaffBarAdmin, StaffBarModeration, type StaffRefreshControls } from "./StaffBar";
/* #413 — the refresh cluster as one thing, so a surface cannot ship one third
   of what he asked for. Its docblock carries the measurement. */
export { useStaffRefresh, STAFF_REFRESH_INTERVAL_MS } from "./useStaffRefresh";
/* #415 — the ONE reader behind the bar's count pill, the Overview card and
   (next, #416) the account menu's badge. Its docblock carries why it reads
   `admin.getOverview` rather than counting anything itself. */
export { useStaffCounts } from "./useStaffCounts";
/* #453 — ONE switch for the whole panel, on his reply #104. Seven surfaces held
   seven `useState`s, so the toggle died on every navigation. Its docblock
   carries why the moderator page only looked like it worked. */
export {
  useStaffAutoRefresh,
  useStaffAutoRefreshStore,
} from "./stores/useStaffAutoRefreshStore";
export { StaffSurface } from "./StaffSurface";
export { StaffLoading } from "./StaffLoading";
/* Brief 06 — the staff table's shared vocabulary. Not a second table: the
   colour rule, the id and name-stack cells, and the range sentence. */
export {
  pageRange,
  RawPayload,
  RolePill,
  RowId,
  RowStack,
  StatePill,
  SUSPEND_CONSEQUENCE,
} from "./staffTable";
