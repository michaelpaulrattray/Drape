export { StaffBarAdmin, StaffBarModeration, type StaffRefreshControls } from "./StaffBar";
/* #413 — the refresh cluster as one thing, so a surface cannot ship one third
   of what he asked for. Its docblock carries the measurement. */
export { useStaffRefresh, STAFF_REFRESH_INTERVAL_MS } from "./useStaffRefresh";
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
