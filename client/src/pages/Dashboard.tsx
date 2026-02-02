import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Redirect, Link } from "wouter";
import {
  Sparkles,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Zap,
  Image,
  Shirt,
  Camera,
  ChevronRight,
  Play,
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();

  // Get points data
  const { data: pointsData, isLoading: pointsLoading } = trpc.points.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Get transaction history
  const { data: transactions, isLoading: transactionsLoading } = trpc.points.getTransactions.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated }
  );

  if (loading) {
    return <DashboardLayout><div /></DashboardLayout>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "generation":
        return <ArrowDownRight className="w-4 h-4 text-red-400" />;
      case "purchase":
        return <ArrowUpRight className="w-4 h-4 text-green-400" />;
      case "bonus":
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      case "signup":
        return <Crown className="w-4 h-4 text-purple-400" />;
      case "refund":
        return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
      default:
        return <Zap className="w-4 h-4 text-slate-400" />;
    }
  };

  const studios = [
    {
      title: "Casting Studio",
      description: "Create and cast AI models for your campaigns",
      icon: Image,
      href: "/casting-studio",
      color: "bg-purple-500/20",
      iconColor: "text-purple-400",
      status: "Coming Soon",
    },
    {
      title: "Outfit Studio",
      description: "Style your models with virtual outfits",
      icon: Shirt,
      href: "/outfit-studio",
      color: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
      status: "Coming Soon",
    },
    {
      title: "Photo Studio",
      description: "Generate campaign-ready photoshoots",
      icon: Camera,
      href: "/photo-studio",
      color: "bg-yellow-500/20",
      iconColor: "text-yellow-400",
      status: "Coming Soon",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-8">
        {/* Profile Header */}
        <div className="bg-[#14121D] border border-white/5 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden ring-2 ring-white/10">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || ""} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">
                  Welcome back, {user?.name?.split(" ")[0] || "Creator"}
                </h1>
                <p className="text-slate-400 text-sm">
                  Ready to create something amazing today?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <a className="px-4 py-2 rounded-lg bg-[#1F1D2B] text-slate-300 text-sm font-medium hover:bg-[#252333] transition-colors border border-white/5">
                  Edit Profile
                </a>
              </Link>
              <button className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Points Balance */}
          <div className="bg-[#14121D] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Points Balance</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-white">
                {pointsLoading ? "..." : pointsData?.balance ?? 0}
              </span>
              <span className="text-slate-500 text-sm">points</span>
            </div>
            <button className="mt-4 w-full px-4 py-2 rounded-lg bg-[#1F1D2B] text-orange-400 text-sm font-medium hover:bg-[#252333] transition-colors border border-orange-500/20">
              Get more points
            </button>
          </div>

          {/* Current Plan */}
          <div className="bg-[#14121D] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
              <Crown className="w-4 h-4 text-purple-400" />
              <span>Current Plan</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-white capitalize">
                {pointsLoading ? "..." : pointsData?.planTier ?? "Free"}
              </span>
            </div>
            <button className="mt-4 w-full px-4 py-2 rounded-lg bg-[#1F1D2B] text-purple-400 text-sm font-medium hover:bg-[#252333] transition-colors border border-purple-500/20">
              View plans
            </button>
          </div>

          {/* This Month */}
          <div className="bg-[#14121D] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>This Month</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-white">
                {transactionsLoading
                  ? "..."
                  : transactions?.filter((t) => t.amount < 0).length ?? 0}
              </span>
              <span className="text-slate-500 text-sm">generations</span>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Keep creating amazing content
            </p>
          </div>
        </div>

        {/* Studios Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Studios</h2>
            <button className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-white transition-colors">
              <Play className="w-3 h-3" />
              Quick start
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {studios.map((studio) => (
              <Link key={studio.href} href={studio.href}>
                <a className="group block bg-[#14121D] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${studio.color} flex items-center justify-center ring-1 ring-white/10`}>
                      <studio.icon className={`w-6 h-6 ${studio.iconColor}`} />
                    </div>
                    <span className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-white/5 text-slate-400">
                      {studio.status}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-white mb-1 group-hover:text-orange-400 transition-colors">
                    {studio.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {studio.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                    <span>Open studio</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <button className="text-xs font-medium text-slate-500 hover:text-white transition-colors">
              View all
            </button>
          </div>

          <div className="bg-[#14121D] border border-white/5 rounded-2xl overflow-hidden">
            {transactionsLoading ? (
              <div className="p-6 text-center text-slate-500">
                Loading transactions...
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="divide-y divide-white/5">
                {transactions.slice(0, 5).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1F1D2B] flex items-center justify-center ring-1 ring-white/10">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {transaction.description || transaction.type}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          transaction.amount > 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount}
                      </p>
                      <p className="text-xs text-slate-500">
                        Balance: {transaction.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No transactions yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Start creating to see your activity here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
