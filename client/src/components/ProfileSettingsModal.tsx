import { useState, useRef } from "react";
import {
  X,
  User,
  Mail,
  CreditCard,
  Bell,
  Shield,
  Upload,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
  profileImage: string | null;
  bannerImage: string | null;
  onProfileImageChange: (url: string) => void;
  onBannerImageChange: (url: string) => void;
  pointsBalance: number;
  planTier: string;
  defaultAvatar: string;
  defaultBanner: string;
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  user,
  profileImage,
  bannerImage,
  onProfileImageChange,
  onBannerImageChange,
  pointsBalance,
  planTier,
  defaultAvatar,
  defaultBanner,
}: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "billing" | "notifications" | "security">("profile");
  const [editedName, setEditedName] = useState(user?.name || "");
  const [editedEmail, setEditedEmail] = useState(user?.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save - in production this would call a tRPC mutation
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    onClose();
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onProfileImageChange(url);
    }
  };

  const handleBannerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onBannerImageChange(url);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "billing" as const, label: "Billing & Plan", icon: CreditCard },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0A0A0A]/95 border border-white/10 rounded-xl backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-xs text-neutral-500 font-mono">// Manage your account</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(85vh-80px)]">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-white/10 p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-white/5 text-white border border-white/10"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-orange-500" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'none' }}>
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Banner Upload */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Cover Image
                  </label>
                  <div className="relative h-32 rounded-lg overflow-hidden border border-white/10 group">
                    <img
                      src={bannerImage || defaultBanner}
                      alt="Cover"
                      className="w-full h-full object-cover"
                      style={{ filter: 'grayscale(100%) brightness(0.4)' }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => bannerInputRef.current?.click()}
                        className="px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Change Cover
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={bannerInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleBannerImageUpload}
                    />
                  </div>
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Profile Picture
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10">
                        <img
                          src={profileImage || defaultAvatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => profilePicInputRef.current?.click()}
                        className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Upload className="w-5 h-5 text-white" />
                      </button>
                      <input
                        type="file"
                        ref={profilePicInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-300">Upload a new profile picture</p>
                      <p className="text-xs text-neutral-500 font-mono">JPG, PNG or GIF. Max 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
                    // Display Name
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="Your display name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
                    // Email Address
                  </label>
                  <input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="your@email.com"
                  />
                  <p className="text-xs text-neutral-600 mt-2 font-mono">Used for account notifications</p>
                </div>

                {/* Save Button */}
                <div className="pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6">
                {/* Current Plan */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Current Plan
                  </label>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-none bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium capitalize">{planTier} Plan</p>
                          <p className="text-xs text-neutral-500 font-mono">Active subscription</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-none bg-orange-500/20 text-orange-400 text-[10px] font-mono uppercase tracking-wider border border-orange-500/30">
                        {planTier === "free" ? "FREE" : "PRO"}
                      </span>
                    </div>
                    {planTier === "free" && (
                      <button className="w-full mt-2 px-4 py-2.5 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Upgrade to Pro
                      </button>
                    )}
                  </div>
                </div>

                {/* Credits Balance */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Credits Balance
                  </label>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-white">{pointsBalance}</p>
                        <p className="text-xs text-neutral-500 font-mono">Available credits</p>
                      </div>
                      <button className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Buy Credits
                      </button>
                    </div>
                  </div>
                </div>

                {/* Usage History */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Recent Usage
                  </label>
                  <div className="space-y-2">
                    {[
                      { action: "Model Generation", credits: -10, date: "Today" },
                      { action: "Campaign Export", credits: -5, date: "Yesterday" },
                      { action: "Credits Purchase", credits: 100, date: "3 days ago" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div>
                          <p className="text-sm text-white">{item.action}</p>
                          <p className="text-xs text-neutral-500 font-mono">{item.date}</p>
                        </div>
                        <span className={`text-sm font-mono ${item.credits > 0 ? "text-green-400" : "text-neutral-400"}`}>
                          {item.credits > 0 ? "+" : ""}{item.credits}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-3 px-4 py-2 rounded-md bg-white/5 border border-white/10 text-neutral-400 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-2">
                    View Full History
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Email Notifications
                  </label>
                  <div className="space-y-3">
                    {[
                      { label: "Generation complete", description: "Get notified when your AI generations are ready", enabled: true },
                      { label: "Weekly digest", description: "Summary of your activity and new features", enabled: false },
                      { label: "Marketing updates", description: "News about FormaStudio and special offers", enabled: false },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                        <div>
                          <p className="text-sm text-white">{item.label}</p>
                          <p className="text-xs text-neutral-500">{item.description}</p>
                        </div>
                        <button
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            item.enabled ? "bg-orange-500" : "bg-white/10"
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              item.enabled ? "left-7" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Connected Accounts
                  </label>
                  <div className="space-y-3">
                    {[
                      { provider: "Google", connected: true, email: user?.email },
                      { provider: "Apple", connected: false, email: null },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            {item.provider === "Google" ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-white">{item.provider}</p>
                            {item.connected ? (
                              <p className="text-xs text-neutral-500 font-mono">{item.email}</p>
                            ) : (
                              <p className="text-xs text-neutral-500">Not connected</p>
                            )}
                          </div>
                        </div>
                        <button
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            item.connected
                              ? "bg-white/5 border border-white/10 text-neutral-400 hover:text-white"
                              : "bg-orange-500 text-white hover:bg-orange-600"
                          }`}
                        >
                          {item.connected ? "Disconnect" : "Connect"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">
                    // Danger Zone
                  </label>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400 mb-3">Delete your account and all associated data. This action cannot be undone.</p>
                    <button className="px-4 py-2 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
