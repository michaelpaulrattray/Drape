/**
 * Profile Settings Modal — thin shell that composes tab sub-components.
 * All tab implementations live in @/features/profile/.
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">Settings</h2>
            <p className="text-sm text-[#757575] mt-0.5">Manage your account preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-[#0A0A0A] hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Messages */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        <div className="flex h-[calc(85vh-80px)]">
          {/* Sidebar Tabs */}
          <div className="w-52 border-r border-gray-200 p-5 space-y-1 bg-gray-50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-[#0A0A0A] shadow-sm border border-gray-200"
                    : "text-[#757575] hover:text-[#0A0A0A] hover:bg-white/50"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-[#0A0A0A]" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white" style={{ scrollbarWidth: 'none' }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
