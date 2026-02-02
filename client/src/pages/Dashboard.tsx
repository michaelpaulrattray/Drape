import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Redirect } from "wouter";
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
} from "lucide-react";
import { Link } from "wouter";

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
    return (
      <AppLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
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
        return <Zap className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const studios = [
    {
      title: "Casting Studio",
      description: "Create and cast AI models",
      icon: Image,
      href: "/casting-studio",
      color: "from-purple-500/20 to-pink-500/20",
    },
    {
      title: "Outfit Studio",
      description: "Style your models with outfits",
      icon: Shirt,
      href: "/outfit-studio",
      color: "from-blue-500/20 to-cyan-500/20",
    },
    {
      title: "Photo Studio",
      description: "Generate campaign visuals",
      icon: Camera,
      href: "/photo-studio",
      color: "from-orange-500/20 to-yellow-500/20",
    },
  ];

  return (
    <AppLayout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl font-instrument tracking-tight mb-2">
            Welcome back, <span className="text-muted-foreground">{user?.name?.split(" ")[0] || "Creator"}</span>
          </h1>
          <p className="text-muted-foreground">
            Manage your account and track your creative journey
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
          {/* Points Balance Card */}
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Points Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-instrument">
                  {pointsLoading ? "..." : pointsData?.balance ?? 0}
                </span>
                <span className="text-muted-foreground text-sm">points</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 glass-button hover:bg-white hover:text-zinc-900"
              >
                Get more points
              </Button>
            </CardContent>
          </Card>

          {/* Plan Card */}
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-400" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-instrument capitalize">
                  {pointsLoading ? "..." : pointsData?.planTier ?? "Free"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 glass-button hover:bg-white hover:text-zinc-900"
              >
                Upgrade plan
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-instrument">
                  {transactionsLoading
                    ? "..."
                    : transactions?.filter((t) => t.amount < 0).length ?? 0}
                </span>
                <span className="text-muted-foreground text-sm">generations</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Keep creating amazing content
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Studios Section */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-xl font-instrument mb-4">Your Studios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {studios.map((studio) => (
              <Link key={studio.href} href={studio.href}>
                <Card className="glass-card border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${studio.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <studio.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-instrument text-lg mb-1">{studio.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {studio.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-instrument">Recent Activity</h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View all
            </Button>
          </div>

          <Card className="glass-card border-white/10">
            <CardContent className="p-0">
              {transactionsLoading ? (
                <div className="p-6 text-center text-muted-foreground">
                  Loading transactions...
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full glass-button flex items-center justify-center">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {transaction.description || transaction.type}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                        <p className="text-xs text-muted-foreground">
                          Balance: {transaction.balanceAfter}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Start creating to see your activity here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
