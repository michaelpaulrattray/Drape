import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, Clock, ShieldOff } from "lucide-react";
import { useLocation } from "wouter";

// Error message configurations
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

export default function Login() {
  const loginUrl = getLoginUrl();
  const [location] = useLocation();
  
  // Parse query parameters for error handling
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const errorType = searchParams.get("error");
  const lockMinutes = searchParams.get("minutes");
  
  // Determine which error to show (if any)
  const errorConfig = errorType === "suspended" 
    ? ERROR_MESSAGES.suspended 
    : errorType === "locked" 
      ? ERROR_MESSAGES.locked 
      : errorType 
        ? ERROR_MESSAGES.error 
        : null;

  return (
    <div className="min-h-screen relative text-obsidian bg-canvas selection:bg-slate-accent selection:text-white overflow-hidden">
      {/* Technical Grid Background */}
      <div className="fixed inset-0 technical-grid pointer-events-none z-0" />
      
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-white/50 via-transparent to-[#EFF2F9]/30 pointer-events-none z-0" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 md:px-12 md:py-8 flex justify-between items-center">
        <a href="/" className="group flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-accent flex items-center justify-center">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
              alt="Forma Studio" 
              className="w-5 h-5 invert opacity-90"
            />
          </div>
          <div>
            <span className="text-lg font-semibold text-obsidian tracking-tight">FormaStudio</span>
          </div>
        </a>

        <a 
          href="/#contact" 
          className="px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-slate-accent hover:text-white hover:border-slate-accent transition-all duration-300 text-sm font-medium shadow-sm"
        >
          Contact Us
        </a>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase md:text-xs font-semibold tracking-widest mb-3 text-slate-accent">
              AI-Powered Creative Studio
            </p>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-none font-geist text-obsidian">
              FORMA
              <span className="text-slate-accent text-3xl align-top ml-1">Studio</span>
            </h1>
          </div>

          {/* Error Alert Banner */}
          {errorConfig && (
            <div className={`mb-6 p-4 rounded-xl border ${errorConfig.bgColor} ${errorConfig.borderColor}`}>
              <div className="flex items-start gap-3">
                <errorConfig.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${errorConfig.iconColor}`} />
                <div>
                  <h3 className="font-semibold text-obsidian text-sm">
                    {errorConfig.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {errorType === "locked" && lockMinutes 
                      ? `Your account has been temporarily locked due to multiple failed login attempts. Please try again in ${lockMinutes} minute${parseInt(lockMinutes) !== 1 ? 's' : ''}.`
                      : errorConfig.message
                    }
                  </p>
                  {errorType === "suspended" && (
                    <a 
                      href="mailto:support@formastudio.ai" 
                      className="inline-flex items-center gap-1 text-sm font-medium text-slate-accent hover:underline mt-2"
                    >
                      Contact Support
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Login Card */}
          <div className="card-soft rounded-2xl p-8 md:p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-obsidian mb-2 font-geist">
                Welcome back
              </h2>
              <p className="text-subtle text-sm">
                Sign in to continue to your studio
              </p>
            </div>

            {/* Social Login Buttons - Disabled if suspended */}
            <div className="space-y-3 mb-6">
              {errorType === "suspended" ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <svg className="w-5 h-5 mr-3 opacity-50" viewBox="0 0 24 24">
                      <path
                        fill="#9CA3AF"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#9CA3AF"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#9CA3AF"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#9CA3AF"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <svg className="w-5 h-5 mr-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    Sign in with Apple
                  </Button>
                </>
              ) : (
                <>
                  <a href={loginUrl} className="block">
                    <Button
                      variant="outline"
                      className="w-full h-12 bg-white hover:bg-gray-50 border-gray-200 hover:border-slate-accent text-obsidian transition-all duration-300"
                    >
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </Button>
                  </a>

                  <a href={loginUrl} className="block">
                    <Button
                      variant="outline"
                      className="w-full h-12 bg-white hover:bg-gray-50 border-gray-200 hover:border-slate-accent text-obsidian transition-all duration-300"
                    >
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Sign in with Apple
                    </Button>
                  </a>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-subtle tracking-wider">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email Login Button - Disabled if suspended */}
            {errorType === "suspended" ? (
              <Button
                className="w-full h-12 bg-gray-300 text-gray-500 cursor-not-allowed"
                disabled
              >
                Sign in with Email
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <a href={loginUrl} className="block">
                <Button
                  className="w-full h-12 btn-slate font-semibold transition-all duration-300 group shadow-lg"
                >
                  Sign in with Email
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            )}

            {/* Sign up link */}
            <p className="text-center text-sm text-subtle mt-6">
              Don't have an account?{" "}
              {errorType === "suspended" ? (
                <span className="text-gray-400">Sign up</span>
              ) : (
                <a
                  href={loginUrl}
                  className="text-obsidian hover:text-slate-accent underline underline-offset-4 transition-colors font-medium"
                >
                  Sign up
                </a>
              )}
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-subtle mt-8">
            By continuing, you agree to our{" "}
            <a href="#" className="underline underline-offset-2 hover:text-slate-accent transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-2 hover:text-slate-accent transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
