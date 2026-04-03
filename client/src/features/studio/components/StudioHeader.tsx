import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Menu, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { BugReportTrigger } from '@/components/BugReportButton';
import { useStudioStore } from '../stores/useStudioStore';
import { STUDIO_TOOLS } from '../types';

const LOGO_URL = '/drape-logo-white.svg';
const DEFAULT_AVATAR =
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lkbGgJQVyIVaJXfM.png';
const DEFAULT_BANNER =
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lkbGgJQVyIVaJXfM.png';

interface StudioHeaderProps {
  creditsBalance: number;
  planTier: string;
}

export function StudioHeader({ creditsBalance, planTier }: StudioHeaderProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showMobilePanel, setShowMobilePanel } = useCastingUIStore();
  const activeTool = useStudioStore((s) => s.activeTool);
  const [showSettings, setShowSettings] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  const { data: profileData, refetch: refetchProfile } =
    trpc.profile.get.useQuery(undefined, { enabled: !!user });

  useEffect(() => {
    if (profileData?.avatarUrl) setProfileImage(profileData.avatarUrl);
    if (profileData?.bannerUrl) setBannerImage(profileData.bannerUrl);
  }, [profileData?.avatarUrl, profileData?.bannerUrl]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || '?';

  // Derive the studio label from the active tool
  const activeToolMeta = STUDIO_TOOLS.find((t) => t.id === activeTool);
  const studioLabel = activeToolMeta?.label || 'Drape Studio';

  return (
    <>
      <header
        className="h-11 flex-shrink-0 flex items-center justify-between px-4 z-30"
        style={{
          background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Left: Logo + Back + Studio Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 transition-colors group"
            style={{ color: '#52524B' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1a1a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#999';
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <img src={LOGO_URL} alt="Drape" className="w-6 h-6" />
          </button>
          <div
            className="hidden sm:block h-4 w-px"
            style={{ background: 'rgba(0,0,0,0.08)' }}
          />
          <span
            className="hidden sm:block"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#52524B',
              letterSpacing: '0.04em',
            }}
          >
            {studioLabel}
          </span>
        </div>

        {/* Right: Credits + Avatar + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Credits Pill */}
          <button
            onClick={() => useCastingUIStore.getState().setIsTopupOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors"
            style={{ background: '#F5F3F0' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EBE7E2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F5F3F0';
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#1a1a1a' }}
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {creditsBalance}
            </span>
          </button>

          {/* Bug Report */}
          <BugReportTrigger />

          {/* User Avatar */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 transition-all"
            style={{ border: '1.5px solid rgba(0,0,0,0.08)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
            }}
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: '#1a1a1a' }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  {userInitial}
                </span>
              </div>
            )}
          </button>

          {/* Mobile Panel Toggle */}
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="lg:hidden p-1.5 rounded-full"
            style={{ background: '#1a1a1a', color: '#fff' }}
          >
            {showMobilePanel ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Menu className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onProfileUpdate={() => refetchProfile()}
        user={user}
        profileImage={profileImage}
        bannerImage={bannerImage}
        onProfileImageChange={setProfileImage}
        onBannerImageChange={setBannerImage}
        creditsBalance={creditsBalance}
        planTier={planTier}
        defaultAvatar={DEFAULT_AVATAR}
        defaultBanner={DEFAULT_BANNER}
      />
    </>
  );
}
