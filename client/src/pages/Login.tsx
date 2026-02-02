import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function Login() {
  const loginUrl = getLoginUrl();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-orange/20 selection:text-zinc-900">
      {/* Background Grid Lines */}
      <div className="fixed inset-0 grid-lines pointer-events-none z-0" />

      {/* Navigation */}
      <nav className="flex md:px-12 z-50 border-b pt-6 pr-6 pb-6 pl-6 relative items-center justify-between border-black/5 bg-zinc-50/80 backdrop-blur-md">
        <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl">
          <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
          <span className="font-geist">FORMA</span>
        </Link>

        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 w-full max-w-5xl border border-black/10 bg-white">
          {/* Left: Visual */}
          <div className="relative hidden lg:block min-h-[600px] overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop" 
              alt="Model" 
              className="absolute inset-0 w-full h-full object-cover grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-zinc-900/20 to-transparent" />
            
            {/* Overlay Content */}
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <p className="text-[10px] uppercase font-bold tracking-widest text-orange mb-3">
                AI Creative Studio
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white font-geist mb-3">
                Create Without Limits
              </h2>
              <p className="text-sm text-white/70 max-w-sm">
                Generate AI models, style outfits, and produce campaign-ready photoshoots—all from one platform.
              </p>
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16">
            {/* Header */}
            <div className="mb-10">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 font-geist">
                Welcome back
              </h1>
              <p className="text-sm text-zinc-500">
                Sign in to continue to your creative studio
              </p>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-3 mb-6">
              <a href={loginUrl} className="block">
                <button className="w-full h-12 px-4 border flex items-center justify-center gap-3 text-sm font-medium transition-all border-black/10 hover:border-black/20 hover:bg-black/5">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                </button>
              </a>

              <a href={loginUrl} className="block">
                <button className="w-full h-12 px-4 border flex items-center justify-center gap-3 text-sm font-medium transition-all border-black/10 hover:border-black/20 hover:bg-black/5">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Sign in with Apple
                </button>
              </a>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-zinc-400 tracking-wider">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email Login Button */}
            <a href={loginUrl} className="block">
              <button className="w-full h-12 px-4 flex items-center justify-center gap-2 text-sm font-semibold transition-all bg-zinc-900 text-white hover:bg-zinc-800">
                Sign in with Email
                <ArrowRight className="w-4 h-4" />
              </button>
            </a>

            {/* Sign up link */}
            <p className="text-center text-sm text-zinc-500 mt-8">
              Don't have an account?{" "}
              <a
                href={loginUrl}
                className="text-zinc-900 font-medium hover:text-orange transition-colors"
              >
                Sign up
              </a>
            </p>

            {/* Footer */}
            <p className="text-center text-xs text-zinc-400 mt-8">
              By continuing, you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-zinc-900 transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-zinc-900 transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
