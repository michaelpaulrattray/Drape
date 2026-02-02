import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Redirect } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  User,
  Camera,
  Mail,
  Calendar,
  Shield,
  Loader2,
  Check,
  X,
  Upload,
  RotateCcw,
} from "lucide-react";

export default function Settings() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  // Get profile data
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // State for editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const updateDisplayName = trpc.profile.updateDisplayName.useMutation({
    onSuccess: () => {
      toast.success("Display name updated");
      setIsEditingName(false);
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update display name");
    },
  });

  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar updated");
      setIsUploadingAvatar(false);
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload avatar");
      setIsUploadingAvatar(false);
    },
  });

  const resetAvatar = trpc.profile.resetAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar reset to default");
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset avatar");
    },
  });

  if (loading || profileLoading) {
    return <DashboardLayout><div /></DashboardLayout>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const handleStartEditName = () => {
    setDisplayName(profile?.displayName || profile?.name || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    updateDisplayName.mutate({ displayName });
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setDisplayName("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadAvatar.mutate({
          base64,
          mimeType: file.type,
        });
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to process image");
      setIsUploadingAvatar(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetAvatar = () => {
    if (profile?.customAvatarUrl) {
      resetAvatar.mutate();
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">Settings</h1>
          <p className="text-slate-400 text-sm">
            Manage your account settings and profile information
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-[#14121D] border border-white/5 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-base font-medium text-white">Profile</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your public profile information
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-start gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-3xl font-semibold overflow-hidden ring-2 ring-white/10">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName || profile.name || ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (profile?.displayName || profile?.name)?.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-medium text-white mb-1">Profile Photo</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Upload a custom avatar or use your default profile picture
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-4 py-2 rounded-lg bg-[#1F1D2B] text-slate-300 text-sm font-medium hover:bg-[#252333] transition-colors border border-white/5 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photo
                  </button>
                  {profile?.customAvatarUrl && (
                    <button
                      onClick={handleResetAvatar}
                      disabled={resetAvatar.isPending}
                      className="px-4 py-2 rounded-lg text-slate-400 text-sm font-medium hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className="flex items-start justify-between py-4 border-t border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#1F1D2B] flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Display Name</h3>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter display name"
                        maxLength={50}
                        className="px-3 py-1.5 rounded-lg bg-[#1F1D2B] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500/50 w-64"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={updateDisplayName.isPending}
                        className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {updateDisplayName.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEditName}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {profile?.displayName || profile?.name || "Not set"}
                    </p>
                  )}
                </div>
              </div>
              {!isEditingName && (
                <button
                  onClick={handleStartEditName}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Email */}
            <div className="flex items-start justify-between py-4 border-t border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#1F1D2B] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Email</h3>
                  <p className="text-sm text-slate-400">
                    {profile?.email || "Not available"}
                  </p>
                </div>
              </div>
              <span className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-white/5 text-slate-500">
                Verified
              </span>
            </div>

            {/* Member Since */}
            <div className="flex items-start gap-4 py-4 border-t border-white/5">
              <div className="w-10 h-10 rounded-lg bg-[#1F1D2B] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">Member Since</h3>
                <p className="text-sm text-slate-400">
                  {formatDate(profile?.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-[#14121D] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-base font-medium text-white">Security</h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage your account security settings
            </p>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1F1D2B] flex items-center justify-center">
                <Shield className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white mb-1">
                  Authentication
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Your account is secured with OAuth authentication
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                    Secure
                  </span>
                  <span className="text-xs text-slate-500">
                    Last login: {formatDate(new Date())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
