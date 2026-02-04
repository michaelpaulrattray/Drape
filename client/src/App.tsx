import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Waitlist from "./pages/Waitlist";
import CastingStudio from "./pages/CastingStudio";

function Router() {
  return (
    <Switch>
      {/* New Kanso-style Home page */}
      <Route path="/" component={Home} />
      <Route path="/waitlist" component={Waitlist} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/casting-studio" component={CastingStudio} />
      <Route path="/outfit-studio" component={ComingSoon} />
      <Route path="/photo-studio" component={ComingSoon} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Placeholder component for coming soon pages
function ComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-instrument mb-4">Coming Soon</h1>
        <p className="text-muted-foreground mb-6">
          This feature is under development
        </p>
        <a
          href="/"
          className="text-sm underline underline-offset-4 hover:text-white transition-colors"
        >
          Go back home
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
