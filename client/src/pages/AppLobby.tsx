/**
 * AppLobby — the /app lobby shell: auth guard, left rail, routed view.
 *
 * The rail navigates between Home (recent work + tools), Boards, and the
 * three library views; all five URLs render this same shell so the rail
 * never remounts. The rail's user row opens the shared account card
 * (Settings / Billing / Share Drape / Log out), whose modals — profile
 * settings, billing, top-up, referral — are owned here, wired the same
 * way as in DrapeStudio. Below md the rail is hidden and a slim header
 * carries logo + logout.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { LobbyRail } from '@/features/lobby/LobbyRail';
import { LobbyUtilityMenu } from '@/features/lobby/LobbyUtilityMenu';
import { HomeView } from '@/features/lobby/HomeView';
import { BoardsView } from '@/features/lobby/BoardsView';
import { LibraryView } from '@/features/lobby/LibraryView';
import { BillingModal } from '@/features/billing';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { ReferralModal } from '@/features/referral/ReferralModal';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';

function MobileHeader({
  user,
  onLogout,
}: {
  user: { name: string | null; avatarUrl?: string | null };
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="md:hidden flex items-center justify-between px-6 py-5">
      <img src="/drape-logo.svg" alt="drape" style={{ height: 20 }} />
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="block" aria-label="Account menu">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? 'User'}
              className="w-8 h-8 rounded-full object-cover"
              style={{ border: '2px solid rgba(0,0,0,0.06)' }}
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 600 }}
            >
              {(user.name ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-10 z-50 py-1.5 rounded-xl"
              style={{
                background: '#fff',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.06)',
                minWidth: 140,
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full px-3.5 py-2 text-left"
                style={{ fontSize: 13, color: '#1a1a1a' }}
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

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
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100vh', background: '#f8f7f4' }}
      />
    );
  }

  let view;
  switch (location) {
    case '/app/boards':
      view = <BoardsView />;
      break;
    case '/app/models':
      view = <LibraryView kind="models" />;
      break;
    case '/app/garments':
      view = <LibraryView kind="garments" />;
      break;
    case '/app/looks':
      view = <LibraryView kind="looks" />;
      break;
    default:
      view = <HomeView />;
  }

  return (
    <div className="flex relative" style={{ height: '100vh', background: '#f8f7f4' }}>
      <LobbyUtilityMenu />
      <LobbyRail
        user={user}
        profileImage={profileImage}
        onLogout={logout}
        onOpenSettings={() => setShowSettings(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
        onOpenReferral={() => setIsReferralOpen(true)}
      />
      <main className="flex-1 overflow-y-auto flex flex-col">
        {user && <MobileHeader user={user} onLogout={logout} />}
        {view}
      </main>

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
        defaultAvatar=""
        defaultBanner=""
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
    </div>
  );
}
