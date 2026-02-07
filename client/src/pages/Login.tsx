import { getLoginUrl } from "@/const";
import { Button as DSButton, ConveyorTextColor } from "@/components/design-system";
import { ArrowRight, AlertCircle, Clock, ShieldOff } from "lucide-react";
import { useLocation, Link } from "wouter";

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
  error: {
    icon: AlertCircle,
    title: "Authentication Error",
    message: "An error occurred during sign in. Please try again.",
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
} as const;

// ─── Brand logos (same as homepage) ────────────────────────────────────────
const BRAND_LOGOS = [
  { name: "Google", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/KWvxGyeHeOdCWDBA.svg" },
  { name: "Shopify", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/RrYrMQAByeXLDYvF.svg" },
  { name: "Meta", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/IVQzagtquxBRPCYL.svg" },
  { name: "Nike", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/TiXyLFbvFHbHEbTs.svg" },
  { name: "Facebook", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/OeUyRoFtFBfOvhUj.svg" },
  { name: "Instagram", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/mikmpxOOFgYakoyl.svg" },
];

// ─── Testimonial ───────────────────────────────────────────────────────────
const TESTIMONIAL = {
  quote: "FormaStudio understood our brand better than we did. Their ability to generate the perfect model identities is what sets them apart.",
  name: "Sofia Ford",
  title: "Creative Director",
  image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
};

// ─── Sub-components ────────────────────────────────────────────────────────

function ErrorBanner({ errorType, lockMinutes }: { errorType: string; lockMinutes: string | null }) {
  const errorConfig = errorType === "suspended"
    ? ERROR_MESSAGES.suspended
    : errorType === "locked"
      ? ERROR_MESSAGES.locked
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

function SocialProofPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center px-12 xl:px-16">
      {/* Testimonial */}
      <div className="text-center max-w-md">
        <img
          src={TESTIMONIAL.image}
          alt={TESTIMONIAL.name}
          className="w-20 h-20 rounded-full object-cover mx-auto mb-8 border border-[#0A0A0A]/10"
        />
        <blockquote className="text-lg md:text-xl font-medium leading-relaxed text-[#0A0A0A] mb-6 tracking-tight">
          &ldquo;{TESTIMONIAL.quote}&rdquo;
        </blockquote>
        <p className="text-sm font-semibold text-[#0A0A0A]">@{TESTIMONIAL.name.toLowerCase().replace(" ", "")}</p>
        <p className="text-xs text-[#757575] mt-1">{TESTIMONIAL.title}</p>
      </div>

      {/* Divider */}
      <div className="w-16 h-px bg-[#D4D4D4] my-10" />

      {/* Trust stat */}
      <p className="text-sm text-center text-[#757575] mb-6">
        <span className="text-[#0A0A0A] font-semibold">100+</span> brands trust FormaStudio to craft their visual identity.
      </p>

      {/* Brand logos grid */}
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
  const [location] = useLocation();

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const errorType = searchParams.get("error");
  const lockMinutes = searchParams.get("minutes");
  const isSuspended = errorType === "suspended";

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      {/* Navigation — matches homepage header style */}
      <header className="sticky top-0 z-[100] max-w-[1520px] mx-auto px-6 lg:px-12 bg-[#EBEBEB] relative">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png"
              alt="Forma®"
              className="w-[31px] h-[31px]"
            />
          </Link>

          {/* CTA */}
          <DSButton href="/#contact" variant="primary" size="md">
            Start a project
          </DSButton>
        </div>
      </header>

      {/* Main Content — Two Column */}
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 lg:px-12 py-12 relative">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-0 items-center">

          {/* ─── Left Column: Login Form ─────────────────────────────── */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Error Banner */}
            {errorType && <ErrorBanner errorType={errorType} lockMinutes={lockMinutes} />}

            {/* Card */}
            <div className="bg-white rounded-2xl p-8 md:p-10 border border-[#0A0A0A]/5">
              <div className="mb-8">
                <h1 className="text-3xl font-medium tracking-tight text-[#0A0A0A]">
                  Sign in
                </h1>
                <p className="text-[#757575] text-sm mt-2 font-medium">
                  Welcome back to your creative studio
                </p>
              </div>

              {/* OAuth Buttons */}
              <div className="space-y-3">
                <OAuthButton href={loginUrl} disabled={isSuspended}>
                  <GoogleIcon disabled={isSuspended} /> Sign in with Google
                </OAuthButton>
                <OAuthButton href={loginUrl} disabled={isSuspended}>
                  <AppleIcon disabled={isSuspended} /> Sign in with Apple
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

              {/* Email Login — uses design-system Button with conveyor animation */}
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

              {/* Sign up link */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#0A0A0A]/5">
                <p className="text-sm text-[#757575] font-medium">Don't have an account?</p>
                {isSuspended ? (
                  <span className="text-sm text-[#D4D4D4] font-medium">Sign up</span>
                ) : (
                  <DSButton href={loginUrl} variant="outline" size="sm">
                    Sign up
                  </DSButton>
                )}
              </div>
            </div>
          </div>

          {/* ─── Mobile: Back to home ────────────────────────────────── */}
          <div className="lg:hidden text-center mt-2">
            <Link href="/" className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#757575] hover:text-[#0A0A0A] transition-colors duration-300">
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
              Back to home
            </Link>
          </div>

          {/* ─── Right Column: Social Proof ──────────────────────────── */}
          <SocialProofPanel />
        </div>
      </div>
    </div>
  );
}
