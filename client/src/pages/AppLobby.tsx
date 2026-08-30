/**
 * AppLobby — the /app lobby: auth guard, routed view, account modals.
 *
 * M2 moved the chrome to the shared foundation shell (plan §D.4, §D.14): the
 * 76px rail and 56px topbar replace the old 216px text rail and the mobile
 * header, so the lobby and Casting V2 now navigate identically and both
 * follow the theme. All five lobby URLs render this same component, so the
 * shell never remounts between them.
 *
 * What did NOT change here is the information architecture — the views, the
 * account card's contents and the five modals are as they were. The lobby
 * redesign proper (tool tabs, "On the wire", unified sheet) waits for Casting
 * V2 to settle its vocabulary, per §D.14.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { AppShell, CreditsChip, ProjectSwitcherStub, WhatsNewStub } from '@/foundation';
import type { RailDestinationId } from '@/foundation';
import { UserCard } from '@/components/UserCard';
import { LobbyUtilityMenu } from '@/features/lobby/LobbyUtilityMenu';
import { HomeView } from '@/features/lobby/HomeView';
import { BoardsView } from '@/features/lobby/BoardsView';
import { LibraryView } from '@/features/lobby/LibraryView';
import { BillingModal } from '@/features/billing';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { ReferralModal } from '@/features/referral/ReferralModal';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { ProfileAvatar } from '@/features/profile/ProfileVisual';

/*
  MobileHeader retired at M2. Below 720px the foundation rail collapses to
  icons but keeps every destination and the account chip, so the slim header
  (logo + log out) no longer covered anything the rail does not.
*/

export default function AppLobby() {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  // Account modals — same set the studio sidebar offers
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

  // Redirect to login if not authenticated
  if (!loading && !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Show nothing while checking auth
  if (loading) {
    return <div style={{ height: '100vh', background: 'var(--surface)' }} />;
  }

  const LOBBY_VIEWS: Record<
    string,
    { view: ReactElement; crumb: string; rail: RailDestinationId }
  > = {
    '/app/boards': { view: <BoardsView />, crumb: 'Canvas', rail: 'canvas' },
    '/app/models': { view: <LibraryView kind="models" />, crumb: 'Library / Models', rail: 'library' },
    '/app/garments': {
      view: <LibraryView kind="garments" />,
      crumb: 'Library / Garments',
      rail: 'library',
    },
    '/app/looks': { view: <LibraryView kind="looks" />, crumb: 'Library / Looks', rail: 'library' },
  };
  const current = LOBBY_VIEWS[location] ?? {
    view: <HomeView />,
    crumb: 'Home',
    rail: 'home' as RailDestinationId,
  };

  const avatarUrl = profileImage ?? user?.avatarUrl ?? null;

  return (
    <AppShell
      breadcrumb={current.crumb}
      current={current.rail}
      width="bare"
      /* 00b §4: the switcher names a place. Projects do not exist, so it is
         inert — and "All projects" is true today rather than a placeholder,
         which is what keeps the stub honest. No projectId reaches any query. */
      topbarLeft={<ProjectSwitcherStub />}
      /* 00b §5, left to right: queue pill -> credits -> utility -> what's new,
         then the shell's own theme toggle. The queue pill is NOT built here —
         it needs a real jobs feed (section 04) and a fake one would be a lie
         about what is running. The slot is simply left for it. */
      topbarRight={
        <>
          <CreditsChip balance={creditsData?.balance} onClick={() => setIsBillingOpen(true)} />
          <LobbyUtilityMenu />
          <WhatsNewStub />
        </>
      }
      account={
        user
          ? {
              label: user.name ?? 'Account',
              avatar: (
                <ProfileAvatar
                  src={avatarUrl}
                  identity={user}
                  alt={user.name ?? 'User'}
                  className="w-full h-full rounded-full object-cover"
                />
              ),
              // Same card the old rail's user row opened — parity, not a redesign.
              menu: (
                <UserCard
                  userInitial={(user.name ?? '?').charAt(0).toUpperCase()}
                  userName={user.name ?? 'Account'}
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
      {current.view}

      {/* Account modals */}
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
        planTier={creditsData?.planTier || 'free'}
        onOpenBilling={() => { setShowSettings(false); setIsBillingOpen(true); }}
        onOpenTopup={() => { setShowSettings(false); setIsTopupOpen(true); }}
      />
      <BillingModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
        onOpenTopup={() => { setIsBillingOpen(false); setIsTopupOpen(true); }}
      />
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
      <ReferralModal
        open={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
      />
    </AppShell>
  );
}
