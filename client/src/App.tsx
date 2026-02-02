import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

// Placeholder component for coming soon pages
function ComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-orange/5 rounded-full blur-3xl" />
      </div>
      
      <div className="text-center relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-orange" />
        </div>
        <h1 className="text-4xl md:text-5xl font-instrument mb-4">
          Coming <span className="text-orange">Soon</span>
        </h1>
        <p className="text-white/50 mb-8 max-w-md mx-auto">
          We're working hard to bring you this feature. Stay tuned for updates.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:border-orange/30 text-white transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
