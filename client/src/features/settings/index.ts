/**
 * Section 03's barrel — the ONE settings surface and the state it takes.
 *
 * `useAccountSurfaces` is exported beside the modal on purpose: §2's *"one
 * state pair for Settings — `open` and `section`"* is the thing that makes the
 * consolidation real, and leaving each mount site to invent its own booleans is
 * how five modals became five booleans in the first place.
 */
export { SettingsModal, SETTINGS_SECTIONS } from "./SettingsModal";
export type { SettingsSection } from "./SettingsModal";
export { useAccountSurfaces, AccountSurfaces } from "./AccountSurfaces";
