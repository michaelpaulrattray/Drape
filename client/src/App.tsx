import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageTransition } from "./components/PageTransition";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import DrapeStudio from "./pages/DrapeStudio";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminUserManagement from "./pages/AdminUserManagement";
import ModeratorDashboard from "./pages/ModeratorDashboard";
import AdminChangeRequests from "./pages/AdminChangeRequests";
import AdminOverview from "./pages/AdminOverview";
import AdminInviteCodes from "./pages/AdminInviteCodes";
import AppLobby from "./pages/AppLobby";
import { BoardPage } from "./features/boards/BoardPage";
import { AnnouncementBanner } from "./components/AnnouncementBanner";


/** Lobby views share one transition key so the rail doesn't remount between them. */
const LOBBY_ROUTES = new Set(['/app', '/app/boards', '/app/models', '/app/garments', '/app/looks']);

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={LOBBY_ROUTES.has(location) ? '/app' : location}>
        <Switch location={location}>
          {/* Public */}
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/verify-email" component={VerifyEmail} />

          {/* Lobby (rail + views) */}
          <Route path="/app" component={AppLobby} />
          <Route path="/app/boards" component={AppLobby} />
          <Route path="/app/models" component={AppLobby} />
          <Route path="/app/garments" component={AppLobby} />
          <Route path="/app/looks" component={AppLobby} />

          {/* Board-based canvas */}
          <Route path="/app/board/:id" component={BoardPage} />

          {/* Classic Drape Studio (fallback) */}
          <Route path="/studio" component={DrapeStudio} />

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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
