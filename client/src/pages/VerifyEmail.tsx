/**
 * Verify Email Page
 *
 * Shown after email/password registration. Prompts user to check their
 * inbox and provides a resend button (rate-limited to 3/hour).
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mail, RefreshCw, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function VerifyEmail() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (resending || cooldown > 0 || !email) return;
    setResending(true);
    setError("");
    setResent(false);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to resend. Please try again.");
        setResending(false);
        return;
      }

      setResent(true);
      setCooldown(60); // 60 second cooldown between resends
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      {/* Navigation */}
      <header className="sticky top-0 z-[100] max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 bg-[#EBEBEB]">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663296068708/EZPuXPuVfNWAAbrrMBoHnm/drape-logo-tight_067d1d7d.png"
              alt="drape"
              className="h-6 w-auto"
            />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium font-body text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
          >
            ← Back to login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#0A0A0A]/5 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-[#0A0A0A]" />
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                Check your email
              </h1>
              <p className="text-[#757575] text-sm mt-3 font-medium font-body leading-relaxed">
                We sent a verification link to
              </p>
              {email && (
                <p className="text-[#0A0A0A] text-sm font-semibold mt-1 font-body">
                  {email}
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-3 mb-6">
              {[
                "Open the email from Drape",
                "Click the verification link",
                "You'll be signed in automatically",
              ].map((step, i) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0A0A0A]/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-[#0A0A0A]">{i + 1}</span>
                  </div>
                  <span className="text-sm text-[#0A0A0A]/80 font-body">{step}</span>
                </div>
              ))}
            </div>

            {/* Success message */}
            {resent && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">
                  Verification email resent. Check your inbox and spam folder.
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Resend button */}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0 || !email}
              className="w-full h-12 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {resending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend verification email
                </>
              )}
            </button>

            {/* Didn't get email hint */}
            <p className="text-xs text-[#757575] text-center mt-4 leading-relaxed">
              Didn't receive the email? Check your spam folder or try resending.
            </p>

            {/* Divider + sign in link */}
            <div className="mt-6 pt-6 border-t border-[#0A0A0A]/5 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
              >
                Already verified?
                <span className="underline underline-offset-2">Sign in</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Expiry notice */}
          <p className="text-xs text-[#757575] text-center mt-4">
            The verification link expires in 24 hours.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
