import { useRef, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { compressImage, AVATAR_COMPRESSION, BANNER_COMPRESSION } from "@/lib/imageUtils";
import {
  Upload,
  Check,
  HardDrive,
} from "lucide-react";

interface ProfileTabProps {
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
  profileImage: string | null;
  bannerImage: string | null;
  onProfileImageChange: (url: string) => void;
  onBannerImageChange: (url: string) => void;
  defaultAvatar: string;
  defaultBanner: string;
  onProfileUpdate?: () => void;
  isOpen: boolean;
}

export function ProfileTab({
  user,
  profileImage,
  bannerImage,
  onProfileImageChange,
  onBannerImageChange,
  defaultAvatar,
  defaultBanner,
  onProfileUpdate,
  isOpen,
}: ProfileTabProps) {
  const [editedName, setEditedName] = useState(user?.name || "");
  const [editedBio, setEditedBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
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
      setLocalAvatarPreview(null);
      refetchProfile();
      onProfileUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message);
      setLocalAvatarPreview(null);
    },
  });

  const uploadBannerMutation = trpc.profile.uploadBanner.useMutation({
    onSuccess: (data) => {
      onBannerImageChange(data.bannerUrl);
      setLocalBannerPreview(null);
      refetchProfile();
      onProfileUpdate?.();
    },
    onError: (err) => {
      toast.error(err.message);
      setLocalBannerPreview(null);
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

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar file size must be under 5MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Avatar must be a JPG, PNG, or WebP image");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalAvatarPreview(previewUrl);
    setIsUploadingAvatar(true);

    try {
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

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Banner file size must be under 10MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Banner must be a JPG, PNG, or WebP image");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalBannerPreview(previewUrl);
    setIsUploadingBanner(true);

    try {
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

  return (
    <div className="space-y-6">
      {/* Banner Upload */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Cover Image
        </label>
        <div className="relative h-32 rounded-xl overflow-hidden border border-gray-200 group">
          <img
            src={localBannerPreview || bannerImage || profileData?.bannerUrl || defaultBanner}
            alt="Cover"
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(50%) brightness(0.8)' }}
          />
          {isUploadingBanner && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                <span className="text-sm text-[#0A0A0A]">Uploading...</span>
              </div>
            </div>
          )}
          {!isUploadingBanner && (
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="px-4 py-2 rounded-md bg-white/90 border border-gray-200 text-[#0A0A0A] text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
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
        <p className="text-xs text-[#757575] mt-2">JPG, PNG or WebP. Max 10MB.</p>
      </div>

      {/* Avatar Upload */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
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
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                </div>
              )}
            </div>
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
            <p className="text-sm text-[#4D4D4D]">Upload a new profile picture</p>
            <p className="text-xs text-[#757575]">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          maxLength={100}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#0A0A0A] text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/20 transition-all"
          placeholder="Your display name"
        />
        <p className="text-xs text-[#757575] mt-1.5">{editedName.length}/100 characters</p>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-2">
          Bio
        </label>
        <textarea
          value={editedBio}
          onChange={(e) => setEditedBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[#0A0A0A] text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/20 transition-all resize-none"
          placeholder="Tell us about yourself..."
        />
        <p className="text-xs text-[#757575] mt-1.5">{editedBio.length}/500 characters</p>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={profileData?.email || user?.email || ""}
          readOnly
          className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[#757575] text-sm cursor-not-allowed"
        />
        <p className="text-xs text-[#757575] mt-1.5">Email cannot be changed</p>
      </div>

      {/* Storage Usage */}
      {storageInfo && (
        <div>
          <label className="block text-sm font-medium text-[#4D4D4D] mb-2">
            Storage Usage
          </label>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#757575]" />
                <span className="text-sm text-[#0A0A0A]">
                  {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.limit)}
                </span>
              </div>
              <span className="text-xs text-[#757575]">{storageInfo.percentage}% used</span>
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
          className="px-6 py-3 rounded-xl bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90 text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
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
  );
}
