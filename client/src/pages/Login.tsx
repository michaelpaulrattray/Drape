import { getLoginUrl } from "@/const";
import { Button as DSButton } from "@/components/design-system";
import { ArrowRight, AlertCircle, Clock, ShieldOff, MailX, Check, Loader2, Sparkles, KeyRound } from "lucide-react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

// ─── Error configurations ──────────────────────────────────────────────────
const ERROR_MESSAGES = {
  suspended: {
    icon: ShieldOff,
    title: "Account Suspended",
    message: "Your account has been suspended due to a policy violation. Please contact support for assistance.",
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  locked: {
    icon: Clock,
    title: "Account Temporarily Locked",
    message: "Your account has been temporarily locked due to multiple failed login attempts.",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  disposable_email: {
    icon: MailX,
    title: "Email Not Allowed",
    message: "Disposable or temporary email addresses are not permitted. Please sign up with a permanent email address.",
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  not_approved: {
    icon: Clock,
    title: "Waitlist Pending",
    message: "Your account is on the waitlist. We'll notify you when your spot is ready. If you have an access code, enter it below.",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  error: {
    icon: AlertCircle,
    title: "Authentication Error",
    message: "An error occurred during sign in. Please try again.",
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
} as const;

// ─── Brand logos ───────────────────────────────────────────────────────────
const BRAND_LOGOS = [
  { name: "Google", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/KWvxGyeHeOdCWDBA.svg" },
  { name: "Shopify", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/RrYrMQAByeXLDYvF.svg" },
  { name: "Meta", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/IVQzagtquxBRPCYL.svg" },
  { name: "Nike", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/TiXyLFbvFHbHEbTs.svg" },
  { name: "Facebook", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/OeUyRoFtFBfOvhUj.svg" },
  { name: "Instagram", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/mikmpxOOFgYakoyl.svg" },
];

// ─── Sub-components ────────────────────────────────────────────────────────

function ErrorBanner({ errorType, lockMinutes }: { errorType: string; lockMinutes: string | null }) {
  const errorConfig = errorType === "suspended"
    ? ERROR_MESSAGES.suspended
    : errorType === "locked"
      ? ERROR_MESSAGES.locked
      : errorType === "disposable_email"
        ? ERROR_MESSAGES.disposable_email
        : errorType === "not_approved"
          ? ERROR_MESSAGES.not_approved
          : ERROR_MESSAGES.error;

  return (
    <div className={`mb-6 p-4 rounded-2xl border ${errorConfig.bgColor} ${errorConfig.borderColor}`}>
      <div className="flex items-start gap-3">
        <errorConfig.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${errorConfig.iconColor}`} />
        <div>
          <h3 className="font-semibold text-[#0A0A0A] text-sm">{errorConfig.title}</h3>
          <p className="text-sm text-[#757575] mt-1">
            {errorType === "locked" && lockMinutes
              ? `Your account has been temporarily locked due to multiple failed login attempts. Please try again in ${lockMinutes} minute${parseInt(lockMinutes) !== 1 ? "s" : ""}.`
              : errorConfig.message}
          </p>
          {errorType === "suspended" && (
            <a
              href="mailto:support@formastudio.ai"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#0A0A0A] hover:text-[#0A0A0A]/70 mt-2 transition-colors duration-300"
            >
              Contact Support <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ disabled }: { disabled?: boolean }) {
  const fill = disabled ? "#9CA3AF" : undefined;
  return (
    <svg className={`w-5 h-5 mr-3 ${disabled ? "opacity-50" : ""}`} viewBox="0 0 24 24">
      <path fill={fill || "#4285F4"} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill={fill || "#34A853"} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill={fill || "#FBBC05"} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill={fill || "#EA4335"} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon({ disabled }: { disabled?: boolean }) {
  return (
    <svg className={`w-5 h-5 mr-3 ${disabled ? "opacity-50" : ""}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function OAuthButton({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <button
        className="w-full h-12 inline-flex items-center justify-center rounded-full bg-[#EBEBEB]/50 border border-[#D4D4D4] text-[#D4D4D4] cursor-not-allowed text-sm font-medium"
        disabled
      >
        {children}
      </button>
    );
  }
  return (
    <a
      href={href}
      className="group w-full h-12 inline-flex items-center justify-center rounded-full bg-white border border-[#0A0A0A]/10 text-[#0A0A0A] hover:border-[#0A0A0A]/30 transition-all duration-300 text-sm font-medium"
    >
      {children}
    </a>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setAlreadyRegistered(data.alreadyRegistered ?? false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    joinWaitlist.mutate({ email: email.trim(), source: "login_page" });
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0A0A0A]/5 border border-[#0A0A0A]/10">
        <div className="w-8 h-8 rounded-full bg-[#0A0A0A] flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm text-[#0A0A0A] font-medium">
          {alreadyRegistered
            ? "You're already on the list. We'll be in touch soon."
            : "You're on the list. We'll notify you when your spot is ready."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="flex-1 h-12 px-4 rounded-full bg-white border border-[#0A0A0A]/10 text-sm text-[#0A0A0A] placeholder:text-[#757575] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
      />
      <button
        type="submit"
        disabled={joinWaitlist.isPending}
        className="h-12 px-6 rounded-full bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-60 flex items-center gap-2"
      >
        {joinWaitlist.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Join waitlist"
        )}
      </button>
    </form>
  );
}

function AspirationPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center px-12 xl:px-16">
      {/* Aspirational copy */}
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#0A0A0A] flex items-center justify-center mx-auto mb-8">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium tracking-tight text-[#0A0A0A] mb-3">
          Studio-grade AI creation.
        </h2>
        <p className="text-sm text-[#757575] leading-relaxed mb-8">
          Cast models, lock identity, and produce campaign-ready assets — all without writing a single prompt.
        </p>
      </div>

      {/* Divider */}
      <div className="w-16 h-px bg-[#D4D4D4] my-8" />

      {/* Trust line + logos */}
      <p className="text-xs text-[#757575] uppercase tracking-widest mb-6">
        Trusted by top creatives working for
      </p>
      <div className="flex flex-wrap justify-center items-center gap-6 max-w-sm">
        {BRAND_LOGOS.map((brand) => (
          <img
            key={brand.name}
            src={brand.logo}
            alt={brand.name}
            className="h-6 w-auto object-contain opacity-30"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Login() {
  const loginUrl = getLoginUrl();
  const [location, navigate] = useLocation();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [codeRedeemed, setCodeRedeemed] = useState(false);

  const redeemMutation = trpc.access.redeem.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setCodeRedeemed(true);
        // User is now approved — redirect to dashboard after brief delay
        setTimeout(() => navigate("/dashboard"), 1500);
      }
    },
  });

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const errorType = searchParams.get("error");
  const lockMinutes = searchParams.get("minutes");
  const isSuspended = errorType === "suspended";

  // Auto-show sign-in panel if there's an auth error (user was redirected back)
  const hasAuthError = errorType === "suspended" || errorType === "locked" || errorType === "disposable_email" || errorType === "not_approved" || errorType === "error";

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      {/* Navigation */}
      <header className="sticky top-0 z-[100] max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 bg-[#EBEBEB] relative">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png"
              alt="Forma®"
              className="w-[31px] h-[31px]"
            />
          </Link>
          <Link href="/" className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Main Content — Two Column */}
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8 sm:py-12 relative">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-0 items-center">

          {/* ─── Left Column: Waitlist + Sign In ─────────────────────── */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Error Banner */}
            {errorType && <ErrorBanner errorType={errorType} lockMinutes={lockMinutes} />}

            {/* Primary Card: Waitlist */}
            {!hasAuthError && !showSignIn && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A]">
                    Join the waitlist
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium">
                    We're launching soon. Get early access to studio-grade AI model creation.
                  </p>
                </div>

                {/* Inline Waitlist Form */}
                <WaitlistForm />

                {/* What you'll get */}
                <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5">
                  <p className="text-xs text-[#757575] uppercase tracking-widest mb-4 font-medium">
                    Early access includes
                  </p>
                  <div className="space-y-3">
                    {[
                      "Casting Studio — create and lock model identities",
                      "Free credits to start generating immediately",
                      "Priority access to new studios as they launch",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <div className="w-1 h-1 rounded-full bg-[#0A0A0A] mt-2 flex-shrink-0" />
                        <span className="text-sm text-[#0A0A0A]/80">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sign-in toggle */}
                <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => setShowSignIn(true)}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    Already have access? <span className="underline underline-offset-2">Sign in</span>
                  </button>
                </div>
              </div>
            )}

            {/* Secondary Card: Sign In (shown on toggle or auth error) */}
            {(hasAuthError || showSignIn) && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-8">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A]">
                    Sign in
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium">
                    Welcome back to your studio.
                  </p>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <OAuthButton href={loginUrl} disabled={isSuspended}>
                    <GoogleIcon disabled={isSuspended} /> Continue with Google
                  </OAuthButton>
                  <OAuthButton href={loginUrl} disabled={isSuspended}>
                    <AppleIcon disabled={isSuspended} /> Continue with Apple
                  </OAuthButton>
                </div>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0A0A0A]/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-[#757575]">or</span>
                  </div>
                </div>

                {/* Email Login */}
                {isSuspended ? (
                  <button
                    className="w-full h-12 inline-flex items-center justify-center rounded-full bg-[#D4D4D4] text-[#757575] cursor-not-allowed text-sm font-medium"
                    disabled
                  >
                    Continue with Email
                  </button>
                ) : (
                  <DSButton href={loginUrl} variant="primary" size="lg" fullWidth>
                    Continue with Email
                  </DSButton>
                )}

                {/* Access Code Section */}
                <div className="mt-6 pt-6 border-t border-[#0A0A0A]/5">
                  {!showAccessCode ? (
                    <button
                      onClick={() => setShowAccessCode(true)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                    >
                      <KeyRound className="w-4 h-4" />
                      Have an access code?
                    </button>
                  ) : codeRedeemed ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0A0A0A]/5 border border-[#0A0A0A]/10">
                      <div className="w-8 h-8 rounded-full bg-[#0A0A0A] flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0A0A0A]">Access granted!</p>
                        <p className="text-xs text-[#757575]">Redirecting to your dashboard...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 justify-center text-xs text-[#757575] uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" />
                        Enter your access code
                      </div>
                      <p className="text-xs text-[#757575] text-center">
                        Sign in above first, then enter your code to unlock access.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = accessCode.trim();
                          if (!trimmed) return;
                          redeemMutation.mutate({ code: trimmed });
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                          placeholder="FORMA-XXXXX"
                          maxLength={64}
                          disabled={redeemMutation.isPending}
                          className="flex-1 h-11 px-4 rounded-full border border-[#0A0A0A]/10 bg-white text-center font-mono text-sm tracking-wider placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={redeemMutation.isPending || !accessCode.trim()}
                          className="h-11 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-40 flex items-center justify-center"
                        >
                          {redeemMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                        </button>
                      </form>
                      {redeemMutation.isError && (
                        <p className="text-xs text-red-500 text-center">
                          Something went wrong. Please try again.
                        </p>
                      )}
                      {redeemMutation.data && !redeemMutation.data.success && (
                        <p className="text-xs text-red-500 text-center">
                          {redeemMutation.data.error || "Invalid access code."}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Legal */}
                <p className="text-xs text-[#757575] mt-6 leading-relaxed font-medium">
                  By continuing, you agree to our{" "}
                  <a href="#" className="underline underline-offset-2 text-[#0A0A0A] hover:text-[#0A0A0A]/70 transition-colors duration-300">
                    Terms & Conditions
                  </a>
                  {" "}and{" "}
                  <a href="#" className="underline underline-offset-2 text-[#0A0A0A] hover:text-[#0A0A0A]/70 transition-colors duration-300">
                    Privacy Policy
                  </a>.
                </p>

                {/* Back to waitlist toggle */}
                {!hasAuthError && (
                  <div className="mt-6 pt-6 border-t border-[#0A0A0A]/5 text-center">
                    <button
                      onClick={() => setShowSignIn(false)}
                      className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                    >
                      Don't have access? <span className="underline underline-offset-2">Join the waitlist</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Mobile: Back to home ────────────────────────────────── */}
          <div className="lg:hidden text-center mt-2">
            <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300">
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
              Back to home
            </Link>
          </div>

          {/* ─── Right Column: Aspiration Panel ─────────────────────── */}
          <AspirationPanel />
        </div>
      </div>
    </div>
  );
}
