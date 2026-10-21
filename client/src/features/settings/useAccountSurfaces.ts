/**
 * THE STATE THAT OPENS THE THREE ACCOUNT SURFACES — in its own module, so that
 * holding it does not download them (#2608).
 *
 * Section 03 §2 put this hook beside the modal on purpose: *"One state pair for
 * Settings — `open` and `section`. Not six booleans, not one flag per retired
 * modal."* That reasoning is unchanged and the pair still lives next to its
 * mount; what moved is only WHICH FILE it is declared in, and the reason is the
 * first download.
 *
 * ⚠ **`AppChrome` renders on every signed-in page and needs the STATE on every
 * one of them; it needs the SURFACES only when somebody opens one.** While the
 * two lived in one module, importing the hook pulled the whole cluster — the
 * settings modal, Change plan, Add credits and `features/billing` with them —
 * into the entry chunk, so a visitor who arrived at the sign-in page
 * downloaded the billing modals before a pixel rendered. Measured on #2608's
 * branch, first-paint JS: **285.9 kB → 268.3 kB**.
 *
 * This is the shape the same file already uses one import down for
 * `useAccountMenuCounts` (#1042), and for the same reason: *"importing the
 * barrel here closed a ring between the entry chunk and every lazy staff
 * chunk"*. **So this module imports nothing but React and a type.** A value
 * import of `SettingsModal`, `ChangePlanModal` or anything under
 * `features/billing` from here would put the cluster straight back in the
 * entry chunk with nothing going red —
 * `client/src/accountSurfacesLazy.test.ts` is what makes that loud.
 */
import { useCallback, useMemo, useState } from "react";

import type { SettingsSection } from "./SettingsModal";

export type AccountSurfacesState = {
  settings: SettingsSection | null;
  changePlan: boolean;
  addCredits: boolean;
  /**
   * Whether ANY of the three is open — derived here, read everywhere.
   *
   * Two places need this answer and they are in different chunks now: the
   * mount decides whether to fetch the cluster at all, and the cluster itself
   * gates its queries on it (a closed modal's hooks must not run — the
   * measurement is in `AccountSurfaces`). Two derivations of one fact is
   * working law 4, and the failure it would produce here is the quiet kind: a
   * mount that disagrees with the component about being open renders nothing
   * and fetches a chunk for it.
   */
  anyOpen: boolean;
  openSettings: (section?: SettingsSection) => void;
  openChangePlan: () => void;
  openAddCredits: () => void;
  /**
   * Close ONE layer, not the stack.
   *
   * Change plan and Add credits open ON TOP of Settings (§2: Settings → Billing
   * leads to both), so dismissing them must leave Settings where it was.
   * Dismissing everything is `closeAll`, which is what the Settings scrim and
   * its Done button do.
   */
  closeChangePlan: () => void;
  closeAddCredits: () => void;
  closeAll: () => void;
  setSection: (section: SettingsSection) => void;
};

export function useAccountSurfaces(): AccountSurfacesState {
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [changePlan, setChangePlan] = useState(false);
  const [addCredits, setAddCredits] = useState(false);

  const openSettings = useCallback((section: SettingsSection = "profile") => {
    setSettings(section);
  }, []);
  const openChangePlan = useCallback(() => setChangePlan(true), []);
  const openAddCredits = useCallback(() => setAddCredits(true), []);
  const closeChangePlan = useCallback(() => setChangePlan(false), []);
  const closeAddCredits = useCallback(() => setAddCredits(false), []);
  const closeAll = useCallback(() => {
    setSettings(null);
    setChangePlan(false);
    setAddCredits(false);
  }, []);
  const setSection = useCallback((section: SettingsSection) => setSettings(section), []);

  return useMemo(
    () => ({
      settings,
      changePlan,
      addCredits,
      anyOpen: settings !== null || changePlan || addCredits,
      openSettings,
      openChangePlan,
      openAddCredits,
      closeChangePlan,
      closeAddCredits,
      closeAll,
      setSection,
    }),
    [
      settings,
      changePlan,
      addCredits,
      openSettings,
      openChangePlan,
      openAddCredits,
      closeChangePlan,
      closeAddCredits,
      closeAll,
      setSection,
    ],
  );
}
