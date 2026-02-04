import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { Link } from "wouter";
import {
  Home,
  ChevronRight,
  Search,
  Bell,
  Camera,
  Shirt,
  Image,
  Sparkles,
  Users,
  Layers,
  ArrowRight,
  LogOut,
  CreditCard,
  GraduationCap,
  Scale,
  Gift,
  Upload,
  Settings,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import { BillingModal } from "@/components/BillingModal";
import { CreditTopupModal } from "@/components/CreditTopupModal";
import { LowBalanceBanner, LOW_BALANCE_THRESHOLD } from "@/components/LowBalanceWarning";
import { Loader2, Coins } from "lucide-react";

// Image compression utility
async function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<{ base64: string; mimeType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64
      const mimeType = 'image/jpeg'; // Always compress to JPEG for smaller size
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(',')[1];
      const size = Math.ceil((base64.length * 3) / 4); // Approximate byte size
      
      resolve({ base64, mimeType, size });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Dashboard() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Default images for users - use empty string to avoid flash of stock photos
  const DEFAULT_BANNER = "";
  const DEFAULT_AVATAR = "";

  // Get credits data
  const { data: creditsData } = trpc.credits.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Get profile data from backend
  const { data: profileData, refetch: refetchProfile, isLoading: profileLoading } = trpc.profile.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Upload mutations for direct dashboard edits
  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => refetchProfile(),
  });
  const uploadBannerMutation = trpc.profile.uploadBanner.useMutation({
    onSuccess: () => refetchProfile(),
  });

  // Get the display name (prefer displayName from profile, fallback to user.name)
  const displayName = profileData?.displayName || profileData?.name || user?.name || "User";

  // Sync profile images from backend on load - always update when profileData changes
  useEffect(() => {
    if (profileData) {
      // Always sync from backend to ensure persistence
      setProfileImage(profileData.avatarUrl || null);
      setBannerImage(profileData.bannerUrl || null);
    }
  }, [profileData]);

  if (loading || profileLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Home section items
  const homeNavItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "models", label: "Your Models", icon: Users },
    { id: "generations", label: "Generations", icon: Layers },
    { id: "billing", label: "Billing & Usage", icon: CreditCard },
  ];

  // Tools section items (Studios)
  const toolsNavItems = [
    { id: "casting", label: "Casting Studio", icon: Camera },
    { id: "wardrobe", label: "Wardrobe Studio", icon: Shirt },
    { id: "photo", label: "Photo Studio", icon: Image },
  ];

  // Resources
  const resources = [
    { name: "Learn Casting", icon: GraduationCap },
    { name: "Learn Wardrobe", icon: GraduationCap },
    { name: "Learn Campaign", icon: GraduationCap },
    { name: "Affiliate Program", icon: Gift },
    { name: "Legal & Copyright", icon: Scale },
  ];

  const recentWork = [
    {
      title: "Summer Collection Campaign",
      views: "125k views",
      time: "3 days ago",
      duration: "42:15",
      thumbnail: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=225&fit=crop",
    },
    {
      title: "Product Showcase Series",
      views: "45k views",
      time: "1 week ago",
      duration: "28:50",
      thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=225&fit=crop",
    },
    {
      title: "Brand Identity Shoot",
      views: "89k views",
      time: "2 weeks ago",
      duration: "15:30",
      thumbnail: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=225&fit=crop",
    },
    {
      title: "Editorial Fashion Series",
      views: "67k views",
      time: "3 weeks ago",
      duration: "33:45",
      thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=225&fit=crop",
    },
  ];

  return (
    <div className="h-screen w-screen flex bg-zinc-950 text-white overflow-hidden selection:bg-orange-500/30">
      {/* Subtle Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>
      
      {/* Sidebar - Editorial Dark */}
      <aside className="w-72 h-full flex flex-col flex-shrink-0 border-r border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm relative z-10">
        {/* Logo */}
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
                alt="Forma Studio" 
                className="w-5 h-5 invert opacity-90"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">FormaStudio</h1>
              <p className="text-xs text-zinc-500">Creative Suite</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-6" style={{ scrollbarWidth: 'none' }}>
          {/* Home Section */}
          <nav className="space-y-1">
            {homeNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeNav === item.id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${activeNav === item.id ? "text-orange-500" : ""}`} />
                <span className="text-sm font-medium">{item.label}</span>
                {activeNav === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </nav>

          {/* Tools Section */}
          <div>
            <h3 className="px-4 text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
              Studios
            </h3>
            <nav className="space-y-1">
              {toolsNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                    activeNav === item.id
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                  }`}
                >
                  <item.icon className={`w-[18px] h-[18px] ${activeNav === item.id ? "text-orange-500" : ""}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Resources */}
          <div>
            <h3 className="px-4 text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">
              Resources
            </h3>
            <nav className="space-y-1">
              {resources.map((resource, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <resource.icon className="w-[18px] h-[18px]" />
                    <span className="text-sm">{resource.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
            <div className="w-10 h-10 rounded-full border border-zinc-700 overflow-hidden bg-zinc-800">
              {profileImage ? (
                <img 
                  src={profileImage}
                  alt={user?.name || "Profile"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
                  <span className="text-sm font-semibold text-zinc-500">
                    {(displayName || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">{creditsData?.balance || 0} credits</p>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-zinc-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={() => logout()}
              className="text-zinc-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-zinc-800"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'thin' }}>
        {/* Header with Profile Banner */}
        <div className="relative">
          {/* Banner - Simplified */}
          <div className="h-56 relative overflow-hidden group">
            {/* Background Image */}
            <div 
              className={`absolute inset-0 bg-cover bg-center ${!bannerImage ? 'bg-gradient-to-br from-zinc-800 to-zinc-900' : ''}`}
              style={{ 
                backgroundImage: bannerImage ? `url(${bannerImage})` : 'none',
                filter: bannerImage ? 'grayscale(80%) brightness(0.35)' : 'none'
              }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-zinc-950" />
            
            {/* Edit Banner Button */}
            <input
              type="file"
              ref={bannerInputRef}
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Show preview immediately
                  const url = URL.createObjectURL(file);
                  setBannerImage(url);
                  setIsUploadingBanner(true);
                  
                  try {
                    // Compress image before upload (max 1920x600 for banner)
                    const compressed = await compressImage(file, 1920, 600, 0.85);
                    
                    await uploadBannerMutation.mutateAsync({
                      base64Data: compressed.base64,
                      mimeType: compressed.mimeType as "image/jpeg" | "image/png" | "image/webp",
                      fileSize: compressed.size,
                    });
                  } catch (error) {
                    console.error('Failed to upload banner:', error);
                    // Revert to previous image on error
                    refetchProfile();
                  } finally {
                    setIsUploadingBanner(false);
                  }
                }
              }}
            />
            {/* Upload progress overlay */}
            {isUploadingBanner && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/90 border border-zinc-700">
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  <span className="text-sm text-white">Uploading...</span>
                </div>
              </div>
            )}
            <button 
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="absolute top-6 right-10 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 hover:bg-white/20 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              Change Cover
            </button>
          </div>

          {/* Profile Info */}
          <div className="absolute bottom-0 left-0 right-0 px-10 pb-6">
            <div className="flex items-end gap-6">
              {/* Profile Avatar */}
              <div className="relative group/avatar">
                <div className="w-28 h-28 rounded-2xl ring-4 ring-zinc-950 border border-zinc-800 relative overflow-hidden shadow-2xl bg-zinc-800">
                  {profileImage ? (
                    <img 
                      src={profileImage}
                      alt={user?.name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
                      <span className="text-3xl font-semibold text-zinc-500">
                        {(displayName || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Upload progress overlay */}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={profilePicInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Show preview immediately
                      const url = URL.createObjectURL(file);
                      setProfileImage(url);
                      setIsUploadingAvatar(true);
                      
                      try {
                        // Compress image before upload (max 400x400 for avatar)
                        const compressed = await compressImage(file, 400, 400, 0.85);
                        
                        await uploadAvatarMutation.mutateAsync({
                          base64Data: compressed.base64,
                          mimeType: compressed.mimeType as "image/jpeg" | "image/png" | "image/webp",
                          fileSize: compressed.size,
                        });
                      } catch (error) {
                        console.error('Failed to upload avatar:', error);
                        // Revert to previous image on error
                        refetchProfile();
                      } finally {
                        setIsUploadingAvatar(false);
                      }
                    }
                  }}
                />
                <button 
                  onClick={() => profilePicInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity border border-zinc-700 disabled:opacity-100"
                >
                  {!isUploadingAvatar && <Upload className="w-6 h-6 text-white" />}
                </button>
              </div>
              
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-semibold text-white tracking-tight">{displayName}</h1>
                  <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium border border-orange-500/20">
                    PRO
                  </span>
                </div>
                <p className="text-zinc-400 text-sm">
                  {creditsData?.balance || 0} credits · {creditsData?.planTier || "free"} plan
                </p>
              </div>
              <div className="flex items-center gap-3 pb-2">
                <button className="group px-5 py-2.5 rounded-full bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 transition-all flex items-center gap-2 shadow-lg">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Get Credits
                </button>
                <button className="p-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-10 pt-8 space-y-12">
          {/* Low Balance Warning */}
          {creditsData && creditsData.balance < LOW_BALANCE_THRESHOLD && (
            <LowBalanceBanner
              balance={creditsData.balance}
              onTopUp={() => setIsTopupOpen(true)}
            />
          )}

          {/* Recent Work Section */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">Recent Work</h2>
                <p className="text-sm text-zinc-500">Your latest creations</p>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-zinc-900 hover:text-black transition-colors group px-5 py-2.5 rounded-full bg-white hover:bg-zinc-100">
                View all
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentWork.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-zinc-800 bg-zinc-900">
                    <img
                      src={item.thumbnail}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      alt={item.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 text-xs text-white font-medium backdrop-blur-sm">
                      {item.duration}
                    </span>
                    {/* Hover border */}
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500/40 rounded-xl transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200 leading-snug group-hover:text-white mb-2 line-clamp-2 transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{item.views}</span>
                      <span className="text-orange-500">·</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">Quick Actions</h2>
              <p className="text-sm text-zinc-500">Start creating</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/casting-studio">
                <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer relative overflow-hidden">
                  {/* Subtle hover accent */}
                  <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-5 group-hover:border-orange-500/30 transition-colors">
                    <Camera className="w-6 h-6 text-zinc-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-2 tracking-tight text-lg">Create New Model</h3>
                  <p className="text-sm text-zinc-500">Design and cast AI models for your campaigns</p>
                  
                  {/* Arrow indicator */}
                  <div className="absolute bottom-6 right-6 w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:border-orange-500/30">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
              <Link href="/wardrobe-studio">
                <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-5 group-hover:border-orange-500/30 transition-colors">
                    <Shirt className="w-6 h-6 text-zinc-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-2 tracking-tight text-lg">Style Outfits</h3>
                  <p className="text-sm text-zinc-500">Dress your models with curated fashion</p>
                  
                  <div className="absolute bottom-6 right-6 w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:border-orange-500/30">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
              <Link href="/photo-studio">
                <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-5 group-hover:border-orange-500/30 transition-colors">
                    <Image className="w-6 h-6 text-zinc-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-2 tracking-tight text-lg">Generate Campaign</h3>
                  <p className="text-sm text-zinc-500">Create stunning campaign visuals</p>
                  
                  <div className="absolute bottom-6 right-6 w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:border-orange-500/30">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdate={() => refetchProfile()}
        user={user}
        profileImage={profileImage}
        bannerImage={bannerImage}
        onProfileImageChange={setProfileImage}
        onBannerImageChange={setBannerImage}
        creditsBalance={creditsData?.balance || 0}
        planTier={creditsData?.planTier || "free"}
        defaultAvatar={DEFAULT_AVATAR}
        defaultBanner={DEFAULT_BANNER}
        onOpenBilling={() => setIsBillingOpen(true)}
        onOpenTopup={() => setIsTopupOpen(true)}
      />

      {/* Billing Modal */}
      <BillingModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
      />

      {/* Credit Top-up Modal */}
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
