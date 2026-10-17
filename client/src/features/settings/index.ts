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
export { AccountSurfaces } from "./AccountSurfaces";
/*
 * ⚠ THE HOOK IS RE-EXPORTED HERE AND MUST NOT BE IMPORTED HERE (#2608).
 *
 * This barrel also exports `AccountSurfaces` and `SettingsModal`, so anything
 * reaching the hook THROUGH it downloads the whole cluster and
 * `features/billing` with it — which is exactly the entry-chunk weight that
 * card removed. The line stays for callers already inside a lazy chunk;
 * `AppChrome`, which renders on every signed-in page, imports
 * `./useAccountSurfaces` directly, and `client/src/accountSurfacesLazy.test.ts`
 * holds it to that.
 */
export { useAccountSurfaces } from "./useAccountSurfaces";
export type { AccountSurfacesState } from "./useAccountSurfaces";
