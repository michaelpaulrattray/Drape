import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Menu, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png";
const DEFAULT_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lkbGgJQVyIVaJXfM.png";
const DEFAULT_BANNER = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lkbGgJQVyIVaJXfM.png";

interface StudioHeaderProps {
  creditsBalance: number;
  planTier: string;
}

export function StudioHeader({ creditsBalance, planTier }: StudioHeaderProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showMobilePanel, setShowMobilePanel } = useCastingUIStore();
  const [showSettings, setShowSettings] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  // Profile data for settings modal
  const { data: profileData, refetch: refetchProfile } = trpc.profile.get.useQuery(
    undefined,
    { enabled: !!user }
  );

  useEffect(() => {
    if (profileData?.avatarUrl) setProfileImage(profileData.avatarUrl);
    if (profileData?.bannerUrl) setBannerImage(profileData.bannerUrl);
  }, [profileData?.avatarUrl, profileData?.bannerUrl]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      <header className="h-11 flex-shrink-0 bg-white border-b border-[#0A0A0A]/10 flex items-center justify-between px-4 z-30">
        {/* Left: Logo + Back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-[#757575] hover:text-[#0A0A0A] transition-colors group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <img
              src={LOGO_URL}
              alt="Forma®"
              className="w-6 h-6"
            />
          </button>
          <div className="hidden sm:block h-4 w-px bg-[#0A0A0A]/10" />
          <span className="hidden sm:block text-xs font-medium text-[#757575] tracking-wide">
            Casting Studio
          </span>
        </div>

        {/* Right: Credits + Avatar + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Credits Pill */}
          <button
            onClick={() => useCastingUIStore.getState().setIsTopupOpen(true)}
            className="flex items-center gap-1.5 bg-[#F5F5F5] hover:bg-[#EBEBEB] rounded-full px-3 py-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#0A0A0A]">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="text-xs font-semibold text-[#0A0A0A]">{creditsBalance}</span>
          </button>

          {/* User Avatar */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 rounded-full overflow-hidden border border-[#0A0A0A]/10 hover:border-[#0A0A0A]/30 transition-colors flex-shrink-0"
          >
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#0A0A0A] flex items-center justify-center">
                <span className="text-[10px] font-semibold text-white">{userInitial}</span>
              </div>
            )}
          </button>

          {/* Mobile Panel Toggle */}
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="lg:hidden p-1.5 rounded-full bg-[#0A0A0A] text-white"
          >
            {showMobilePanel ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
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
