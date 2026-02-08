/**
 * Profile Settings Modal — thin shell that composes tab sub-components.
 * All tab implementations live in @/features/profile/.
 * 
 * Mobile: full-screen sheet with horizontal scrollable tab bar at top.
 * Desktop: centered modal with sidebar tab navigation.
 */
import { useState } from "react";
import {
  X,
  User,
  CreditCard,
  Bell,
  Shield,
  Check,
  BarChart3,
} from "lucide-react";
import { ProfileTab, BillingTab, UsageTab, NotificationsTab, SecurityTab } from "@/features/profile";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: () => void;
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
  profileImage: string | null;
  bannerImage: string | null;
  onProfileImageChange: (url: string) => void;
  onBannerImageChange: (url: string) => void;
  creditsBalance: number;
  planTier: string;
  defaultAvatar: string;
  defaultBanner: string;
  onOpenBilling?: () => void;
  onOpenTopup?: () => void;
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  onProfileUpdate,
  user,
  profileImage,
  bannerImage,
  onProfileImageChange,
  onBannerImageChange,
  creditsBalance,
  planTier,
  defaultAvatar,
  defaultBanner,
  onOpenBilling,
  onOpenTopup,
}: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "usage" | "billing" | "notifications" | "security">("profile");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "usage" as const, label: "Usage", icon: BarChart3 },
    { id: "billing" as const, label: "Billing & Plan", icon: CreditCard },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  const renderContent = () => (
    <>
      {activeTab === "profile" && (
        <ProfileTab
          user={user}
          profileImage={profileImage}
          bannerImage={bannerImage}
          onProfileImageChange={onProfileImageChange}
          onBannerImageChange={onBannerImageChange}
          defaultAvatar={defaultAvatar}
          defaultBanner={defaultBanner}
          onProfileUpdate={onProfileUpdate}
          isOpen={isOpen}
        />
      )}
      {activeTab === "usage" && <UsageTab />}
      {activeTab === "billing" && (
        <BillingTab
          planTier={planTier}
          creditsBalance={creditsBalance}
          onOpenBilling={onOpenBilling}
          onOpenTopup={onOpenTopup}
          onClose={onClose}
        />
      )}
      {activeTab === "notifications" && <NotificationsTab />}
      {activeTab === "security" && (
        <SecurityTab
          user={user}
          profileEmail={user?.email}
        />
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal — full-screen on mobile, centered card on md+ */}
      <div className="relative w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl bg-white md:border md:border-[#0A0A0A]/10 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-5 border-b border-[#0A0A0A]/10 shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-[#0A0A0A] tracking-tight">Settings</h2>
            <p className="text-xs md:text-sm text-[#757575] mt-0.5">Manage your account preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#757575] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Messages */}
        {successMessage && (
          <div className="mx-4 md:mx-6 mt-3 md:mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Mobile: horizontal tab bar + scrollable content */}
        <div className="flex flex-col md:hidden flex-1 overflow-hidden">
          {/* Horizontal scrollable tab bar */}
          <div className="shrink-0 border-b border-[#0A0A0A]/10 bg-[#FAFAFA]">
            <div className="flex overflow-x-auto px-3 py-2 gap-1.5 no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeTab === tab.id
                      ? "bg-[#0A0A0A] text-white"
                      : "text-[#757575] hover:text-[#0A0A0A] bg-white border border-[#0A0A0A]/10"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile content area */}
          <div className="flex-1 overflow-y-auto p-4 bg-white" style={{ scrollbarWidth: 'none' }}>
            {renderContent()}
          </div>
        </div>

        {/* Desktop: sidebar + content */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-52 border-r border-[#0A0A0A]/10 p-5 space-y-1 bg-[#FAFAFA] shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-[#0A0A0A] shadow-sm border border-[#0A0A0A]/10"
                    : "text-[#757575] hover:text-[#0A0A0A] hover:bg-white/50"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-[#0A0A0A]" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop content area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white" style={{ scrollbarWidth: 'none' }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
