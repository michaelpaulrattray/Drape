import { Button as DSButton } from "@/components/design-system";
import { ArrowRight, AlertCircle, Clock, ShieldOff, MailX, Check, Loader2, KeyRound, LogIn, Eye, EyeOff, Mail } from "lucide-react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  invalid_code: {
    icon: AlertCircle,
    title: "Invalid Access Code",
    message: "The access code could not be redeemed. It may have expired or reached its usage limit. Please try a different code.",
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  no_code: {
    icon: KeyRound,
    title: "Access Code Required",
    message: "You need a valid access code to create an account. If you already have an account, use \"I already have an account\" to sign in directly.",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  not_approved: {
    icon: KeyRound,
    title: "Account Not Approved",
    message: "Your account hasn't been approved yet. Please enter a valid access code to activate your account.",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  google_denied: {
    icon: AlertCircle,
    title: "Google Sign-In Cancelled",
    message: "You cancelled the Google sign-in. Please try again when you're ready.",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  google_error: {
    icon: AlertCircle,
    title: "Google Sign-In Failed",
    message: "An error occurred during Google sign-in. Please try again.",
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  rate_limited: {
    icon: Clock,
    title: "Too Many Attempts",
    message: "You've made too many sign-in attempts. Please wait a few minutes and try again.",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
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

// ─── View states ──────────────────────────────────────────────────────────
type LoginView = "choose" | "waitlist" | "new-user-code" | "new-user-signup" | "returning-user";

// ─── Sub-components ────────────────────────────────────────────────────────

function ErrorBanner({ errorType, lockMinutes }: { errorType: string; lockMinutes: string | null }) {
  const key = errorType as keyof typeof ERROR_MESSAGES;
  const errorConfig = ERROR_MESSAGES[key] ?? ERROR_MESSAGES.error;

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
              href="mailto:support@drape.ai"
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
        className="h-12 px-6 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-60 flex items-center gap-2"
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

const LOGIN_HERO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663296068708/EZPuXPuVfNWAAbrrMBoHnm/login-hero_98682e27.webp";

function HeroImagePanel() {
  return (
    <div className="hidden lg:block relative rounded-3xl overflow-hidden min-h-[calc(100vh-120px)]">
      <img
        src={LOGIN_HERO_URL}
        alt="Fashion model in studio"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-4">
        <p className="text-[10px] text-white/60 uppercase tracking-widest">
          Trusted by top creatives working for
        </p>
        <div className="flex items-center gap-5">
          {BRAND_LOGOS.map((brand) => (
            <img
              key={brand.name}
              src={brand.logo}
              alt={brand.name}
              className="h-5 w-auto object-contain brightness-0 invert opacity-50"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Password input with visibility toggle ────────────────────────────────
function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full h-12 px-4 pr-11 rounded-full border border-[#0A0A0A]/10 bg-white text-sm text-[#0A0A0A] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#0A0A0A] transition-colors"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Google OAuth button ──────────────────────────────────────────────────
function GoogleAuthButton({ betaCode, disabled }: { betaCode?: string; disabled?: boolean }) {
  const googleUrl = betaCode
    ? `/api/auth/google?betaCode=${encodeURIComponent(betaCode)}`
    : "/api/auth/google";

  const handleClick = () => {
    markHasAccount();
  };

  if (disabled) {
    return (
      <button
        className="w-full h-12 inline-flex items-center justify-center rounded-full bg-[#EBEBEB]/50 border border-[#D4D4D4] text-[#D4D4D4] cursor-not-allowed text-sm font-medium"
        disabled
      >
        <GoogleIcon disabled /> Continue with Google
      </button>
    );
  }

  return (
    <a
      href={googleUrl}
      onClick={handleClick}
      className="group w-full h-12 inline-flex items-center justify-center rounded-full bg-white border border-[#0A0A0A]/10 text-[#0A0A0A] hover:border-[#0A0A0A]/30 transition-all duration-300 text-sm font-medium font-body"
    >
      <GoogleIcon /> Continue with Google
    </a>
  );
}

// ─── Email/Password Sign Up Form ──────────────────────────────────────────
function EmailSignUpForm({ betaCode }: { betaCode: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          betaCode: betaCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      markHasAccount();

      // Handle email verification redirect
      if (data.needsVerification) {
        window.location.href = `/verify-email?email=${encodeURIComponent(email.trim())}`;
      } else {
        window.location.href = data.redirect || "/dashboard";
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        required
        disabled={loading}
        autoComplete="name"
        className="w-full h-12 px-4 rounded-full border border-[#0A0A0A]/10 bg-white text-sm text-[#0A0A0A] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
        disabled={loading}
        autoComplete="email"
        className="w-full h-12 px-4 rounded-full border border-[#0A0A0A]/10 bg-white text-sm text-[#0A0A0A] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
      />
      <PasswordInput
        value={password}
        onChange={setPassword}
        placeholder="Password (min 8 chars, 1 uppercase, 1 number)"
        disabled={loading}
        autoComplete="new-password"
      />

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || !email.trim() || !password}
        className="w-full h-12 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Create account
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

// ─── Email/Password Sign In Form ──────────────────────────────────────────
function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle special error cases
        if (data.error === "suspended") {
          setError("Your account has been suspended. Please contact support.");
        } else if (data.error === "locked") {
          setError(`Account temporarily locked. Try again in ${data.minutes || 15} minutes.`);
        } else if (data.error === "email_not_verified") {
          // Redirect to verify-email page
          window.location.href = `/verify-email?email=${encodeURIComponent(data.email || email.trim())}`;
          return;
        } else {
          setError(data.error || "Login failed. Please try again.");
        }
        setLoading(false);
        return;
      }

      markHasAccount();
      window.location.href = data.redirect || "/dashboard";
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
        disabled={loading}
        autoComplete="email"
        className="w-full h-12 px-4 rounded-full border border-[#0A0A0A]/10 bg-white text-sm text-[#0A0A0A] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
      />
      <PasswordInput
        value={password}
        onChange={setPassword}
        placeholder="Password"
        disabled={loading}
        autoComplete="current-password"
      />

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        className="w-full h-12 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Sign in
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────
const viewVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
};

// ─── Returning user detection ─────────────────────────────────────────────
const HAS_ACCOUNT_KEY = "drape_has_account";

function getInitialView(errorType: string | null): LoginView {
  if (errorType) return "choose";
  try {
    if (localStorage.getItem(HAS_ACCOUNT_KEY) === "1") return "returning-user";
  } catch { /* localStorage unavailable */ }
  return "choose";
}

function markHasAccount() {
  try { localStorage.setItem(HAS_ACCOUNT_KEY, "1"); } catch { /* noop */ }
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Login() {
  const [location] = useLocation();

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const errorType = searchParams.get("error");
  const lockMinutes = searchParams.get("minutes");
  const isSuspended = errorType === "suspended";

  const [view, setView] = useState<LoginView>(() => getInitialView(errorType));
  const [accessCode, setAccessCode] = useState("");
  const [codeValidated, setCodeValidated] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const validateMutation = trpc.access.validate.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        setCodeValidated(true);
        setView("new-user-signup");
      }
    },
  });

  // Auto-navigate to correct view based on error
  useEffect(() => {
    if (!errorType) return;
    if (errorType === "no_code" || errorType === "invalid_code") {
      setView("new-user-code");
      setCodeValidated(false);
    } else {
      setView("returning-user");
    }
  }, [errorType]);

  const handleValidateCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) return;
    validateMutation.mutate({ code: trimmed });
  };

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      {/* Navigation */}
      <header className="sticky top-0 z-[100] max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 bg-[#EBEBEB] relative">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663296068708/EZPuXPuVfNWAAbrrMBoHnm/drape-logo-tight_067d1d7d.png"
              alt="drape"
              className="h-6 w-auto"
            />
          </Link>
          <Link href="/" className="text-sm font-medium font-body text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Main Content — Two Column */}
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8 sm:py-12 relative">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-8 items-stretch">

          {/* ─── Left Column: Login Card ───────────────────────────────── */}
          <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center">
            {/* Error Banner */}
            {errorType && <ErrorBanner errorType={errorType} lockMinutes={lockMinutes} />}

            <AnimatePresence mode="wait">
            {/* ─── VIEW: Choose (default) ─── */}
            {view === "choose" && (
              <motion.div key="choose" variants={viewVariants} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-8">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                    Welcome to Drape
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium font-body">
                    Choose how to get started.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setView("new-user-code")}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    I have an access code
                  </button>
                  <button
                    onClick={() => setView("returning-user")}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-white border border-[#0A0A0A]/10 text-[#0A0A0A] text-sm font-medium font-body hover:border-[#0A0A0A]/30 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    I already have an account
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => setView("waitlist")}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    Don't have a code? <span className="underline underline-offset-2">Join the waitlist</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── VIEW: Waitlist ─── */}
            {view === "waitlist" && (
              <motion.div key="waitlist" variants={viewVariants} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                    Join the waitlist
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium font-body">
                    We're launching soon. Get early access to studio-grade AI model creation.
                  </p>
                </div>

                <WaitlistForm />

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

                <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => setView("choose")}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    <span className="underline underline-offset-2">← Back</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── VIEW: New user — enter access code ─── */}
            {view === "new-user-code" && (
              <motion.div key="new-user-code" variants={viewVariants} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-8">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                    Enter access code
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium font-body">
                    A valid beta key is required to create your account.
                  </p>
                </div>

                <form onSubmit={handleValidateCode} className="space-y-4">
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#757575]" />
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="DRAPE-XXXXX"
                      maxLength={64}
                      disabled={validateMutation.isPending}
                      autoFocus
                      className="w-full h-12 pl-11 pr-4 rounded-full border border-[#0A0A0A]/10 bg-white font-mono text-sm tracking-wider placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#0A0A0A]/30 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={validateMutation.isPending || !accessCode.trim()}
                    className="w-full h-12 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {validateMutation.isError && (
                  <p className="text-xs text-red-500 text-center mt-3">
                    Something went wrong. Please try again.
                  </p>
                )}
                {validateMutation.data && !validateMutation.data.valid && (
                  <p className="text-xs text-red-500 text-center mt-3">
                    {validateMutation.data.error || "Invalid access code."}
                  </p>
                )}

                <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => { setView("choose"); setAccessCode(""); validateMutation.reset(); }}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    <span className="underline underline-offset-2">← Back</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── VIEW: New user — code validated, create account ─── */}
            {view === "new-user-signup" && codeValidated && (
              <motion.div key="new-user-signup" variants={viewVariants} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                {/* Code validated badge */}
                <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-emerald-800">
                    Code verified: <span className="font-mono">{accessCode.trim().toUpperCase()}</span>
                  </span>
                </div>

                <div className="mb-4">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                    Create your account
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium font-body">
                    Choose how you'd like to sign up.
                  </p>
                </div>

                {!showEmailForm ? (
                  <>
                    <div className="space-y-3">
                      <GoogleAuthButton betaCode={accessCode.trim().toUpperCase()} disabled={isSuspended} />
                    </div>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#0A0A0A]/10" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-3 text-[#757575]">or</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowEmailForm(true)}
                      className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Continue with Email
                    </button>
                  </>
                ) : (
                  <>
                    <EmailSignUpForm betaCode={accessCode.trim().toUpperCase()} />

                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowEmailForm(false)}
                        className="text-xs text-[#757575] hover:text-[#0A0A0A] transition-colors"
                      >
                        ← Back to sign up options
                      </button>
                    </div>
                  </>
                )}

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

                {/* Use a different code */}
                <div className="mt-6 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => {
                      setCodeValidated(false);
                      setAccessCode("");
                      setShowEmailForm(false);
                      setView("new-user-code");
                    }}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    Use a different code
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── VIEW: Returning user — sign in ─── */}
            {view === "returning-user" && (
              <motion.div key="returning-user" variants={viewVariants} initial="initial" animate="animate" exit="exit" className="bg-white rounded-2xl p-6 sm:p-8 md:p-10 border border-[#0A0A0A]/5">
                <div className="mb-4">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0A0A0A] font-geist">
                    Welcome back
                  </h1>
                  <p className="text-[#757575] text-sm mt-2 font-medium font-body">
                    Sign in to your existing account.
                  </p>
                </div>

                {!showEmailForm ? (
                  <>
                    <div className="space-y-3">
                      <GoogleAuthButton disabled={isSuspended} />
                    </div>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#0A0A0A]/10" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-3 text-[#757575]">or</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowEmailForm(true)}
                      className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] text-white text-sm font-medium font-body hover:bg-[#0A0A0A]/90 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Sign in with Email
                    </button>
                  </>
                ) : (
                  <>
                    <EmailSignInForm />

                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowEmailForm(false)}
                        className="text-xs text-[#757575] hover:text-[#0A0A0A] transition-colors"
                      >
                        ← Back to sign in options
                      </button>
                    </div>
                  </>
                )}

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

                {/* Back to choose */}
                <div className="mt-6 pt-6 border-t border-[#0A0A0A]/5 text-center">
                  <button
                    onClick={() => { setView("choose"); setShowEmailForm(false); }}
                    className="text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300"
                  >
                    <span className="underline underline-offset-2">← Back</span>
                  </button>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* ─── Mobile: Back to home ────────────────────────────────── */}
          <div className="lg:hidden text-center mt-2">
            <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300">
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
              Back to home
            </Link>
          </div>

          {/* ─── Right Column: Hero Image ──────────────────────────── */}
          <HeroImagePanel />
        </div>
      </div>
    </div>
  );
}
