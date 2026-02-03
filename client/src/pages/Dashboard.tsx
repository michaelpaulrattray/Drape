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
  Edit3,
  Upload,
  X,
  Check,
  Aperture,
} from "lucide-react";
import { useState, useRef } from "react";

export default function Dashboard() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Get points data
  const { data: pointsData } = trpc.points.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="animate-pulse text-neutral-500 font-mono text-sm">// LOADING...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const handleEditProfile = () => {
    setEditedName(user?.name || "");
    setEditedEmail(user?.email || "");
    setIsEditingProfile(true);
  };

  const handleSaveProfile = () => {
    setIsEditingProfile(false);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
  };

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
    <div className="h-screen w-screen flex bg-[#0A0A0A] text-white overflow-hidden selection:bg-orange-500/30 font-sans">
      {/* Abstract Landscape Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.08] grayscale"
          style={{ backgroundImage: 'url(https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/wnAIJHqYRuNunYpg.png)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-[#0A0A0A]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-[#0A0A0A]" />
      </div>
      
      {/* Sidebar - Glass Morphism */}
      <aside className="w-72 h-full flex flex-col flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl relative z-10">
        {/* Logo */}
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center border border-white/10">
              <Aperture className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">FormaStudio</h1>
              <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">// CREATIVE SUITE</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-6" style={{ scrollbarWidth: 'none' }}>
          {/* Home Section */}
          <nav className="space-y-1">
            {homeNavItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  activeNav === item.id
                    ? "bg-white/5 border border-white/10"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="font-mono text-[10px] text-neutral-600">[0{idx + 1}]</span>
                <item.icon className={`w-4 h-4 ${activeNav === item.id ? "text-orange-500" : ""}`} />
                <span className={`text-sm ${activeNav === item.id ? "text-white" : ""}`}>{item.label}</span>
                {activeNav === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </button>
            ))}
          </nav>

          {/* Tools Section */}
          <div>
            <h3 className="px-4 text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-3">
              // TOOLS
            </h3>
            <nav className="space-y-1">
              {toolsNavItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group ${
                    activeNav === item.id
                      ? "bg-white/5 border border-white/10"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="font-mono text-[10px] text-neutral-600">[0{idx + 5}]</span>
                  <item.icon className={`w-4 h-4 ${activeNav === item.id ? "text-orange-500" : ""}`} />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Resources */}
          <div>
            <h3 className="px-4 text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-3">
              // RESOURCES
            </h3>
            <nav className="space-y-1">
              {resources.map((resource, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <resource.icon className="w-4 h-4" />
                    <span className="text-sm">{resource.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center text-white font-mono text-sm border border-white/10">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-neutral-500 font-mono truncate">{pointsData?.balance || 0} CREDITS</p>
            </div>
            <button 
              onClick={() => logout()}
              className="text-neutral-500 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white/5"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10" style={{ scrollbarWidth: 'none' }}>
        {/* Header with Profile Banner */}
        <div className="relative">
          {/* Banner - Glass Morphism Style */}
          <div className="h-56 relative overflow-hidden group">
            {/* Background Image with Blur */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop)',
                filter: 'grayscale(100%) brightness(0.3)'
              }}
            />
            {/* Glass Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-[#0A0A0A] backdrop-blur-sm" />
            
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Top Label */}
            <div className="absolute top-6 left-10 flex items-center gap-4">
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">[01/01] // DASHBOARD</span>
            </div>
            
            {/* Edit Banner Button */}
            <input
              type="file"
              ref={bannerInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => console.log("Banner file:", e.target.files?.[0])}
            />
            <button 
              onClick={() => bannerInputRef.current?.click()}
              className="absolute top-6 right-10 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 hover:bg-white/10 backdrop-blur-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              CHANGE COVER
            </button>
          </div>

          {/* Profile Info - Glass Card */}
          <div className="absolute bottom-0 left-0 right-0 px-10 pb-6">
            <div className="flex items-end gap-6">
              {/* Profile Avatar */}
              <div className="relative group/avatar">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-[#0A0A0A] border border-white/10 relative overflow-hidden">
                  <span className="relative z-10 font-mono">{user?.name?.charAt(0) || "F"}</span>
                </div>
                <input
                  type="file"
                  ref={profilePicInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => console.log("Profile pic file:", e.target.files?.[0])}
                />
                <button 
                  onClick={() => profilePicInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity border border-white/10"
                >
                  <Upload className="w-6 h-6 text-white" />
                </button>
              </div>
              
              <div className="flex-1 pb-2">
                {isEditingProfile ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-lg font-semibold w-full max-w-xs focus:outline-none focus:border-orange-500 backdrop-blur-sm"
                      placeholder="Your name"
                    />
                    <input
                      type="email"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-neutral-400 text-sm w-full max-w-xs focus:outline-none focus:border-orange-500 backdrop-blur-sm"
                      placeholder="Your email"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveProfile}
                        className="px-4 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </button>
                      <button 
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-neutral-300 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-semibold text-white tracking-tight">{user?.name || "Creator"}</h1>
                      <span className="px-2.5 py-1 rounded-none bg-orange-500/20 text-orange-400 text-[10px] font-mono uppercase tracking-wider border border-orange-500/30">
                        PRO
                      </span>
                      <button 
                        onClick={handleEditProfile}
                        className="p-2 rounded-full text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit Profile"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-neutral-500 text-sm font-mono">
                      {pointsData?.balance || 0} credits • {pointsData?.planTier || "free"} plan
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 pb-2">
                <button className="group px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40">
                  <Sparkles className="w-4 h-4" />
                  Get Credits
                </button>
                <button className="p-2.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-10 pt-8 space-y-12">
          {/* Recent Work Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest">[02/03]</span>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">Recent Work</h2>
                </div>
                <p className="text-sm text-neutral-500 font-mono pl-12">// Your latest creations</p>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-orange-400 transition-colors group px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:border-orange-500/30">
                View all
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentWork.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-3 border border-white/10 bg-white/5 backdrop-blur-sm">
                    <img
                      src={item.thumbnail}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0"
                      alt={item.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-2 right-2 px-2 py-1 rounded-none bg-black/70 text-[10px] text-white font-mono backdrop-blur-sm border border-white/10">
                      {item.duration}
                    </span>
                    {/* Hover overlay with orange accent */}
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500/50 rounded-lg transition-colors" />
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-neutral-200 leading-snug group-hover:text-white mb-1.5 line-clamp-2 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-600 font-mono">
                        <span>{item.views}</span>
                        <span className="text-orange-500">•</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions - Glass Cards */}
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest">[03/03]</span>
                <h2 className="text-2xl font-semibold text-white tracking-tight">Quick Actions</h2>
              </div>
              <p className="text-sm text-neutral-500 font-mono pl-12">// Start creating</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/casting-studio">
                <div className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-orange-500/30 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
                  {/* Clip animation inspired accent */}
                  <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-none bg-neutral-800 border border-white/10 flex items-center justify-center mb-4 group-hover:border-orange-500/30 transition-colors">
                    <Camera className="w-6 h-6 text-neutral-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-1 tracking-tight">Create New Model</h3>
                  <p className="text-sm text-neutral-500 font-mono text-[11px]">// Design and cast AI models</p>
                  
                  {/* Arrow indicator */}
                  <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
              <Link href="/wardrobe-studio">
                <div className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-orange-500/30 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-none bg-neutral-800 border border-white/10 flex items-center justify-center mb-4 group-hover:border-orange-500/30 transition-colors">
                    <Shirt className="w-6 h-6 text-neutral-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-1 tracking-tight">Style Outfits</h3>
                  <p className="text-sm text-neutral-500 font-mono text-[11px]">// Dress your models</p>
                  
                  <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
              <Link href="/photo-studio">
                <div className="group rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-orange-500/30 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-14 h-14 rounded-none bg-neutral-800 border border-white/10 flex items-center justify-center mb-4 group-hover:border-orange-500/30 transition-colors">
                    <Image className="w-6 h-6 text-neutral-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-white font-semibold mb-1 tracking-tight">Generate Campaign</h3>
                  <p className="text-sm text-neutral-500 font-mono text-[11px]">// Create stunning visuals</p>
                  
                  <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
