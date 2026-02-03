import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { Link } from "wouter";
import {
  Home,
  Video,
  Film,
  Music,
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
  Grid3X3,
  Layers,
  Palette,
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
      <div className="h-screen w-screen flex items-center justify-center bg-[#0D0C12]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const mainNavItems = [
    { id: "home", label: "Home", icon: Home, color: "text-rose-400", active: true },
    { id: "casting", label: "Casting Studio", icon: Camera, color: "text-pink-400" },
    { id: "wardrobe", label: "Wardrobe Studio", icon: Shirt, color: "text-cyan-400" },
    { id: "photo", label: "Photo Studio", icon: Image, color: "text-emerald-400" },
  ];

  const channelNavItems = [
    { id: "library", label: "Library", icon: Library, color: "text-indigo-400" },
    { id: "history", label: "History", icon: History, color: "text-orange-400" },
    { id: "models", label: "Your Models", icon: Users, color: "text-red-400" },
    { id: "generations", label: "Generations", icon: Layers, color: "text-blue-400" },
    { id: "downloads", label: "Downloads", icon: Download, color: "text-green-400" },
  ];

  const subscriptions = [
    { name: "Casting Pro", color: "bg-indigo-500/20", textColor: "text-indigo-400" },
    { name: "Style Guide", color: "bg-pink-500/20", textColor: "text-pink-400" },
    { name: "Campaign Kit", color: "bg-orange-500/20", textColor: "text-orange-400" },
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
    <div className="h-screen w-screen flex bg-[#0D0C12] text-slate-300 overflow-hidden selection:bg-purple-500/30 selection:text-purple-200">
      {/* Sidebar */}
      <aside className="w-64 h-full flex flex-col flex-shrink-0 border-r border-white/5 bg-[#0D0C12]">
        {/* Window Controls & Logo */}
        <div className="px-6 pt-5 pb-6">
          <div className="flex space-x-2 mb-6 opacity-80">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]"></div>
            <div className="w-3 h-3 rounded-full bg-[#28C840]"></div>
          </div>

          <div className="flex items-center gap-3 group cursor-pointer">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-white tracking-tight">
              FormaStudio
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-6 no-scrollbar">
          {/* Main Section */}
          <nav className="space-y-1">
            {mainNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all ${
                  activeNav === item.id
                    ? `bg-gradient-to-r from-rose-500/10 to-transparent font-medium border-l-2 border-rose-500 text-rose-400`
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-5 h-5 ${activeNav === item.id ? item.color : `group-hover:${item.color}`}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* My Channel Section */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              My Studio
            </h3>
            <nav className="space-y-1">
              {channelNavItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-4 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all group"
                >
                  <item.icon className={`w-[18px] h-[18px] group-hover:${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
              <button className="w-full flex items-center gap-4 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all">
                <ChevronDown className="w-[18px] h-[18px]" />
                <span className="text-sm">Show More</span>
              </button>
            </nav>
          </div>

          {/* Subscriptions List */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Templates
            </h3>
            <nav className="space-y-1">
              {subscriptions.map((sub, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg ${sub.color} flex items-center justify-center ${sub.textColor} ring-1 ring-white/10`}>
                      <Palette className="w-3 h-3" />
                    </div>
                    <span className="text-sm group-hover:translate-x-1 transition-transform">
                      {sub.name}
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-500 truncate">{pointsData?.balance || 0} points</p>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {/* Header with Profile Banner */}
        <div className="relative">
          {/* Banner */}
          <div className="h-48 bg-gradient-to-r from-[#1a1625] via-[#2d1f3d] to-[#1a1625] relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&h=300&fit=crop')] bg-cover bg-center opacity-30"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0C12] to-transparent"></div>
          </div>

          {/* Profile Info */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-4">
            <div className="flex items-end gap-6">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-[#0D0C12] shadow-2xl">
                {user?.name?.charAt(0) || "F"}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">{user?.name || "Creator"}</h1>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-semibold">
                    PRO
                  </span>
                </div>
                <p className="text-slate-400 text-sm">
                  {pointsData?.balance || 0} points • {pointsData?.planTier || "Free"} plan
                </p>
              </div>
              <div className="flex items-center gap-3 pb-2">
                <button className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Get Points
                </button>
                <button className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/5 px-8">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {contentTabs.map((tab, idx) => (
              <button
                key={tab}
                className={`py-4 px-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  idx === 0
                    ? "text-white border-b-2 border-rose-500"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
            <button className="ml-auto py-4 text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 space-y-10">
          {/* VIP Supporters Section */}
          <div className="bg-[#14121D] border border-white/5 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">
                Team Members
              </h2>
              <p className="text-sm text-slate-500">
                Collaborate with your creative team
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-3">
                {teamMembers.map((src, idx) => (
                  <img
                    key={idx}
                    className="w-10 h-10 rounded-full ring-2 ring-[#14121D] object-cover"
                    src={src}
                    alt=""
                  />
                ))}
                <div className="w-10 h-10 rounded-full ring-2 ring-[#14121D] flex items-center justify-center text-xs font-bold text-white z-10 bg-rose-600">
                  +5
                </div>
              </div>
              <button className="px-5 py-2 rounded-lg bg-[#1F1D2B] text-blue-400 text-sm font-semibold hover:bg-[#252333] transition-colors border border-blue-500/20">
                Invite
              </button>
            </div>
          </div>

          {/* Recent Work Section */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Recent Work
              </h2>
              <button className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-white transition-colors">
                <Play className="w-4 h-4" />
                View all
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentWork.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                    <img
                      src={item.thumbnail}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      alt={item.title}
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white tracking-wide">
                      {item.duration}
                    </span>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80">
                        <Clock className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-slate-200 leading-snug group-hover:text-white mb-1.5 line-clamp-2">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{item.views}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-500"></span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                    <button className="text-slate-500 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight mb-6">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/casting-studio">
                <div className="bg-[#14121D] border border-white/5 rounded-2xl p-6 hover:border-rose-500/30 transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-rose-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Create New Model</h3>
                  <p className="text-sm text-slate-500">Design and cast AI models</p>
                </div>
              </Link>
              <Link href="/wardrobe-studio">
                <div className="bg-[#14121D] border border-white/5 rounded-2xl p-6 hover:border-cyan-500/30 transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Shirt className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Style Outfits</h3>
                  <p className="text-sm text-slate-500">Dress your models</p>
                </div>
              </Link>
              <Link href="/photo-studio">
                <div className="bg-[#14121D] border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Image className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Generate Campaign</h3>
                  <p className="text-sm text-slate-500">Create stunning visuals</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
