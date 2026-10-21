/**
 * AppChrome — the app's chrome, in ONE place, for every page inside the app.
 *
 * Founder, 2026-08-30 (#278), reporting it as his own confusion rather than as
 * our defect: *"it should appear on every page the rails and top bar are the
 * lobby the content within the pages is what changes thats why im confused why
 * when im on the casting ppage i cannot access anything in th etopbar or
 * rails?"* — and asked which of the cluster belongs on a working page, he
 * answered *"all of them same as lobby"*.
 *
 * Until this component existed, only `AppLobby` handed `AppShell` its chrome.
 * Every casting mount passed none of it, so on the four surfaces where a
 * customer spends credits there was no account menu, no credits chip, no
 * project switcher, no Report a bug, no help menu, no What's new and no
 * settings gear.
 *
 * ## Why the composition is here and not in `AppShell`
 *
 * The obvious home is the shell itself — *"a new page is correct by
 * construction rather than by remembering"*. It cannot be: `foundation/` is
 * forbidden from importing `features/` and that ban is guarded
 * (`foundation/promotion-guard.test.ts`), because a shared kit that reaches
 * back into a feature is a feature subfolder with a different address. This
 * cluster is made of `features/lobby`, `features/billing`, `features/referral`
 * and tRPC — app concerns, not foundation ones.
 *
 * So the shell stays a pure layout primitive and **this is the app-level shell
 * every page mounts.** The "by construction" half is bought back by a guard:
 * `appChrome.test.ts` fails if any page mounts `AppShell` directly, so a new
 * page cannot quietly ship without chrome the way the casting pages did.
 *
 * ## One owner, not five copies
 *
 * The alternative was passing the same four props at seven mount sites. That is
 * working law 4 — a second list shadowing a source of truth always drifts from
 * it — and this month's own example is the three popover implementations
 * (#304). A grep for `CreditsChip` or `LobbyUtilityMenu` finds one composition
 * site, and it is this file.
 */
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AppShell,
  CreditsChip,
  ProjectSwitcherStub,
  TopbarDivider,
  WhatsNewStub,
  type RailDestinationId,
} from "@/foundation";
import { UserCard } from "@/components/UserCard";
import { HelpInAccountMenu, LobbyUtilityMenu } from "@/features/lobby/LobbyUtilityMenu";
import { ReportBugButton } from "@/features/lobby/ReportBugButton";
/* #2608 — THE HOOK'S OWN MODULE, NEVER THE BARREL, AND NEVER THE COMPONENT'S
   FILE. This is the same shape as `useAccountMenuCounts` one import down and
   for the same reason: the barrel also exports `AccountSurfaces`, whose own
   imports are the settings cluster and `features/billing`, so reaching the
   state through either of them puts all of it in the entry chunk. The surfaces
   themselves are lazy below. */
import { useAccountSurfaces } from "@/features/settings/useAccountSurfaces";
/* #1042 — the hook's own module, not the `@/features/staff` barrel. The barrel
   re-exports `StaffSurface`, which imports this file, so importing the barrel
   here closed a ring between the entry chunk and every lazy staff chunk that
   Rollup warned about eight times per build. */
import { useAccountMenuCounts } from "@/features/staff/useAccountMenuCounts";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";

/**
 * The React key for the one member the stack can honestly draw: the signed-in
 * user (#281). It is a SLOT name, not an identity — `auth.me` returns no `id`
 * by design (invariant 8) and a list key is not a reason to widen it.
 */
const SELF_MEMBER_ID = "self";

/**
 * THE ACCOUNT SURFACES ARE LAZY, AND THE STATE THAT OPENS THEM IS NOT (#2608).
 *
 * The cluster — Settings, Change plan, Add credits, and `features/billing`
 * behind them — is reachable from every signed-in page and OPENED on almost
 * none of them. It rendered `null` until somebody opened one, and the bytes
 * were in the first download anyway. Measured on #2608's branch:
 *
 *   first-paint JS    285.9 kB -> 268.3 kB   (-17.6 kB; headroom 4.1 -> 21.7)
 *   after first paint 174.5 kB -> 194.0 kB   (+19.5 kB against 280.0)
 *
 * So the bytes MOVED rather than vanished, which is the honest shape of every
 * split and is why both numbers are here. The budget pair exists to say that
 * before-paint bytes are the expensive ones (#1035/#1265).
 *
 * ⚠ **AND THE CHUNK IS WARMED ON IDLE, so no customer waits for it** — see
 * {@link useWarmAccountSurfaces}. Without that, a click on Settings would show
 * nothing until a ~19 kB fetch landed, which on a slow connection is most of a
 * second of a button that looks broken. A split that trades first paint for a
 * dead-looking control has moved the cost onto the person, which is the
 * disappearing-technology law's own line.
 */
