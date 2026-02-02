import { ReactNode, useEffect } from "react";
import DashboardSidebar from "./DashboardSidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { ArrowRight } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { loading, user } = useAuth();

  // Apply dark theme when DashboardLayout is mounted
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative">
        {/* Background Grid Lines */}
        <div className="fixed inset-0 grid-lines-dark pointer-events-none z-0" />
        
        <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl">
              <span className="w-8 h-8 rounded flex items-center justify-center text-base text-zinc-900 bg-orange">F</span>
              <span className="font-geist text-white">FORMA</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center text-white font-geist">
              Sign in to continue
            </h1>
            <p className="text-sm text-white/50 text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            className="w-full px-6 py-3 text-sm font-semibold bg-orange text-zinc-900 hover:bg-orange/90 transition-colors flex items-center justify-center gap-2 group"
          >
            <span>Sign in</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-zinc-950 text-white overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
