import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Bell,
  Image,
  Shirt,
  Camera,
  ArrowRight,
  Sparkles,
  Zap,
  Clock,
  TrendingUp,
  Plus,
} from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch points balance
  const { data: pointsData } = trpc.points.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse">
          <Sparkles className="w-8 h-8 text-lime" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const studios = [
    {
      id: "casting",
      title: "Casting Studio",
      description: "Create and cast AI models with precise control over demographics and features",
      icon: Image,
      href: "/casting-studio",
      gradient: "from-purple-500/20 to-pink-500/20",
      badge: "New",
    },
    {
      id: "outfit",
      title: "Outfit Studio",
      description: "Dress your AI models in any outfit or style",
      icon: Shirt,
      href: "/outfit-studio",
      gradient: "from-blue-500/20 to-cyan-500/20",
      badge: null,
    },
    {
      id: "photo",
      title: "Photo Studio",
      description: "Generate campaign-ready outputs combining models with products",
      icon: Camera,
      href: "/photo-studio",
      gradient: "from-orange-500/20 to-yellow-500/20",
      badge: null,
    },
  ];

  const recentActivity = [
    { type: "model", name: "Summer Campaign Model", time: "2 hours ago" },
    { type: "outfit", name: "Casual Collection Shoot", time: "Yesterday" },
    { type: "photo", name: "Product Launch Assets", time: "3 days ago" },
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      <DashboardSidebar user={user} pointsBalance={pointsData?.balance || 0} />

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            {/* Search */}
            <div className="flex-1 max-w-xl ml-12 lg:ml-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  type="text"
                  placeholder="Search models, outfits, campaigns..."
                  className="w-full h-10 pl-10 bg-white/5 border-white/10 rounded-full text-sm placeholder:text-white/40 focus:border-lime focus:ring-lime"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3 ml-4">
              <button className="p-2 rounded-full hover:bg-white/5 transition-colors relative">
                <Bell className="w-5 h-5 text-white/60" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-lime rounded-full" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lime/30 to-lime/10 flex items-center justify-center">
                <span className="text-sm font-medium text-lime">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-lime/10 via-lime/5 to-transparent border border-lime/20 p-6 lg:p-8 mb-8">
            <div className="relative z-10">
              <h1 className="text-2xl lg:text-3xl font-instrument mb-2">
                Welcome back, {user?.name?.split(" ")[0] || "Creator"}
              </h1>
              <p className="text-white/60 mb-4 max-w-xl">
                Your AI creative studio is ready. Start casting models, styling outfits, or generating campaign visuals.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setLocation("/casting-studio")}
                  className="btn-lime rounded-full h-10 px-5"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Model
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full h-10 px-5 border-white/10 hover:bg-white/5"
                >
                  View Tutorial
                </Button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime/10 rounded-full blur-3xl" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Points</span>
              </div>
              <p className="text-2xl font-instrument text-lime">{pointsData?.balance?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Image className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Models</span>
              </div>
              <p className="text-2xl font-instrument">0</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Generations</span>
              </div>
              <p className="text-2xl font-instrument">0</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">This Month</span>
              </div>
              <p className="text-2xl font-instrument">0</p>
            </div>
          </div>

          {/* Studios Grid */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-instrument">Studios</h2>
              <button className="text-sm text-white/40 hover:text-white transition-colors">
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studios.map((studio) => (
                <button
                  key={studio.id}
                  onClick={() => setLocation(studio.href)}
                  className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/5 p-6 text-left hover:border-lime/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${studio.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-lime/10 transition-colors">
                        <studio.icon className="w-6 h-6 text-white/60 group-hover:text-lime transition-colors" />
                      </div>
                      {studio.badge && (
                        <span className="text-xs px-2 py-1 rounded-full bg-lime/20 text-lime">
                          {studio.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-instrument mb-2">{studio.title}</h3>
                    <p className="text-sm text-white/50 mb-4">{studio.description}</p>
                    <div className="flex items-center text-sm text-lime opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Open Studio</span>
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-instrument">Recent Activity</h2>
              <button className="text-sm text-white/40 hover:text-white transition-colors">
                View History
              </button>
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                        {activity.type === "model" && <Image className="w-5 h-5 text-purple-400" />}
                        {activity.type === "outfit" && <Shirt className="w-5 h-5 text-blue-400" />}
                        {activity.type === "photo" && <Camera className="w-5 h-5 text-orange-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.name}</p>
                        <p className="text-xs text-white/40">{activity.time}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-white/40 mb-2">No recent activity</p>
                  <p className="text-sm text-white/20">Start creating to see your history here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
