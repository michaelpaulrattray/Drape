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
  ArrowRight,
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
        return <Sparkles className="w-4 h-4 text-orange" />;
      case "signup":
        return <Crown className="w-4 h-4 text-purple-400" />;
      case "refund":
        return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
      default:
        return <Zap className="w-4 h-4 text-white/40" />;
    }
  };

  const studios = [
    {
      title: "Casting Studio",
      description: "Create and cast AI models for your campaigns",
      icon: Image,
      href: "/casting-studio",
      status: "Coming Soon",
    },
    {
      title: "Outfit Studio",
      description: "Style your models with virtual outfits",
      icon: Shirt,
      href: "/outfit-studio",
      status: "Coming Soon",
    },
    {
      title: "Photo Studio",
      description: "Generate campaign-ready photoshoots",
      icon: Camera,
      href: "/photo-studio",
      status: "Coming Soon",
    },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen relative">
        {/* Background Grid Lines */}
        <div className="fixed inset-0 grid-lines-dark pointer-events-none z-0" />

        {/* Content */}
        <div className="relative z-10 p-6 md:p-8 lg:p-12 space-y-8">
          {/* Header Section */}
          <section className="border-b border-white/5 pb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-widest mb-2 text-orange">
                  Dashboard
                </p>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-none font-geist text-white">
                  Welcome back
                  <span className="text-orange">.</span>
                </h1>
                <p className="text-sm text-white/50 mt-3 max-w-md">
                  {user?.name?.split(" ")[0] || "Creator"}, ready to create something amazing today?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/settings">
                  <a className="px-5 py-2.5 text-sm font-medium border transition-colors border-white/10 text-white/70 hover:text-white hover:bg-white/5">
                    Edit Profile
                  </a>
                </Link>
                <button className="px-5 py-2.5 text-sm font-semibold bg-orange text-zinc-900 hover:bg-orange/90 transition-colors">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </section>

          {/* Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
            {/* Points Balance */}
            <div className="bg-background p-6 md:p-8">
              <div className="flex items-center gap-2 text-[10px] uppercase font-semibold tracking-widest text-white/40 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-orange" />
                <span>Points Balance</span>
              </div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold tracking-tighter font-geist text-white">
                  {pointsLoading ? "..." : pointsData?.balance ?? 0}
                </span>
                <span className="text-white/40 text-sm font-medium">points</span>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-orange hover:text-orange/80 transition-colors group">
                <span>Get more points</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Current Plan */}
            <div className="bg-background p-6 md:p-8">
              <div className="flex items-center gap-2 text-[10px] uppercase font-semibold tracking-widest text-white/40 mb-4">
                <Crown className="w-3.5 h-3.5 text-purple-400" />
                <span>Current Plan</span>
              </div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold tracking-tighter font-geist text-white capitalize">
                  {pointsLoading ? "..." : pointsData?.planTier ?? "Free"}
                </span>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors group">
                <span>View plans</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* This Month */}
            <div className="bg-background p-6 md:p-8">
              <div className="flex items-center gap-2 text-[10px] uppercase font-semibold tracking-widest text-white/40 mb-4">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span>This Month</span>
              </div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold tracking-tighter font-geist text-white">
                  {transactionsLoading
                    ? "..."
                    : transactions?.filter((t) => t.amount < 0).length ?? 0}
                </span>
                <span className="text-white/40 text-sm font-medium">generations</span>
              </div>
              <p className="text-sm text-white/40">
                Keep creating amazing content
              </p>
            </div>
          </section>

          {/* Studios Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-widest text-orange mb-1">
                  Your Studios
                </p>
                <h2 className="text-xl font-bold tracking-tight font-geist text-white">
                  Start Creating
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
              {studios.map((studio) => (
                <Link key={studio.href} href={studio.href}>
                  <a className="group block bg-background p-6 md:p-8 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 rounded flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-orange/50 transition-colors">
                        <studio.icon className="w-5 h-5 text-white/60 group-hover:text-orange transition-colors" />
                      </div>
                      <span className="px-2 py-1 text-[9px] font-semibold uppercase tracking-widest bg-white/5 text-white/40 border border-white/10">
                        {studio.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange transition-colors font-geist">
                      {studio.title}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed mb-4">
                      {studio.description}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-white/40 group-hover:text-orange transition-colors">
                      <span>Open studio</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-widest text-orange mb-1">
                  Activity
                </p>
                <h2 className="text-xl font-bold tracking-tight font-geist text-white">
                  Recent Transactions
                </h2>
              </div>
              <button className="text-xs font-medium text-white/40 hover:text-white transition-colors">
                View all
              </button>
            </div>

            <div className="border border-border bg-background/50">
              {transactionsLoading ? (
                <div className="p-8 text-center text-white/40">
                  Loading transactions...
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 md:p-5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded flex items-center justify-center bg-white/5 border border-white/10">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {transaction.description || transaction.type}
                          </p>
                          <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {formatDate(transaction.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            transaction.amount > 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {transaction.amount > 0 ? "+" : ""}
                          {transaction.amount}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          Balance: {transaction.balanceAfter}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-4 text-white/20" />
                  <p className="text-white/60 font-medium">No transactions yet</p>
                  <p className="text-sm text-white/40 mt-1">
                    Start creating to see your activity here
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
