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
  Plus,
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
      <div className="h-screen w-screen flex items-center justify-center bg-[#151515]">
        <div className="animate-pulse text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const mainNavItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "casting", label: "Casting Studio", icon: Camera },
    { id: "wardrobe", label: "Wardrobe Studio", icon: Shirt },
    { id: "photo", label: "Photo Studio", icon: Image },
  ];

  const channelNavItems = [
    { id: "library", label: "Library", icon: Library },
    { id: "history", label: "History", icon: History },
    { id: "models", label: "Your Models", icon: Users },
    { id: "generations", label: "Generations", icon: Layers },
    { id: "downloads", label: "Downloads", icon: Download },
  ];

  const templates = [
    { name: "Casting Pro", color: "bg-violet-500/15" },
    { name: "Style Guide", color: "bg-sky-500/15" },
    { name: "Campaign Kit", color: "bg-amber-500/15" },
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
    <div className="h-screen w-screen flex bg-[#151515] text-[#e5e5e5] overflow-hidden selection:bg-violet-500/30 selection:text-violet-200 font-sans">
      {/* Sidebar */}
      <aside className="w-72 h-full flex flex-col flex-shrink-0 border-r border-white/[0.06] bg-[#1a1a1a]">
        {/* Logo */}
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-500/20">
              F
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#f0f0f0] tracking-tight">FormaStudio</h1>
              <p className="text-xs text-neutral-500">Creative Suite</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-6" style={{ scrollbarWidth: 'none' }}>
          {/* Main Section */}
          <nav className="space-y-1.5">
            {mainNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeNav === item.id
                    ? "bg-[#252525] text-[#f0f0f0] shadow-sm"
                    : "text-neutral-400 hover:text-[#e5e5e5] hover:bg-[#1f1f1f]"
                }`}
              >
                <item.icon className={`w-5 h-5 ${activeNav === item.id ? "text-violet-400" : ""}`} />
                <span className="font-medium">{item.label}</span>
                {activeNav === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </button>
            ))}
          </nav>

          {/* My Studio Section */}
          <div>
            <h3 className="px-4 text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              My Studio
            </h3>
            <nav className="space-y-1">
              {channelNavItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-neutral-400 hover:text-[#e5e5e5] hover:bg-[#1f1f1f] transition-all"
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-neutral-500 hover:text-neutral-400 transition-all">
                <ChevronDown className="w-[18px] h-[18px]" />
                <span className="text-sm">Show More</span>
              </button>
            </nav>
          </div>

          {/* Templates */}
          <div>
            <h3 className="px-4 text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Templates
            </h3>
            <nav className="space-y-1">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-neutral-400 hover:text-[#e5e5e5] hover:bg-[#1f1f1f] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg ${template.color} flex items-center justify-center`}>
                      <Palette className="w-3.5 h-3.5 text-neutral-300" />
                    </div>
                    <span className="text-sm">{template.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1f1f1f]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-violet-500/20">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#f0f0f0] truncate">{user?.name || "User"}</p>
              <p className="text-xs text-neutral-500 truncate">{pointsData?.balance || 0} credits</p>
            </div>
            <button className="text-neutral-500 hover:text-[#e5e5e5] transition-colors p-1.5 rounded-lg hover:bg-[#252525]">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#151515]" style={{ scrollbarWidth: 'none' }}>
        {/* Header with Profile Banner */}
        <div className="relative">
          {/* Banner */}
          <div className="h-52 relative overflow-hidden bg-gradient-to-br from-[#1e1e2e] via-[#252535] to-[#1e1e2e]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&h=300&fit=crop')] bg-cover bg-center opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent" />
          </div>

          {/* Profile Info */}
          <div className="absolute bottom-0 left-0 right-0 px-10 pb-6">
            <div className="flex items-end gap-6">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-[#151515] shadow-xl shadow-violet-500/20">
                {user?.name?.charAt(0) || "F"}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-[#f0f0f0]">{user?.name || "Creator"}</h1>
                  <span className="px-3 py-1 rounded-full bg-violet-500/15 text-violet-400 text-xs font-medium border border-violet-500/20">
                    PRO
                  </span>
                </div>
                <p className="text-neutral-400 text-sm">
                  {pointsData?.balance || 0} credits • {pointsData?.planTier || "Free"} plan
                </p>
              </div>
              <div className="flex items-center gap-3 pb-2">
                <button className="px-5 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors flex items-center gap-2 shadow-lg shadow-violet-500/25">
                  <Sparkles className="w-4 h-4" />
                  Get Credits
                </button>
                <button className="p-2.5 rounded-xl bg-[#252525] text-neutral-300 hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-xl bg-[#252525] text-neutral-300 hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.06] px-10 bg-[#151515]/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-1" style={{ scrollbarWidth: 'none' }}>
            {contentTabs.map((tab, idx) => (
              <button
                key={tab}
                className={`py-4 px-5 text-sm font-medium transition-all relative ${
                  idx === 0
                    ? "text-[#f0f0f0]"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab}
                {idx === 0 && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-violet-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-10 space-y-12">
          {/* Team Members Section */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#f0f0f0] mb-1">Team Members</h2>
                <p className="text-sm text-neutral-500">Collaborate with your creative team</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex -space-x-3">
                  {teamMembers.map((src, idx) => (
                    <img
                      key={idx}
                      className="w-10 h-10 rounded-full ring-2 ring-[#1a1a1a] object-cover hover:scale-110 transition-transform"
                      src={src}
                      alt=""
                    />
                  ))}
                  <div className="w-10 h-10 rounded-full ring-2 ring-[#1a1a1a] flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-violet-500 to-sky-500">
                    +5
                  </div>
                </div>
                <button className="px-5 py-2.5 rounded-xl border border-white/[0.08] text-neutral-300 text-sm font-medium hover:bg-[#252525] hover:border-white/[0.12] transition-all">
                  Invite
                </button>
              </div>
            </div>
          </div>

          {/* Recent Work Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[#f0f0f0]">Recent Work</h2>
                <p className="text-sm text-neutral-500 mt-1">Your latest creations</p>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-[#e5e5e5] transition-colors group">
                <Play className="w-4 h-4" />
                View all
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentWork.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3 border border-white/[0.06] shadow-sm">
                    <img
                      src={item.thumbnail}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      alt={item.title}
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                    <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-xs text-white font-medium">
                      {item.duration}
                    </span>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm">
                        <Clock className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-neutral-200 leading-snug group-hover:text-[#f0f0f0] mb-1.5 line-clamp-2 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{item.views}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-600" />
                        <span>{item.time}</span>
                      </div>
                    </div>
                    <button className="text-neutral-500 hover:text-[#e5e5e5] transition-colors p-1">
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
              <h2 className="text-xl font-semibold text-[#f0f0f0]">Quick Actions</h2>
              <p className="text-sm text-neutral-500 mt-1">Start creating</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/casting-studio">
                <div className="group rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-6 hover:border-violet-500/30 hover:bg-[#1e1e1e] transition-all cursor-pointer shadow-sm">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-violet-500/20">
                    <Camera className="w-6 h-6 text-violet-400" />
                  </div>
                  <h3 className="text-[#f0f0f0] font-semibold mb-1">Create New Model</h3>
                  <p className="text-sm text-neutral-500">Design and cast AI models</p>
                </div>
              </Link>
              <Link href="/wardrobe-studio">
                <div className="group rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-6 hover:border-sky-500/30 hover:bg-[#1e1e1e] transition-all cursor-pointer shadow-sm">
                  <div className="w-14 h-14 rounded-xl bg-sky-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-sky-500/20">
                    <Shirt className="w-6 h-6 text-sky-400" />
                  </div>
                  <h3 className="text-[#f0f0f0] font-semibold mb-1">Style Outfits</h3>
                  <p className="text-sm text-neutral-500">Dress your models</p>
                </div>
              </Link>
              <Link href="/photo-studio">
                <div className="group rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-6 hover:border-amber-500/30 hover:bg-[#1e1e1e] transition-all cursor-pointer shadow-sm">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-amber-500/20">
                    <Image className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-[#f0f0f0] font-semibold mb-1">Generate Campaign</h3>
                  <p className="text-sm text-neutral-500">Create stunning visuals</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
