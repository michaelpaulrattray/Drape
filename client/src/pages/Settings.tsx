import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Redirect } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Loader2,
  Check,
  X,
  Upload,
  RotateCcw,
  ArrowRight,
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
      <div className="min-h-screen relative">
        {/* Background Grid Lines */}
        <div className="fixed inset-0 grid-lines-dark pointer-events-none z-0" />

        {/* Content */}
        <div className="relative z-10 p-6 md:p-8 lg:p-12 max-w-4xl">
          {/* Header */}
          <section className="border-b border-white/5 pb-8 mb-8">
            <p className="text-[10px] uppercase font-semibold tracking-widest mb-2 text-orange">
              Account
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-none font-geist text-white">
              Settings
              <span className="text-orange">.</span>
            </h1>
            <p className="text-sm text-white/50 mt-3">
              Manage your account settings and profile information
            </p>
          </section>

          {/* Profile Section */}
          <section className="mb-8">
            <div className="border border-white/5 bg-zinc-950/50">
              <div className="px-6 py-4 border-b border-white/5">
                <p className="text-[10px] uppercase font-semibold tracking-widest text-orange mb-1">
                  Profile
                </p>
                <h2 className="text-base font-semibold text-white font-geist">
                  Your public profile information
                </h2>
              </div>

              <div className="p-6 space-y-0 divide-y divide-white/5">
                {/* Avatar */}
                <div className="flex flex-col md:flex-row md:items-start gap-6 pb-6">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange to-orange-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden border-2 border-white/10">
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
                    <h3 className="text-sm font-semibold text-white mb-1">Profile Photo</h3>
                    <p className="text-xs text-white/40 mb-4">
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
                        className="px-4 py-2 text-sm font-medium border transition-colors border-white/10 text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Photo
                      </button>
                      {profile?.customAvatarUrl && (
                        <button
                          onClick={handleResetAvatar}
                          disabled={resetAvatar.isPending}
                          className="px-4 py-2 text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div className="flex items-start justify-between py-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded flex items-center justify-center bg-white/5 border border-white/10">
                      <User className="w-4 h-4 text-white/40" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">Display Name</h3>
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Enter display name"
                            maxLength={50}
                            className="px-3 py-1.5 bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-orange/50 w-64"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveName}
                            disabled={updateDisplayName.isPending}
                            className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                          >
                            {updateDisplayName.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={handleCancelEditName}
                            className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-white/50">
                          {profile?.displayName || profile?.name || "Not set"}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isEditingName && (
                    <button
                      onClick={handleStartEditName}
                      className="text-xs font-medium text-orange hover:text-orange/80 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-start justify-between py-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded flex items-center justify-center bg-white/5 border border-white/10">
                      <Mail className="w-4 h-4 text-white/40" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">Email</h3>
                      <p className="text-sm text-white/50">
                        {profile?.email || "Not available"}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-[9px] font-semibold uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
                    Verified
                  </span>
                </div>

                {/* Member Since */}
                <div className="flex items-start gap-4 py-6">
                  <div className="w-10 h-10 rounded flex items-center justify-center bg-white/5 border border-white/10">
                    <Calendar className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Member Since</h3>
                    <p className="text-sm text-white/50">
                      {formatDate(profile?.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section>
            <div className="border border-white/5 bg-zinc-950/50">
              <div className="px-6 py-4 border-b border-white/5">
                <p className="text-[10px] uppercase font-semibold tracking-widest text-orange mb-1">
                  Security
                </p>
                <h2 className="text-base font-semibold text-white font-geist">
                  Manage your account security settings
                </h2>
              </div>

              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded flex items-center justify-center bg-white/5 border border-white/10">
                    <Shield className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Authentication
                    </h3>
                    <p className="text-sm text-white/50 mb-4">
                      Your account is secured with OAuth authentication
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                        Secure
                      </span>
                      <span className="text-xs text-white/40">
                        Last login: {formatDate(new Date())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
