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
import { useEffect, useState, type ReactNode } from "react";

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
import { LobbyUtilityMenu } from "@/features/lobby/LobbyUtilityMenu";
import { ReportBugButton } from "@/features/lobby/ReportBugButton";
import { AccountSurfaces, useAccountSurfaces } from "@/features/settings";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";

/**
 * The React key for the one member the stack can honestly draw: the signed-in
 * user (#281). It is a SLOT name, not an identity — `auth.me` returns no `id`
 * by design (invariant 8) and a list key is not a reason to widen it.
 */
const SELF_MEMBER_ID = "self";

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
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: profileData } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });
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
              // Same card the old rail's user row opened — parity, not a redesign.
              menu: (
                <UserCard
                  userInitial={(user.name ?? "?").charAt(0).toUpperCase()}
                  userName={user.name ?? "Account"}
                  profileImage={avatarUrl}
                  profileIdentity={user}
                  creditsBalance={creditsData?.balance ?? 0}
                  role={user.role}
                  onOpenSettings={() => account.openSettings("profile")}
                  onOpenMembers={() => account.openSettings("members")}
                  onOpenBilling={() => account.openSettings("billing")}
                  onLogout={logout}
                />
              ),
            }
          : undefined
      }
    >
      {children}

      {/*
        THE THREE SURFACES, MOUNTED ONCE (section 03).

        The five modals that used to sit here are gone; `AccountSurfaces` owns
        the mount AND the queries behind it. The one behaviour worth carrying
        forward from #278 is preserved inside it and its reason is quoted there:
        a closed modal's HOOKS must not run, because `previewPlanChange` is a
        Stripe proration read that was gated only on `!isFreeUser`, so mounting
        the cluster unconditionally cost a paying customer one on every page
        view of the four casting surfaces.
      */}
      <AccountSurfaces
        state={account}
        avatarUrl={avatarUrl}
        onAvatarChange={setProfileImage}
      />
    </AppShell>
  );
}
