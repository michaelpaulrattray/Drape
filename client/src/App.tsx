import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { Suspense } from "react";
import { staffPage } from "./lib/staffPage";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageTransition } from "./components/PageTransition";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import AppLobby from "./pages/AppLobby";
import CastingRoom from "./pages/CastingRoom";
import CastingSheet from "./pages/CastingSheet";
import CastingV2 from "./pages/CastingV2";
import { BoardPage } from "./features/boards/BoardPage";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { GenerationOperationBridge } from "./features/operations/GenerationOperationBridge";

/*
 * THE STAFF PAGES ARE LAZY, AND THE CUSTOMER PAGES ARE NOT (#744).
 *
 * Until 2026-09-12 the client shipped as ONE 637 kB (gzip) chunk, and that
 * chunk carried the admin panel and its charting library (recharts, with its
 * lodash) to every visitor — a customer opening the lobby downloaded the
 * admin overview's charts before a pixel rendered. Measured with
 * `pnpm machinist:bundle`: recharts was the single largest owner (11.4% of
 * attributed bytes), imported by nothing outside `features/admin/overview`.
 *
 * So the pages only staff can reach — every `/admin/*` page, `/moderator`,
 * and `/studio` (sealed to admins by #364) — are `lazy()`: each becomes its
 * own chunk, fetched the first time a staff member opens it and never by a
 * customer. Every one of them owns its own role guard (`appRoutes.test.ts`
 * pins that), so the split changes WHO DOWNLOADS the code, never who may run
 * it.
 *
 * The customer's routes stay STATIC on purpose. Route splitting trades one
 * download for several and can make navigation slower; the card's own
 * caveat. A customer never navigates to a staff page, so their navigation
 * cannot get slower from this — and a customer page going lazy is a separate
 * decision with its own measurement. `client/src/staffPagesLazy.test.ts`
 * holds both halves.
 *
 * `staffPage` is `lazy()` plus one thing the monolith never needed: a deploy
 * (every merge to main, #508) removes the old chunk files, so a staff tab
 * opened before the deploy that first visits a page after it would fail the
 * import and land on the raw ErrorBoundary. The helper reloads once and
 * rethrows on a second failure (`lib/staffPage.ts`).
 */
const DrapeStudio = staffPage(() => import("./pages/DrapeStudio"));
const AdminAuditLogs = staffPage(() => import("./pages/AdminAuditLogs"));
const AdminUserManagement = staffPage(() => import("./pages/AdminUserManagement"));
const ModeratorDashboard = staffPage(() => import("./pages/ModeratorDashboard"));
const AdminChangeRequests = staffPage(() => import("./pages/AdminChangeRequests"));
const AdminOverview = staffPage(() => import("./pages/AdminOverview"));
const AdminInviteCodes = staffPage(() => import("./pages/AdminInviteCodes"));
const AdminCrew = staffPage(() => import("./pages/AdminCrew"));
const AdminBugReports = staffPage(() => import("./pages/AdminBugReports"));
const AdminFoundation = staffPage(() => import("./pages/AdminFoundation"));


/** Lobby views share one transition key so the rail doesn't remount between them. */
const LOBBY_ROUTES = new Set(['/app', '/app/boards', '/app/models', '/app/garments', '/app/looks']);

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={LOBBY_ROUTES.has(location) ? '/app' : location}>
        {/*
          The fallback is nothing, deliberately: a lazy chunk arrives in the
          time the page's own fade-in takes, and a spinner for a staff page's
          first open would be machinery showing through. Customer routes never
          suspend here — none of them is lazy.
        */}
        <Suspense fallback={null}>
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

              The M1 primitive gallery is no longer one of these. It is a house
              tool and it now answers at `/admin/foundation` (#261) — the
              light/dark screenshot drive still compares one page that exercises
              every primitive, but that page is not in the customer's namespace.
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
            <Route path="/admin/bug-reports" component={AdminBugReports} />
            {/*
              The component specimen sheet (#261). It used to answer at
              `/casting/foundation` — a house-only page, gating on nothing, at a
              public address inside the customer's own product namespace. The
              founder ruled the address rather than a gate: "A component specimen
              has no business inside the /casting namespace at all" (2026-08-30),
              then "it should be admin" (2026-09-01). The page owns its own admin
              guard, like every page in this block; the old address is gone rather
              than hidden, so it answers 404 for everyone including admins.
            */}
            <Route path="/admin/foundation" component={AdminFoundation} />
            {/* The Crew tab (#41). Dark behind CREW_TAB_SCOPE: the route exists,
                and outside the scope its one query answers NOT_FOUND, so the page
                says it is not switched on and the nav never shows the link. */}
            <Route path="/admin/crew" component={AdminCrew} />
            <Route path="/moderator" component={ModeratorDashboard} />

            {/* 404 */}
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      {/* No `defaultTheme` here on purpose: the cold-start theme is
          `DEFAULT_THEME` in `foundation/theme.ts` (light — his 2026-07-30
          decision, re-stated 2026-09-08, card 686). A prop here shadowed it with
          "dark" for six weeks; `themeDefault.test.ts` refuses a second one. */}
      <ThemeProvider>
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
