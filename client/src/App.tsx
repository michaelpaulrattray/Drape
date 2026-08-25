import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
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
import AdminCrew from "./pages/AdminCrew";
import AppLobby from "./pages/AppLobby";
import CastingFoundation from "./pages/CastingFoundation";
import CastingRoom from "./pages/CastingRoom";
import CastingSheet from "./pages/CastingSheet";
import CastingV2 from "./pages/CastingV2";
import { BoardPage } from "./features/boards/BoardPage";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { GenerationOperationBridge } from "./features/operations/GenerationOperationBridge";


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

          {/*
            Casting V2 (M5). Both routes gate on `castingV2.config.enabled`,
            which reads the server-owned CASTING_V2_SCOPE — an account outside
            the scope gets an honest "not open yet", never a broken sheet, and
            the procedures behind these screens refuse it regardless of what
            the client renders.

            The M1 primitive gallery keeps its own address: the light/dark
            screenshot drive compares one page that exercises every primitive,
            and that page should not be the product.
          */}
          <Route path="/casting" component={CastingV2} />
          {/*
            Keyed by the session, so moving sheet-to-sheet REMOUNTS.

            The store is session-scoped now, but the sheet also keeps things in
            plain component state — the brief input, which roll is being viewed,
            the dispatch latch — and a params-only navigation under wouter
            re-renders the same element rather than replacing it. Without the
            key, those carry across too: you would open another sheet and find
            the previous sheet's typed brief sitting in the box.
          */}
          <Route path="/casting/s/:sessionId">
            {(params) => <CastingSheet key={params.sessionId} />}
          </Route>
          {/*
            The room a Sign opens onto. Keyed by the Cast's public KI id — the
            only Cast identifier that ever leaves the server (§J) — and keyed as
            a route rather than a mode for the same reason the sheet is: a Cast
            is permanent, so the address should be too.
          */}
          <Route path="/casting/cast/:castId">
            {(params) => <CastingRoom key={params.castId} />}
          </Route>
          <Route path="/casting/foundation" component={CastingFoundation} />

          {/* Admin */}
          {/*
            The bare address answers (#68 — "from the lobby i cant even enter
            the admin page"): /admin typed into the bar was a 404 while every
            real page lives one segment deeper. AdminOverview owns the role
            guards, so this is safe for every role: unauthenticated → login,
            non-admin → studio, admin → dashboard.
          */}
          <Route path="/admin">
            <Redirect to="/admin/overview" replace />
          </Route>
          <Route path="/admin/overview" component={AdminOverview} />
          <Route path="/admin/audit-logs" component={AdminAuditLogs} />
          <Route path="/admin/users" component={AdminUserManagement} />
          <Route path="/admin/change-requests" component={AdminChangeRequests} />
          <Route path="/admin/invite-codes" component={AdminInviteCodes} />
          {/* The Crew tab (#41). Dark behind CREW_TAB_SCOPE: the route exists,
              and outside the scope its one query answers NOT_FOUND, so the page
              says it is not switched on and the nav never shows the link. */}
          <Route path="/admin/crew" component={AdminCrew} />
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
          <GenerationOperationBridge />
          <AnnouncementBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
