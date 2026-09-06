/**
 * THE THREE SURFACES AND THE STATE THAT OPENS THEM, IN ONE PLACE.
 *
 * Section 03 §2: *"One state pair for Settings — `open` and `section`. Not six
 * booleans, not one flag per retired modal. That is what makes the
 * consolidation real rather than four modals in a trench coat."*
 *
 * ⚠ **AND FOUR FILES USED TO MOUNT THOSE MODALS, NOT ONE** — `AppChrome`, the
 * legacy `DrapeStudio`, `BoardPage` and `CastingTakeover`, each with its own
 * booleans and its own wiring between them. That is working law 4: a second
 * list shadowing a source of truth always drifts from it, and this one already
 * had — the out-of-credits mounts open the top-up with no way to reach Change
 * plan from it, which is the cross-link §6f exists to provide. So the state
 * pair lives HERE, with the mount, and a surface takes both together.
 *
 * ## What a caller gets
 *
 *   const account = useAccountSurfaces();
 *   …
 *   <button onClick={() => account.openSettings("billing")}>Billing</button>
 *   <AccountSurfaces {...account} />
 *
 * `openSettings(section)` is every §2 entry point: the account menu's three
 * rows, the rail's gear, and the two Settings rows that lead onward.
 * `openAddCredits()` is the credits chip and every out-of-credits path.
 */
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ChangePlanModal } from "@/features/billing/ChangePlanModal";
import { AddCreditsModal } from "@/features/billing/AddCreditsModal";

import { SettingsModal, type SettingsSection } from "./SettingsModal";

export type AccountSurfacesState = {
  settings: SettingsSection | null;
  changePlan: boolean;
  addCredits: boolean;
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

export function AccountSurfaces({
  state,
  avatarUrl,
  onAvatarChange,
}: {
  state: AccountSurfacesState;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
}) {
  const { user, logout } = useAuth();

  /*
    ⚠ THE QUERIES ARE GATED ON A SURFACE BEING OPEN, and that is deliberate
    rather than tidy. `AppChrome`'s own docblock records the measurement: these
    modals fire `getPlans`, `getStatus` and — on the top-up path — a Stripe
    proration read, and the query client's `staleTime` is 0, so mounting them
    unconditionally would cost a paying customer a proration preview on every
    page view. Gating the whole block on "is anything open" keeps that fix.
  */
  const anyOpen = state.settings !== null || state.changePlan || state.addCredits;
  const { data: status } = trpc.billing.getStatus.useQuery(undefined, { enabled: anyOpen });
  const { data: plans } = trpc.billing.getPlans.useQuery(undefined, { enabled: anyOpen });

  if (!anyOpen) return null;

  /*
    #391 — THE OWN PLAN'S FACTS COME FROM `getStatus`, NOT FROM THE CATALOGUE.
    `getPlans` serves only the OFFERED ladder now (the hidden rung's price is
    deliberately unpublished), so an account on the hidden rung cannot find
    itself in `plans.tiers` — deriving the caption there is how a hand-sold
    Ultimate account gets captioned "Free" (PR #583 finding 1). The catalogue
    lookup stays only as the fallback for an older server bundle mid-deploy.
  */
  const planId = status?.planTier ?? "free";
  const tier = plans?.tiers?.[planId as keyof NonNullable<typeof plans>["tiers"]];
  const planName = status?.planName ?? tier?.name ?? "Free";
  const allowance = status?.planMonthlyCredits ?? tier?.monthlyCredits ?? 0;
  const planPriceInCents = status?.planPriceInCents ?? tier?.price ?? 0;
  const renewsAt = status?.currentPeriodEnd ? new Date(status.currentPeriodEnd) : null;

  return (
    <>
      {state.settings !== null ? (
        <SettingsModal
          section={state.settings}
          onSection={state.setSection}
          onClose={state.closeAll}
          onSignOut={logout}
          onChangePlan={state.openChangePlan}
          onAddCredits={state.openAddCredits}
          user={user ?? null}
          avatarUrl={avatarUrl}
          onAvatarChange={onAvatarChange}
          planName={planName}
          planPriceInCents={planPriceInCents}
          allowance={allowance}
          balance={status?.balance ?? 0}
          periodStart={status?.currentPeriodStart ? new Date(status.currentPeriodStart) : null}
          renewsAt={renewsAt}
        />
      ) : null}

      {state.changePlan ? (
        <ChangePlanModal onClose={state.closeChangePlan} onAddCredits={state.openAddCredits} />
      ) : null}

      {state.addCredits ? <AddCreditsModal onClose={state.closeAddCredits} /> : null}
    </>
  );
}
