import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const loginUrl = getLoginUrl();

  return (
    <div className="min-h-screen relative text-zinc-900 bg-zinc-50 selection:bg-sky-500 selection:text-white overflow-hidden">
      {/* Background Grid Lines */}
      <div className="fixed grid-lines pointer-events-none z-0 inset-0 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="neonGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(14, 165, 233, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id="neonGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(14, 165, 233, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
            </linearGradient>
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line x1="-200" y1="30%" x2="0" y2="30%" stroke="url(#neonGradient1)" strokeWidth="1" filter="url(#neonGlow)">
            <animate attributeName="x1" values="-200;100%" dur="15s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0;120%" dur="15s" repeatCount="indefinite" />
          </line>
          <line x1="70%" y1="-200" x2="70%" y2="0" stroke="url(#neonGradient2)" strokeWidth="1" filter="url(#neonGlow)">
            <animate attributeName="y1" values="-200;100%" dur="12s" repeatCount="indefinite" />
            <animate attributeName="y2" values="0;120%" dur="12s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>

      {/* Navigation - Inline header */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 md:px-12 md:py-8 flex justify-between items-center">
        <a href="/" className="group flex items-center gap-1.5 text-2xl md:text-3xl tracking-tight font-normal font-geist text-zinc-900">
          <span className="border-b border-zinc-900 pb-0.5 group-hover:border-transparent transition-colors duration-300">forma</span>
          <span>studio</span>
        </a>

        <a 
          href="/#waitlist" 
          className="px-5 py-2 rounded-full border border-zinc-900/20 hover:bg-zinc-900 hover:text-white transition-all duration-300 text-sm font-medium uppercase tracking-wide"
        >
          Join Waitlist
        </a>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase md:text-xs font-semibold tracking-widest mb-3 text-sky-600">
              AI-Powered Creative Studio
            </p>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-none font-geist text-zinc-900">
              FORMA
              <span className="text-sky-500 text-5xl align-top">+</span>
            </h1>
          </div>

          {/* Login Card */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 md:p-10 shadow-xl shadow-zinc-200/50">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2 font-geist">
                Welcome back
              </h2>
              <p className="text-zinc-500 text-sm">
                Sign in to continue to your studio
              </p>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-3 mb-6">
              <a href={loginUrl} className="block">
                <Button
                  variant="outline"
                  className="w-full h-12 bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-900 transition-all duration-300"
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
                  className="w-full h-12 bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-900 transition-all duration-300"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Sign in with Apple
                </Button>
              </a>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-zinc-400 tracking-wider">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email Login Button */}
            <a href={loginUrl} className="block">
              <Button
                className="w-full h-12 bg-sky-500 text-white hover:bg-sky-600 font-semibold transition-all duration-300 group shadow-lg shadow-sky-500/30 hover:shadow-sky-600/40"
              >
                Sign in with Email
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>

            {/* Sign up link */}
            <p className="text-center text-sm text-zinc-500 mt-6">
              Don't have an account?{" "}
              <a
                href={loginUrl}
                className="text-zinc-900 hover:text-sky-600 underline underline-offset-4 transition-colors font-medium"
              >
                Sign up
              </a>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-400 mt-8">
            By continuing, you agree to our{" "}
            <a href="#" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
