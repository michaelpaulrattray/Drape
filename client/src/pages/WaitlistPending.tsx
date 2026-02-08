import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight, CheckCircle2, Clock, LogOut } from "lucide-react";

const APP_LOGO = import.meta.env.VITE_APP_LOGO;

/**
 * WaitlistPending — interstitial page for authenticated but unapproved users.
 *
 * Shows:
 *   1. Confirmation that they're on the waitlist
 *   2. Access code input field to unlock early access
 *   3. Logout option
 */
export default function WaitlistPending() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [code, setCode] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const redeemMutation = trpc.access.redeem.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setIsSuccess(true);
        toast.success("Access granted! Redirecting to your dashboard...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        toast.error(data.error || "Invalid access code.");
      }
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Please enter an access code.");
      return;
    }
    redeemMutation.mutate({ code: trimmed });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#0A0A0A]/5">
        <a href="/" className="flex items-center gap-2">
          {APP_LOGO && (
            <img src={APP_LOGO} alt="FormaStudio" className="h-6 w-auto" />
          )}
          <span className="font-instrument text-lg tracking-tight text-[#0A0A0A]">
            FormaStudio
          </span>
        </a>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {isSuccess ? (
            /* Success state */
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#0A0A0A] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-instrument text-[#0A0A0A]">
                You're in!
              </h1>
              <p className="text-[#757575] text-sm">
                Redirecting to your dashboard...
              </p>
            </div>
          ) : (
            /* Waitlist state */
            <div className="space-y-8">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F5F5F5] flex items-center justify-center">
                <Clock className="w-7 h-7 text-[#0A0A0A]" />
              </div>

              {/* Heading */}
              <div className="space-y-3">
                <h1 className="text-3xl font-instrument text-[#0A0A0A]">
                  You're on the list
                </h1>
                <p className="text-[#757575] text-sm leading-relaxed max-w-sm mx-auto">
                  {user?.name ? `Thanks, ${user.name}. ` : ""}
                  We're rolling out access in waves. You'll receive an email
                  when your spot is ready.
                </p>
              </div>

              {/* Access code form */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-center text-xs text-[#757575] uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" />
                  Have an access code?
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="FORMA-XXXXX"
                    className="flex-1 h-11 rounded-full border-[#0A0A0A]/10 bg-white text-center font-mono text-sm tracking-wider placeholder:text-[#BFBFBF] focus-visible:ring-[#0A0A0A]/20"
                    maxLength={64}
                    disabled={redeemMutation.isPending}
                  />
                  <Button
                    type="submit"
                    disabled={redeemMutation.isPending || !code.trim()}
                    className="h-11 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90 disabled:opacity-40"
                  >
                    {redeemMutation.isPending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#0A0A0A]/5" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#BFBFBF]">or</span>
                </div>
              </div>

              {/* Back to homepage */}
              <a
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors"
              >
                Return to homepage
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#BFBFBF]">
        &copy; {new Date().getFullYear()} FormaStudio&trade;. All rights reserved.
      </footer>
    </div>
  );
}
