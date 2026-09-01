/**
 * Foundation entry (plan §D.1–D.13).
 *
 * Importing this module is what brings the foundation into a surface: the
 * self-hosted webfonts, the token scope, and the primitive stylesheet. Vite
 * fingerprints and serves the fonts from our own origin, so the app makes no
 * Google Fonts request and needs no CSP font-src change (plan §D.7).
 *
 * Weights 400 and 500 only. 600 exists in both webfonts and is never used — a
 * 600 heading next to a 500 heading reads as a mistake (README §2).
 */
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

// tokens.css is imported from client/src/index.css instead, so its position
// relative to the marketing stylesheet is explicit rather than dependent on
// which component happens to pull this barrel in first.
import "./foundation.css";
/* #262 — the promoted modal + menu block, lifted out of castingV2.css so a
   promoted component is styled wherever it is mounted, not only on casting. */
import "./modals.css";

export { AppShell } from "./AppShell";
export { BrandOrb } from "./BrandOrb";
/* Section 00b (brief 00b §3, §4) — inert topbar chrome. */
export { ProjectSwitcherStub, WhatsNewStub } from "./ChromeStubs";
/* Section 02 (brief 02 §1c) — the centred search, a span and never an input. */
export { SearchStub } from "./ChromeStubs";
export { BRAND_NAME, WORKSPACE_NAME, WORKSPACE_ROLE_LABEL } from "./brand";

/*
  #262 — THE FIVE PROMOTED FROM CASTING, on his ruling of 2026-08-30:
  "Five of the six move — modal shell, destructive confirm, overflow menu,
  rename dialog, delete-by-typing. Casting imports them back, no behaviour
  change."

  They are app concepts that happened to be built in casting first. Their
  behaviour is casting's, unchanged — casting's copies had customers in front
  of them and the foundation's did not, which is what settled every collision.
*/
export { CastingModal, firstNameOf } from "./CastingModal";
export { CardMenu } from "./CardMenu";
export type { CardMenuItem } from "./CardMenu";
export { ConfirmDialog } from "./ConfirmDialog";
export { DestructiveConfirm } from "./DestructiveConfirm";
export { RenameDialog } from "./RenameDialog";
/* #280 — the house icon set. A new glyph is ADDED TO `P`, never inlined at a call site. */
export { Icon, P } from "./icons";
export type { IconName } from "./icons";
export { RAIL_DESTINATIONS, Rail } from "./Rail";
export type { RailDestinationId, RailWorkspace } from "./Rail";
export { Topbar, TopbarDivider } from "./Topbar";
export type { TopbarAccount } from "./Topbar";
export {
  applyTheme,
  DEFAULT_THEME,
  isTheme,
  otherTheme,
  readStoredTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from "./theme";
export type { Theme } from "./theme";
export {
  Button,
  Card,
  Chip,
  CreditsChip,
  DataTable,
  DerivedChip,
  Dock,
  DropZone,
  EmptyState,
  ExpandableRow,
  Field,
  GradientTile,
  HoverActions,
  IconButton,
  Input,
  Instruction,
  LeaderRow,
  Marquee,
  MediaCard,
  MediaFrame,
  MiniList,
  Progress,
  RequiredMarker,
  ScopePill,
  SectionHead,
  Skeleton,
  StatusPill,
  SurfaceBar,
  /* Brief 06 — the staff table's head and its filter cluster. Eleven consumers
     on the day they land, which is what `PROMOTION-PASS.md` asks of a
     foundation addition: two real consumers in the codebase, or it waits. */
  TableFilter,
  TableHead,
  TableSearch,
  TableSort,
} from "./primitives";
export type {
  ButtonVariant,
  DataColumn,
  DataFact,
  DataRow,
  HoverActionItem,
  MediaCardState,
  MediaRatio,
  FilterOption,
  RowAction,
  SurfaceBarSegment,
} from "./primitives";

/* Section 00 (brief 00 §4, §5) — the severity look and popover discipline. */
export { showsMenuCount } from "./menuCount";
export { severityLook } from "./severity";
export type { Severity } from "./severity";
/*
  THE ONE OWNER of how a panel opens, closes and lands (#304, his "Option one").
  `usePopover` was the third of three implementations and is gone; `CardMenu`
  and `Popover` are shapes on this hook rather than rivals to it.
*/
export { POPOVER_MARKER, useAnchoredPanel } from "./useAnchoredPanel";
export type { AnchoredPanel, PanelAlign } from "./useAnchoredPanel";
