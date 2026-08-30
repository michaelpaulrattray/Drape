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
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import { LobbyUtilityMenu } from "@/features/lobby/LobbyUtilityMenu";
import { ReportBugButton } from "@/features/lobby/ReportBugButton";
import { BillingModal } from "@/features/billing";
import { CreditTopupModal } from "@/features/billing/CreditTopupModal";
import { ReferralModal } from "@/features/referral/ReferralModal";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";

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

  const [showSettings, setShowSettings] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: profileData, refetch: refetchProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });
  useEffect(() => {
    if (profileData?.avatarUrl) setProfileImage(profileData.avatarUrl);
    if (profileData?.bannerUrl) setBannerImage(profileData.bannerUrl);
  }, [profileData?.avatarUrl, profileData?.bannerUrl]);

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
          <CreditsChip balance={creditsData?.balance} onClick={() => setIsBillingOpen(true)} />
          <TopbarDivider />
          <ReportBugButton />
          <LobbyUtilityMenu />
          <WhatsNewStub />
        </>
      }
      /* 02 §2c: the rail's foot is the workspace. The member stack has no
         members to draw — there is no members API — so what ships is the
         Invite affordance, inert (#281), and the gear, which opens the same
         settings modal this component owns. The gear is a real control on
         every page precisely because the modal travels with it; drawing it
         without one would be the dead control D-180 forbids. */
      workspace={{ onOpenSettings: () => setShowSettings(true) }}
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
                  onOpenSettings={() => setShowSettings(true)}
                  onOpenBilling={() => setIsBillingOpen(true)}
                  onOpenReferral={() => setIsReferralOpen(true)}
                  onLogout={logout}
                />
              ),
            }
          : undefined
      }
    >
      {children}

      {/*
        THE MODALS MOUNT ONLY WHILE OPEN, and that is the one deliberate
        behaviour change in #278. Each of these already renders `null` when
        closed, so the output is identical either way — what differs is that a
        closed modal's HOOKS no longer run.

        Measured before deciding: `BillingModal` fires `billing.getPlans` and
        `billing.getStatus` on mount, and `CreditTopupModal` adds
        `getSubscriptionDetails` and `previewPlanChange` — the last of which is
        a Stripe proration read, gated only on `!isFreeUser`, never on
        `isOpen`. The query client is `new QueryClient()` with stock defaults
        (staleTime 0), so those refire on every mount. Keeping them mounted
        unconditionally would have made this fix cost a paying customer a
        Stripe proration preview on EVERY casting page view — four surfaces
        that previously fired none.

        The cost of the change is one round trip on the first open of a modal
        instead of a prewarmed one. The ungated queries inside the modals are
        the actual defect and are carded separately; this component declines to
        widen them rather than pretending they are not there.
      */}
      {showSettings ? (
        <ProfileSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={() => refetchProfile()}
          user={user}
          profileImage={profileImage}
          bannerImage={bannerImage}
          onProfileImageChange={setProfileImage}
          onBannerImageChange={setBannerImage}
          creditsBalance={creditsData?.balance || 0}
          planTier={creditsData?.planTier || "free"}
          onOpenBilling={() => {
            setShowSettings(false);
            setIsBillingOpen(true);
          }}
          onOpenTopup={() => {
            setShowSettings(false);
            setIsTopupOpen(true);
          }}
        />
      ) : null}
      {isBillingOpen ? (
        <BillingModal
          isOpen={isBillingOpen}
          onClose={() => setIsBillingOpen(false)}
          onOpenTopup={() => {
            setIsBillingOpen(false);
            setIsTopupOpen(true);
          }}
        />
      ) : null}
      {isTopupOpen ? (
        <CreditTopupModal
          isOpen={isTopupOpen}
          onClose={() => setIsTopupOpen(false)}
          currentBalance={creditsData?.balance || 0}
        />
      ) : null}
      {isReferralOpen ? (
        <ReferralModal open={isReferralOpen} onClose={() => setIsReferralOpen(false)} />
      ) : null}
    </AppShell>
  );
}
