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

export { AppShell } from "./AppShell";
export { BrandOrb } from "./BrandOrb";
export { BRAND_NAME } from "./brand";
export { RAIL_DESTINATIONS, Rail } from "./Rail";
export type { RailAccount, RailDestinationId } from "./Rail";
export { Topbar } from "./Topbar";
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
  DerivedChip,
  Dock,
  DropZone,
  EmptyState,
  Field,
  GradientTile,
  IconButton,
  Input,
  Instruction,
  MediaFrame,
  Progress,
  RequiredMarker,
  ScopePill,
  SectionHead,
  Skeleton,
  StatusPill,
} from "./primitives";
export type { ButtonVariant } from "./primitives";
