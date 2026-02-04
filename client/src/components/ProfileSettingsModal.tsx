import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { compressImage, AVATAR_COMPRESSION, BANNER_COMPRESSION } from "@/lib/imageUtils";
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
  HardDrive,
  Download,
  Calendar,
  Loader2,
  ExternalLink,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Activity,
} from "lucide-react";

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

// Billing Tab Content Component (Manus-style)
function BillingTabContent({
  planTier,
  creditsBalance,
  onOpenBilling,
  onOpenTopup,
  onClose,
}: {
  planTier: string;
  creditsBalance: number;
  onOpenBilling?: () => void;
  onOpenTopup?: () => void;
  onClose: () => void;
}) {
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  
  // Fetch subscription details
  const { data: subscriptionDetails } = trpc.billing.getSubscriptionDetails.useQuery();
  
  // Fetch recent invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = trpc.billing.getInvoices.useQuery(
    { limit: 5 },
    { enabled: !showAllInvoices }
  );
  
  // Fetch all invoices when expanded
  const { data: allInvoicesData, isLoading: isLoadingAllInvoices } = trpc.billing.getAllInvoices.useQuery(
    undefined,
    { enabled: showAllInvoices }
  );

  // Fetch billing status for credits breakdown
  const { data: billingStatus } = trpc.billing.getStatus.useQuery();

  const invoices = showAllInvoices ? allInvoicesData?.invoices : invoicesData?.invoices;
  const hasMoreInvoices = showAllInvoices ? allInvoicesData?.hasMore : invoicesData?.hasMore;

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getPlanLabel = (tier: string) => {
    switch (tier) {
      case "starter": return "FormaStudio Starter";
      case "pro": return "FormaStudio Pro";
      case "studio": return "FormaStudio Studio";
      case "enterprise": return "FormaStudio Enterprise";
      default: return "Free Plan";
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card - Light Theme */}
      <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{getPlanLabel(planTier)}</h3>
            {subscriptionDetails?.renewalDate && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                Renewal date {formatDate(subscriptionDetails.renewalDate)}
              </p>
            )}
            {subscriptionDetails?.cancelAtPeriodEnd && (
              <p className="text-sm text-amber-600 mt-1">
                Cancels at end of billing period
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {planTier !== "free" && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBilling?.();
                }}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
              >
                Manage
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                onOpenTopup?.();
              }}
              className="px-4 py-2 rounded-lg btn-slate text-sm font-medium transition-all"
            >
              Add credits
            </button>
          </div>
        </div>

        {/* Credits Breakdown */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-500">Credits</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">{creditsBalance.toLocaleString()}</span>
          </div>
          
          {billingStatus && planTier !== "free" && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Rollover credits</span>
                <span className="text-gray-700">{(billingStatus.rolloverCredits || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Monthly credits</span>
                <span className="text-gray-700">
                  {((billingStatus.creditsPurchased || 0) - (billingStatus.rolloverCredits || 0)).toLocaleString()}
                </span>
              </div>
            </>
          )}

          {planTier !== "free" && subscriptionDetails?.renewalDate && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Monthly credit refresh</span>
              </div>
              <span className="text-gray-700">
                Refreshes on {formatDate(subscriptionDetails.renewalDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Button for Free Users */}
      {planTier === "free" && (
        <button
          onClick={() => {
            onClose();
            onOpenBilling?.();
          }}
          className="w-full px-4 py-3 rounded-xl btn-slate text-sm font-medium transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Plan
        </button>
      )}

      {/* Recent Activity / Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-zinc-400">Recent activity</label>
          {(hasMoreInvoices || showAllInvoices) && (
            <button
              onClick={() => setShowAllInvoices(!showAllInvoices)}
              className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
            >
              {showAllInvoices ? "Show less" : "View all invoices"}
              <ChevronRight className={`w-4 h-4 transition-transform ${showAllInvoices ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {(isLoadingInvoices || isLoadingAllInvoices) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : invoices && invoices.length > 0 ? (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase">Date</span>
              <span className="text-xs font-medium text-gray-500 uppercase">Amount</span>
              <span className="text-xs font-medium text-gray-500 uppercase text-right"></span>
            </div>
            
            {/* Invoice Rows */}
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors bg-white"
              >
                <span className="text-sm text-gray-900">{formatDate(invoice.date)}</span>
                <span className="text-sm text-gray-900">{formatAmount(invoice.amount)}</span>
                <div className="flex justify-end">
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                    >
                      Download
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  ) : invoice.hostedUrl ? (
                    <a
                      href={invoice.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                    >
                      View
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No invoices yet
          </div>
        )}
      </div>
    </div>
  );
}

// Usage Tab Content Component
function UsageTabContent() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [historyPage, setHistoryPage] = useState(0);
  const pageSize = 10;

  // Fetch usage stats
  const { data: stats, isLoading: isLoadingStats } = trpc.usage.getStats.useQuery({ days: period });

  // Fetch daily usage for chart
  const { data: dailyUsage, isLoading: isLoadingDaily } = trpc.usage.getDailyUsage.useQuery({ days: period });

  // Fetch transaction history
  const { data: historyData, isLoading: isLoadingHistory } = trpc.usage.getHistory.useQuery({
    limit: pageSize,
    offset: historyPage * pageSize,
  });

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "generation": return "Generation";
      case "purchase": return "Purchase";
      case "bonus": return "Bonus";
      case "refund": return "Refund";
      case "signup": return "Welcome Bonus";
      case "topup": return "Credit Top-up";
      case "subscription": return "Subscription";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "generation": return "text-gray-700";
      case "purchase": return "text-green-600";
      case "bonus": return "text-blue-600";
      case "refund": return "text-amber-600";
      case "signup": return "text-purple-600";
      case "topup": return "text-green-600";
      case "subscription": return "text-cyan-600";
      default: return "text-gray-500";
    }
  };

  // Calculate max for chart scaling
  const maxCredits = dailyUsage ? Math.max(...dailyUsage.map(d => d.creditsUsed), 1) : 1;

  const totalPages = historyData ? Math.ceil(historyData.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-obsidian">Usage Analytics</h3>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === days
                  ? "bg-slate-accent text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500 uppercase">Credits Used</span>
          </div>
          {isLoadingStats ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <p className="text-2xl font-bold text-obsidian">{stats?.totalCreditsUsed.toLocaleString() || 0}</p>
          )}
        </div>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500 uppercase">Generations</span>
          </div>
          {isLoadingStats ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <p className="text-2xl font-bold text-obsidian">{stats?.totalGenerations.toLocaleString() || 0}</p>
          )}
        </div>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            <span className="text-xs text-gray-500 uppercase">Daily Avg</span>
          </div>
          {isLoadingStats ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <p className="text-2xl font-bold text-obsidian">{stats?.averagePerDay || 0}</p>
          )}
        </div>
      </div>

      {/* Usage Chart */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-3">Daily Usage</label>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          {isLoadingDaily ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : dailyUsage && dailyUsage.length > 0 ? (
            <div className="h-32">
              {/* Simple bar chart */}
              <div className="flex items-end justify-between h-full gap-1">
                {dailyUsage.map((day, idx) => {
                  const height = maxCredits > 0 ? (day.creditsUsed / maxCredits) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full bg-gray-400 rounded-t transition-all hover:bg-gray-500"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                          <p className="text-gray-900 font-medium">{day.creditsUsed} credits</p>
                          <p className="text-gray-500">{formatDate(day.date)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{formatDate(dailyUsage[0]?.date || new Date())}</span>
                <span>{formatDate(dailyUsage[dailyUsage.length - 1]?.date || new Date())}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              No usage data yet
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-3">Transaction History</label>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : historyData && historyData.transactions.length > 0 ? (
          <>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-500 uppercase">Type</span>
                <span className="text-xs font-medium text-gray-500 uppercase">Description</span>
                <span className="text-xs font-medium text-gray-500 uppercase text-right">Credits</span>
                <span className="text-xs font-medium text-gray-500 uppercase text-right">Date</span>
              </div>

              {/* Transaction Rows */}
              {historyData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors bg-white"
                >
                  <span className={`text-sm font-medium ${getTypeColor(tx.type)}`}>
                    {getTypeLabel(tx.type)}
                  </span>
                  <span className="text-sm text-gray-600 truncate" title={tx.description || undefined}>
                    {tx.description || "—"}
                  </span>
                  <span className={`text-sm font-medium text-right ${
                    tx.amount > 0 ? "text-green-600" : "text-gray-500"
                  }`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                  <span className="text-sm text-gray-500 text-right">
                    {formatFullDate(tx.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  Showing {historyPage * pageSize + 1}-{Math.min((historyPage + 1) * pageSize, historyData.total)} of {historyData.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={historyPage >= totalPages - 1}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
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
  const [editedName, setEditedName] = useState(user?.name || "");
  const [editedBio, setEditedBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Local preview URLs for instant feedback
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [localBannerPreview, setLocalBannerPreview] = useState<string | null>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch user profile data
  const { data: profileData, refetch: refetchProfile } = trpc.profile.get.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Fetch storage info
  const { data: storageInfo } = trpc.profile.storageInfo.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Mutations
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      refetchProfile();
      onProfileUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      onProfileImageChange(data.avatarUrl);
      setLocalAvatarPreview(null); // Clear local preview, use server URL
      refetchProfile();
      onProfileUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message);
      setLocalAvatarPreview(null); // Clear failed preview
    },
  });

  const uploadBannerMutation = trpc.profile.uploadBanner.useMutation({
    onSuccess: (data) => {
      onBannerImageChange(data.bannerUrl);
      setLocalBannerPreview(null); // Clear local preview, use server URL
      refetchProfile();
      onProfileUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message);
      setLocalBannerPreview(null); // Clear failed preview
    },
  });

  // Update local state when profile data loads
  useEffect(() => {
    if (profileData) {
      setEditedName(profileData.displayName || profileData.name || "");
      setEditedBio(profileData.bio || "");
      if (profileData.avatarUrl) {
        onProfileImageChange(profileData.avatarUrl);
      }
      if (profileData.bannerUrl) {
        onBannerImageChange(profileData.bannerUrl);
      }
    }
  }, [profileData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        displayName: editedName || undefined,
        bio: editedBio || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max for original)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar file size must be under 5MB");
      return;
    }

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Avatar must be a JPG, PNG, or WebP image");
      return;
    }

    // Show instant preview
    const previewUrl = URL.createObjectURL(file);
    setLocalAvatarPreview(previewUrl);
    setIsUploadingAvatar(true);

    try {
      // Compress image before upload
      const compressed = await compressImage(
        file,
        AVATAR_COMPRESSION.maxWidth,
        AVATAR_COMPRESSION.maxHeight,
        AVATAR_COMPRESSION.quality
      );

      await uploadAvatarMutation.mutateAsync({
        base64Data: compressed.base64,
        mimeType: compressed.mimeType as "image/jpeg" | "image/png" | "image/webp",
        fileSize: compressed.size,
      });
    } catch (err) {
      // Error already handled by mutation onError
    } finally {
      setIsUploadingAvatar(false);
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max for original)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Banner file size must be under 10MB");
      return;
    }

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Banner must be a JPG, PNG, or WebP image");
      return;
    }

    // Show instant preview
    const previewUrl = URL.createObjectURL(file);
    setLocalBannerPreview(previewUrl);
    setIsUploadingBanner(true);

    try {
      // Compress image before upload
      const compressed = await compressImage(
        file,
        BANNER_COMPRESSION.maxWidth,
        BANNER_COMPRESSION.maxHeight,
        BANNER_COMPRESSION.quality
      );

      await uploadBannerMutation.mutateAsync({
        base64Data: compressed.base64,
        mimeType: compressed.mimeType as "image/jpeg" | "image/png" | "image/webp",
        fileSize: compressed.size,
      });
    } catch (err) {
      // Error already handled by mutation onError
    } finally {
      setIsUploadingBanner(false);
      URL.revokeObjectURL(previewUrl);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

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
            <h2 className="text-xl font-semibold text-obsidian tracking-tight">Settings</h2>
            <p className="text-sm text-subtle mt-0.5">Manage your account preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-obsidian hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Messages - Errors now use toast notifications */}
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
                    ? "bg-white text-obsidian shadow-sm border border-gray-200"
                    : "text-subtle hover:text-obsidian hover:bg-white/50"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-slate-accent" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white" style={{ scrollbarWidth: 'none' }}>
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Banner Upload */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Cover Image
                  </label>
                  <div className="relative h-32 rounded-xl overflow-hidden border border-gray-200 group">
                    <img
                      src={localBannerPreview || bannerImage || profileData?.bannerUrl || defaultBanner}
                      alt="Cover"
                      className="w-full h-full object-cover"
                      style={{ filter: 'grayscale(50%) brightness(0.8)' }}
                    />
                    {/* Loading overlay */}
                    {isUploadingBanner && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                          <span className="text-sm text-obsidian">Uploading...</span>
                        </div>
                      </div>
                    )}
                    {/* Hover overlay */}
                    {!isUploadingBanner && (
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => bannerInputRef.current?.click()}
                          className="px-4 py-2 rounded-md bg-white/90 border border-gray-200 text-obsidian text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Change Cover
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={bannerInputRef}
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleBannerImageUpload}
                    />
                  </div>
                  <p className="text-xs text-subtle mt-2">JPG, PNG or WebP. Max 10MB.</p>
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-200">
                        <img
                          src={localAvatarPreview || profileImage || profileData?.avatarUrl || defaultAvatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                        {/* Loading overlay */}
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {/* Hover overlay - only show when not uploading */}
                      {!isUploadingAvatar && (
                        <button
                          onClick={() => profilePicInputRef.current?.click()}
                          className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Upload className="w-5 h-5 text-white" />
                        </button>
                      )}
                      <input
                        type="file"
                        ref={profilePicInputRef}
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleProfileImageUpload}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-charcoal">Upload a new profile picture</p>
                      <p className="text-xs text-subtle">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    maxLength={100}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-obsidian text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/20 transition-all"
                    placeholder="Your display name"
                  />
                  <p className="text-xs text-subtle mt-1.5">{editedName.length}/100 characters</p>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Bio
                  </label>
                  <textarea
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-obsidian text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/20 transition-all resize-none"
                    placeholder="Tell us about yourself..."
                  />
                  <p className="text-xs text-subtle mt-1.5">{editedBio.length}/500 characters</p>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData?.email || user?.email || ""}
                    readOnly
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-subtle text-sm cursor-not-allowed"
                  />
                  <p className="text-xs text-subtle mt-1.5">Email cannot be changed</p>
                </div>

                {/* Storage Usage */}
                {storageInfo && (
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Storage Usage
                    </label>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-subtle" />
                          <span className="text-sm text-obsidian">
                            {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.limit)}
                          </span>
                        </div>
                        <span className="text-xs text-subtle">{storageInfo.percentage}% used</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            storageInfo.percentage > 90 ? "bg-red-500" : 
                            storageInfo.percentage > 70 ? "bg-amber-500" : "bg-green-500"
                          }`}
                          style={{ width: `${storageInfo.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <div className="pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 rounded-xl btn-slate text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
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

            {activeTab === "usage" && (
              <UsageTabContent />
            )}

            {activeTab === "billing" && (
              <BillingTabContent
                planTier={planTier}
                creditsBalance={creditsBalance}
                onOpenBilling={onOpenBilling}
                onOpenTopup={onOpenTopup}
                onClose={onClose}
              />
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Email Notifications
                  </label>
                  <div className="space-y-3">
                    {[
                      { label: "Generation complete", description: "Get notified when your AI generations are ready", enabled: true },
                      { label: "Weekly digest", description: "Summary of your activity and new features", enabled: false },
                      { label: "Marketing updates", description: "News about FormaStudio and special offers", enabled: false },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div>
                          <p className="text-sm text-obsidian">{item.label}</p>
                          <p className="text-xs text-subtle">{item.description}</p>
                        </div>
                        <button
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            item.enabled ? "bg-slate-accent" : "bg-gray-200"
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
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
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Connected Accounts
                  </label>
                  <div className="space-y-3">
                    {[
                      { provider: "Google", connected: true, email: profileData?.email || user?.email },
                      { provider: "Apple", connected: false, email: null },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                            {item.provider === "Google" ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-obsidian" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-obsidian">{item.provider}</p>
                            {item.connected ? (
                              <p className="text-xs text-subtle">{item.email}</p>
                            ) : (
                              <p className="text-xs text-subtle">Not connected</p>
                            )}
                          </div>
                        </div>
                        <button
                          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                            item.connected
                              ? "bg-white border border-gray-200 text-charcoal hover:bg-gray-50"
                              : "btn-slate"
                          }`}
                        >
                          {item.connected ? "Disconnect" : "Connect"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-3">
                    Danger Zone
                  </label>
                  <div className="p-5 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600 mb-3">Delete your account and all associated data. This action cannot be undone.</p>
                    <button className="px-4 py-2.5 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-200 transition-all">
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
