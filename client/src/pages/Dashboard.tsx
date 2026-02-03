import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { Link } from "wouter";
import {
  Home,
  Library,
  History,
  Clock,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Settings,
  Play,
  MoreHorizontal,
  Menu,
  Camera,
  Shirt,
  Image,
  Sparkles,
  Users,
  Layers,
  Palette,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeNav, setActiveNav] = useState("home");

  // Get points data
  const { data: pointsData } = trpc.points.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#030303]">
        <div className="animate-pulse text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const mainNavItems = [
    { id: "home", label: "Home", icon: Home, gradient: "from-emerald-400 to-cyan-400" },
    { id: "casting", label: "Casting Studio", icon: Camera, gradient: "from-pink-400 to-rose-400" },
    { id: "wardrobe", label: "Wardrobe Studio", icon: Shirt, gradient: "from-cyan-400 to-blue-400" },
    { id: "photo", label: "Photo Studio", icon: Image, gradient: "from-amber-400 to-orange-400" },
  ];

  const channelNavItems = [
    { id: "library", label: "Library", icon: Library },
    { id: "history", label: "History", icon: History },
    { id: "models", label: "Your Models", icon: Users },
    { id: "generations", label: "Generations", icon: Layers },
    { id: "downloads", label: "Downloads", icon: Download },
  ];

  const templates = [
    { name: "Casting Pro", gradient: "from-indigo-500 to-purple-500" },
    { name: "Style Guide", gradient: "from-pink-500 to-rose-500" },
    { name: "Campaign Kit", gradient: "from-orange-500 to-amber-500" },
  ];

  const contentTabs = ["All", "Models", "Outfits", "Campaigns", "Exports"];

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

  const teamMembers = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
  ];

  return (
    <div className="h-screen w-screen flex bg-[#030303] text-neutral-300 overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Grid Pattern */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 80%)',
        }}
      />

      {/* Sidebar */}
      <aside className="w-64 h-full flex flex-col flex-shrink-0 border-r border-white/[0.05] bg-[#030303]/80 backdrop-blur-xl z-10 relative">
        {/* Logo */}
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-black font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              F
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">FormaStudio</h1>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Creative Suite</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 space-y-8 pb-6" style={{ scrollbarWidth: 'none' }}>
          {/* Main Section */}
          <nav className="space-y-1">
            {mainNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  activeNav === item.id
                    ? "bg-white/[0.03] border border-white/[0.05]"
                    : "hover:bg-white/[0.02] border border-transparent"
                }`}
              >
                {activeNav === item.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  activeNav === item.id 
                    ? `bg-gradient-to-br ${item.gradient} text-black shadow-lg` 
                    : "bg-white/[0.03] text-neutral-400 group-hover:bg-white/[0.05]"
                }`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className={`text-sm font-medium ${activeNav === item.id ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* My Studio Section */}
          <div>
            <h3 className="px-4 text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-3">
              // MY STUDIO
            </h3>
            <nav className="space-y-0.5">
              {channelNavItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.02] transition-all group"
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-600 hover:text-neutral-400 transition-all">
                <ChevronDown className="w-4 h-4" />
                <span className="text-sm">Show More</span>
              </button>
            </nav>
          </div>

          {/* Templates */}
          <div>
            <h3 className="px-4 text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-3">
              // TEMPLATES
            </h3>
            <nav className="space-y-1">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${template.gradient} opacity-80`} />
                    <span className="text-sm group-hover:translate-x-0.5 transition-transform">{template.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-neutral-700 group-hover:text-neutral-500" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/[0.05]">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.03]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-black font-semibold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
              <p className="text-[10px] font-mono text-emerald-500 truncate">{pointsData?.balance || 0} credits</p>
            </div>
            <button className="text-neutral-600 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10" style={{ scrollbarWidth: 'none' }}>
        {/* Header with Profile Banner */}
        <div className="relative">
          {/* Banner */}
          <div className="h-56 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-[#030303] to-cyan-900/20" />
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            />
            {/* Animated scan line */}
            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent" />
          </div>

          {/* Profile Info */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-6">
            <div className="flex items-end gap-6">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-black text-4xl font-bold ring-4 ring-[#030303] shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                {user?.name?.charAt(0) || "F"}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-semibold text-white tracking-tight">{user?.name || "Creator"}</h1>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono uppercase tracking-wider">
                    Pro
                  </span>
                </div>
                <p className="text-neutral-500 text-sm font-mono">
                  {pointsData?.balance || 0} credits • {pointsData?.planTier || "Free"} plan
                </p>
              </div>
              <div className="flex items-center gap-3 pb-2">
                <button className="group relative px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold tracking-tight overflow-hidden hover:bg-neutral-100 transition-colors flex items-center gap-2 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]">
                  <Sparkles className="w-4 h-4" />
                  Get Credits
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button className="p-2.5 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.05] px-8 bg-[#030303]/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {contentTabs.map((tab, idx) => (
              <button
                key={tab}
                className={`py-4 px-5 text-sm font-medium transition-all whitespace-nowrap relative ${
                  idx === 0
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab}
                {idx === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 space-y-12">
          {/* Team Members Section */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm p-6">
            {/* Shine effect */}
            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000" />
            
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1 tracking-tight">
                  Team Members
                </h2>
                <p className="text-sm text-neutral-500 font-mono">
                  // Collaborate with your creative team
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex -space-x-3">
                  {teamMembers.map((src, idx) => (
                    <img
                      key={idx}
                      className="w-10 h-10 rounded-full ring-2 ring-[#030303] object-cover grayscale hover:grayscale-0 transition-all"
                      src={src}
                      alt=""
                    />
                  ))}
                  <div className="w-10 h-10 rounded-full ring-2 ring-[#030303] flex items-center justify-center text-xs font-bold text-white z-10 bg-gradient-to-br from-emerald-500 to-cyan-500">
                    +5
                  </div>
                </div>
                <button className="px-5 py-2.5 rounded-lg border border-white/10 text-neutral-300 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all">
                  Invite
                </button>
              </div>
            </div>
          </div>

          {/* Recent Work Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Recent Work
                </h2>
                <p className="text-sm text-neutral-600 font-mono mt-1">// Your latest creations</p>
              </div>
              <button className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors group">
                <Play className="w-4 h-4" />
                View all
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentWork.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3 border border-white/[0.05]">
                    <img
                      src={item.thumbnail}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 grayscale group-hover:grayscale-0"
                      alt={item.title}
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
                    <span className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-[10px] font-mono text-white tracking-wide border border-white/10">
                      {item.duration}
                    </span>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 border border-white/10">
                        <Clock className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-neutral-300 leading-snug group-hover:text-white mb-1.5 line-clamp-2 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-600 font-mono">
                        <span>{item.views}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span>{item.time}</span>
                      </div>
                    </div>
                    <button className="text-neutral-600 hover:text-white transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                Quick Actions
              </h2>
              <p className="text-sm text-neutral-600 font-mono mt-1">// Start creating</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/casting-studio">
                <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 hover:border-emerald-500/30 transition-all cursor-pointer">
                  {/* Hover shine effect */}
                  <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-emerald-500/20">
                      <Camera className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-1 tracking-tight">Create New Model</h3>
                    <p className="text-sm text-neutral-500 font-mono">// Design and cast AI models</p>
                  </div>
                </div>
              </Link>
              <Link href="/wardrobe-studio">
                <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 hover:border-cyan-500/30 transition-all cursor-pointer">
                  <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-400/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-cyan-500/20">
                      <Shirt className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-1 tracking-tight">Style Outfits</h3>
                    <p className="text-sm text-neutral-500 font-mono">// Dress your models</p>
                  </div>
                </div>
              </Link>
              <Link href="/photo-studio">
                <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 hover:border-amber-500/30 transition-all cursor-pointer">
                  <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000" />
                  
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-amber-500/20">
                      <Image className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-1 tracking-tight">Generate Campaign</h3>
                    <p className="text-sm text-neutral-500 font-mono">// Create stunning visuals</p>
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
