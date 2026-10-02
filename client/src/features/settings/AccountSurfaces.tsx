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
  /*
    ⚠ **AND THE LOOKUP IS KEYED ON A TIER THE SERVER ACTUALLY STATED, NEVER ON
    A DEFAULT — #1741, and it is the line the whole defect hangs off.**

    It read `status?.planTier ?? "free"`. The two queries above ride ONE batched
    request (`httpBatchLink`, `main.tsx`) and are two INDEPENDENT entries in its
    reply, so one can fail while the other answers — and they are not equally
    likely to: `getPlans` is a constant fold over `SUBSCRIPTION_PRODUCTS`
    (`server/routes/billing.ts:95`) and `getStatus` reads the database. So the
    reachable state is `plans` defined beside an undefined `status`, and
    ⚠ **it is PERMANENT for the life of the surface rather than one beat** —
    nothing here retries or refuses. In it, `tier` was the FREE rung's row and
    every fallback below answered out of the wrong plan:
    `tier?.name` is **"Free"**, `tier?.monthlyCredits` is a real-looking
    allowance belonging to somebody else's plan, and `tier?.price` is 0 — which
    is **#1727's own repair walked around**, because that fix set this chain's
    FLOOR to `null` and left its SOURCE a guess.

    Keyed on `null` instead, the lookup does not happen until the server has
    named the tier — so there is nothing to walk around, and #391's mid-deploy
    fallback gets BETTER rather than weaker: it now resolves against the real
    `planTier` an older bundle did send, instead of against "free".
  */
  const planId = status?.planTier ?? null;
  const tier =
    planId === null
      ? undefined
      : plans?.tiers?.[planId as keyof NonNullable<typeof plans>["tiers"]];
  /*
    ⚠ **AN UNREAD STATUS IS NOT A FREE ACCOUNT — #1741, the NAME half of
    #1727, and three different facts were wearing one shape.**

    `getStatus` is gated on a surface being OPEN (the block above), so `status`
    is undefined for the first paint of **every single open** — not only on a
    slow network. A Pro subscriber opening Settings read
    **"Klieg Studio · Free plan"** in the header and **"Free"** as the title of
    their own plan card, then watched both become their real plan.

    So the three states are kept apart rather than collapsed into two:

    | state | what it means | what is rendered |
    |---|---|---|
    | `status === undefined` | nobody has asked yet | held — `null` travels |
    | answered, field present | today's server | the fact |
    | answered, field absent | an older bundle mid-deploy (#391) | the catalogue by the real tier, then "Free" |

    The third row is why the `??` chains stay BELOW the branch rather than
    being deleted as unreachable: the TYPE says `planName` is always sent, and
    that type is this bundle's reading of this server, not of the one answering.
    The second row is the one #1727 fixed for the price; this is the same
    sentence about the name, the plan id and the allowance, and `balance` took
    it in #1703.
  */
  const planName = status === undefined ? null : (status.planName ?? tier?.name ?? "Free");
  /*
    ⚠ **THE CREDIT-GRANT NOUN — AND #1727 LEFT IT ON A READING THE LINE ABOVE
    HAS NOW FALSIFIED.** Its comment said `allowance`'s zero "is read by
    `allowance > 0` and therefore quotes nothing", and that was true of a zero.
    The zero was only one of its two bad values: with the catalogue keyed on
    "free" it was the free rung's GRANT instead — a number well above zero, which
    sails straight through `allowance > 0` and had `spendWindowCopy` quote
    **"of 13,500 this billing period"** at a subscriber whose allowance is
    nothing like it. **A default that is never reached because something upstream
    hands down a confident wrong number is not a safe default; it is a default
    nobody could see.** Held as `null`, every claim that quotes it stands down
    together — the shape `balance` already has.
  */
  const allowance =
    status === undefined ? null : (status.planMonthlyCredits ?? tier?.monthlyCredits ?? 0);
  /*
    ⚠ **`null` UNTIL `getStatus` ANSWERS — #1727, and this one is certain
    rather than racy.** The query is gated on a surface being OPEN (the block
    above), so the modal mounts and paints with `status` undefined every single
    time. Under `?? 0` a Pro subscriber's own plan card read **"No charge"** for
    that beat and then became "$24.00/mo" — a confident claim that the thing
    they pay for is free.

    The catalogue fallback stays for the mid-deploy case #391 describes; what
    changed is only its floor. `balance` on the line below took the same repair
    in #1703. ⚠ **The floor was not enough on its own** — see #1741 above: a
    `tier` resolved off a DEFAULTED plan id handed this chain a 0 from the free
    rung before the floor was ever reached, so the pane could still read
    "No charge" at a subscriber. The two halves are one repair, and the
    `allowance` clause this sentence used to end on is answered there.
  */
  const planPriceInCents =
    status === undefined ? null : (status.planPriceInCents ?? tier?.price ?? null);
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
          balance={status?.balance ?? null}
          renewsAt={renewsAt}
        />
      ) : null}

      {state.changePlan ? (
        <ChangePlanModal onClose={state.closeChangePlan} onAddCredits={state.openAddCredits} />
      ) : null}

      {state.addCredits ? (
        <AddCreditsModal
          onClose={state.closeAddCredits}
          onChangePlan={state.openChangePlan}
        />
      ) : null}
    </>
  );
}