const AccountSurfaces = lazy(() =>
  import("@/features/settings/AccountSurfaces").then((m) => ({ default: m.AccountSurfaces })),
);

/**
 * Fetch the account cluster once the page has stopped being busy.
 *
 * `requestIdleCallback` where it exists and a short timer where it does not
 * (Safari, as of writing). Either way it is one import after first paint, its
 * result is cached by the module registry, and a failure is nothing: the
 * `Suspense` boundary below would fetch it again on the click.
 */
function useWarmAccountSurfaces(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const warm = () => { void import("@/features/settings/AccountSurfaces"); };
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (typeof idle === "function") {
      idle(warm);
      return;
    }
    const timer = setTimeout(warm, 2_000);
    return () => clearTimeout(timer);
  }, [enabled]);
}

export function AppChrome({
  breadcrumb,
  current,
  width = "browse",
  gutter = "default",
  children,
}: {
  breadcrumb?: string;
  current?: RailDestinationId;
  width?: "browse" | "working" | "bare";
  gutter?: "default" | "tight";
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  /*
    SECTION 03 — one state pair for the whole account cluster, not four
    booleans. `useAccountSurfaces` owns `open` + `section`, and every entry
    point below is a call into it (brief §2).
  */
  const account = useAccountSurfaces();
  /* Only for somebody who can open them: a signed-out visitor on this chrome
     has no account menu, so warming the cluster for them would be the first
     download moved rather than removed. */
  useWarmAccountSurfaces(Boolean(user));
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: profileData } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });

  /*
    #416 — THE TWO NUMBERS THE MENU HAS ALWAYS BEEN ABLE TO DRAW AND NEVER HAD.

    `UserCard` declared `adminCount` and `moderationCount`, rendered a pill for
    each and omitted at zero — and this call site, its ONE call site, passed
    neither. They arrived `undefined`, the pills omitted, and the badges never
    once showed a number. It shipped looking finished.

    The counts are composed in a hook rather than fetched here on purpose: this
    component calls `trpc.` for credits and profile, and `counts415-guard`
    derives from the tree that exactly one module both names the pending count
    and calls tRPC. Reading it here would have moved a guard arm to admit a new
    consumer, which is how a derived guard turns back into a list.
  */
  const { adminCount, moderationCount } = useAccountMenuCounts();
  useEffect(() => {
    if (profileData?.avatarUrl) setProfileImage(profileData.avatarUrl);
    /*
      ⚠ THE BANNER IS GONE FROM THIS COMPONENT AND FROM THE PRODUCT'S UI, and
      it is declared rather than quiet. `profile.uploadBanner` still exists on
      the server and `profileData.bannerUrl` is still returned; what has been
      removed is the only control that SET one — in the settings modal section
      03 replaces. It was safe to remove because a grep across `client/src`
      finds no surface that ever DISPLAYED a banner: it was an upload with no
      consumer. The brief's Profile section is avatar, display name, email and
      workspace name, and adding a fifth row for a picture nobody can see is
      not something it asks for. Restoring it is one row.
    */
  }, [profileData?.avatarUrl]);

  const avatarUrl = profileImage ?? user?.avatarUrl ?? null;

  return (
    <AppShell
      breadcrumb={breadcrumb}
      current={current}
      width={width}
      gutter={gutter}
      /* 00b §4: the switcher names a place. Projects do not exist, so it is
         inert — and "All projects" is true today rather than a placeholder,
         which is what keeps the stub honest. No projectId reaches any query. */
      topbarLeft={<ProjectSwitcherStub />}
      /* 02 §1d, left to right: queue pill -> credits -> divider -> bug -> help
         -> what's new, then the shell's own theme toggle and the account chip.

         THE QUEUE PILL IS NOT BUILT HERE and the space is left empty on
         purpose. It needs a real jobs feed, and `3 running · 40s` over nothing
         is a lie about what the studio is doing — his own words on the 00b
         frames: *"A number in a screenshot that no server produces is a lie
         that survives into the build."*

         REPORT A BUG IS ITS OWN ICON now rather than a row two clicks inside
         the help menu (02 §1d). */
      topbarRight={
        <>
          {/* §2: the credits chip opens ADD CREDITS, not Change plan —
              somebody clicking their balance has a credits question. */}
          <CreditsChip balance={creditsData?.balance} onClick={account.openAddCredits} />
          <TopbarDivider />
          <ReportBugButton />
          <LobbyUtilityMenu />
          <WhatsNewStub />
        </>
      }
      /* 02 §2c: the rail's foot is the workspace — the member stack, Invite,
         and the gear, which opens the same settings modal this component owns.
         The gear is a real control on every page precisely because the modal
         travels with it; drawing it without one would be the dead control
         D-180 forbids.

         ⚠ **THE STACK DRAWS ONE FACE AND IT IS HIS OWN** (#281, his ruling
         2026-08-30, verbatim and entire): *"Show your own face beside the +,
         but keep it stubbed out until membership exists."*

         There is still no membership anywhere — no table in `drizzle/schema.ts`,
         no endpoint in `server/routers.ts`, no surface — so this list can only
         ever hold rows a server really produced. `user` is one: it is the same
         `useAuth` row the account chip renders two inches away, through the
         SAME `ProfileAvatar`, so the face in the rail and the face in the
         topbar are the same person by construction rather than by coincidence.

         ⚠ **`members` STAYS DERIVED, NEVER LITERAL.** The moment a name or an
         id is written here rather than read off a row, this is the invented
         data his own instinct warned about — *"a stack of one person is not a
         member stack"* — and the guard in `section02-guard.test.ts` fails on
         exactly that shape.

         ⚠ **AND NOTHING HERE MAKES IT LIVE.** `aria-disabled`, `cursor:
         default`, the *"not built yet"* title and the missing `+` hover are
         all still in place, because the second half of his sentence is an
         instruction and not a caveat.

         ⚠ **`auth.me` RETURNS NO `id`, AND THAT IS NOT A GAP TO FILL.** Its
         projection is `name · email · avatarUrl · authProvider · role ·
         approved · canvasIntroSeen` — enforcement invariant 8, an explicit
         projection rather than a spread row. A React `key` is not a reason to
         widen an auth surface, so the key below is a CONSTANT: there is
         exactly one entry, it never reorders, and `SELF_MEMBER_ID` is a slot
         name rather than a claim about who anyone is. */
      workspace={{
        members: user
          ? [
              {
                id: SELF_MEMBER_ID,
                label: user.name ?? "You",
                avatar: (
                  <ProfileAvatar src={avatarUrl} identity={user} alt={user.name ?? "You"} />
                ),
              },
            ]
          : [],
        onOpenSettings: () => account.openSettings("profile"),
        /* #372 — the Invite block's door. `openSettings(section)` is the same
           call the account menu's three rows already make; the rail needed a
           destination, not a mechanism. */
        onOpenMembers: () => account.openSettings("members"),
      }}
      account={
        user
          ? {
              label: user.name ?? "Account",
              avatar: (
                <ProfileAvatar
                  src={avatarUrl}
                  identity={user}
                  alt={user.name ?? "User"}
                  className="w-full h-full rounded-full object-cover"
                />
              ),
              /* Section 04 (#374) — `UserCard` is THE account menu, and this is
                 its one live consumer. The avatar above is the chip you click;
                 the menu no longer repeats it, so no image props come down
                 here any more. */
              /* #2263 — below 768px the bug icon and the help menu leave the
                 topbar, so the account menu carries them instead; above it
                 the wrapper adds nothing. */
              menu: (
                <HelpInAccountMenu>
                  <UserCard
                    userName={user.name ?? "Account"}
                    creditsBalance={creditsData?.balance ?? null}
                    role={user.role}
                    adminCount={adminCount}
                    moderationCount={moderationCount}
                    onOpenSettings={() => account.openSettings("profile")}
                    onOpenMembers={() => account.openSettings("members")}
                    onOpenBilling={() => account.openSettings("billing")}
                    onLogout={logout}
                  />
                </HelpInAccountMenu>
              ),
            }
          : undefined
      }
    >
      {children}

      {/*
        THE THREE SURFACES, MOUNTED ONCE (section 03) — AND ONLY WHILE ONE IS
        OPEN, since #2608.

        The five modals that used to sit here are gone; `AccountSurfaces` owns
        the mount AND the queries behind it. The one behaviour worth carrying
        forward from #278 is preserved inside it and its reason is quoted there:
        a closed modal's HOOKS must not run, because `previewPlanChange` is a
        Stripe proration read that was gated only on `!isFreeUser`, so mounting
        the cluster unconditionally cost a paying customer one on every page
        view of the four casting surfaces.

        ⚠ The condition is `account.anyOpen` — the HOOK's own derivation, which
        the component reads too, never a second one computed here. Two answers
        to "is anything open" would fail in the quiet direction: a mount that
        disagrees fetches a chunk to render nothing, or renders a surface the
        state thinks is shut.

        ⚠ `fallback={null}` is correct here and is not a shrug: the chunk is
        warmed on idle above, so by the time anybody opens a surface it is
        already in the registry and this boundary never suspends in practice.
        On the cold path it is one beat before a modal appears, which is the
        same nothing the button showed before it was pressed.
      */}
      {account.anyOpen ? (
        <Suspense fallback={null}>
          <AccountSurfaces
            state={account}
            avatarUrl={avatarUrl}
            onAvatarChange={setProfileImage}
          />
        </Suspense>
      ) : null}
    </AppShell>
  );
}
