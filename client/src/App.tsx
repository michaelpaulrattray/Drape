import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Waitlist from "./pages/Waitlist";
import { ArrowLeft, Sparkles } from "lucide-react";

function Router() {
  return (
    <Switch>
      {/* Waitlist is the main landing page during pre-launch */}
      <Route path="/" component={Waitlist} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/casting-studio" component={ComingSoon} />
      <Route path="/outfit-studio" component={ComingSoon} />
      <Route path="/photo-studio" component={ComingSoon} />
      <Route path="/settings" component={ComingSoon} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Placeholder component for coming soon pages - Light theme style
function ComingSoon() {
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

        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
        <div className="text-center max-w-lg">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-orange/10 flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-10 h-10 text-orange" />
          </div>

          {/* Badge */}
          <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest border mb-6 bg-white border-black/10 text-orange">
            Coming Soon
          </span>

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 font-geist">
            Under Development
          </h1>

          {/* Description */}
          <p className="text-zinc-500 text-sm md:text-base leading-relaxed mb-8 max-w-md mx-auto">
            We're working hard to bring you this feature. Join the waitlist to be notified when it's ready.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="px-6 py-3 text-sm font-semibold transition-all bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go to Dashboard
            </Link>
            <Link href="/#contact" className="px-6 py-3 text-sm font-medium border transition-colors border-black/20 hover:bg-black/5">
              Join Waitlist
            </Link>
          </div>

          {/* Footer note */}
          <p className="text-xs text-zinc-400 mt-12">
            Expected launch: Q2 2025
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
