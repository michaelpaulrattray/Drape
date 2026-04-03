import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageTransition } from "./components/PageTransition";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DrapeStudio from "./pages/DrapeStudio";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminUserManagement from "./pages/AdminUserManagement";
import ModeratorDashboard from "./pages/ModeratorDashboard";
import AdminChangeRequests from "./pages/AdminChangeRequests";
import AdminOverview from "./pages/AdminOverview";
import AdminInviteCodes from "./pages/AdminInviteCodes";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import BugReportButton from "./components/BugReportButton";

/** Legacy redirect: /casting-studio → /studio?tool=casting */
function CastingStudioRedirect() {
  return <Redirect to="/studio?tool=casting" />;
}

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location}>
        <Switch location={location}>
          {/* Public */}
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />

          {/* Dashboard */}
          <Route path="/dashboard" component={Dashboard} />

          {/* Unified Drape Studio */}
          <Route path="/studio" component={DrapeStudio} />

          {/* Legacy redirect */}
          <Route path="/casting-studio" component={CastingStudioRedirect} />

          {/* Admin */}
          <Route path="/admin/overview" component={AdminOverview} />
          <Route path="/admin/audit-logs" component={AdminAuditLogs} />
          <Route path="/admin/users" component={AdminUserManagement} />
          <Route path="/admin/change-requests" component={AdminChangeRequests} />
          <Route path="/admin/invite-codes" component={AdminInviteCodes} />
          <Route path="/moderator" component={ModeratorDashboard} />

          {/* 404 */}
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </PageTransition>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AnnouncementBanner />
          <Router />
          <BugReportButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
