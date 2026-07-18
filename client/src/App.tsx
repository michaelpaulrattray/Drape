import { Toaster } from "@/components/ui/sonner";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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
import { trpc } from "@/lib/trpc";
import { subscribeCastingOperations } from "./features/casting/pendingCastRegistry";
import { useGenerationJobs } from "./features/boards/stores/useGenerationJobs";


/** Lobby views share one transition key so the rail doesn't remount between them. */
const LOBBY_ROUTES = new Set(['/app', '/app/boards', '/app/models', '/app/garments', '/app/looks']);

/** Always-mounted owner for a cast that settles after its originating surface
 * closes or the user navigates elsewhere in this tab. */
function CastingOperationOwner() {
  const utils = trpc.useUtils();
  const fillFromLibrary = trpc.boardOps.fillFromLibrary.useMutation();
  // This owner must never have a subscription gap while routes, queries, or
  // mutation status re-render App. Keep one listener for the app lifetime and
  // read the current tRPC helpers through refs.
  const utilsRef = useRef(utils);
  const fillFromLibraryRef = useRef(fillFromLibrary.mutateAsync);
  utilsRef.current = utils;
  fillFromLibraryRef.current = fillFromLibrary.mutateAsync;

  useEffect(() => subscribeCastingOperations((event) => {
    if (event.phase !== 'settle') return;

    // The node job is module-scoped and can outlive BoardPage. Settlement
    // therefore belongs to this always-mounted owner: navigating to the
    // lobby must not leave a completed operation marked running when the
    // board is opened again in the same tab.
    const origin = event.operation.origin;
    if (origin) {
      const jobs = useGenerationJobs.getState();
      const job = jobs.jobs[origin.itemId];
      if (job?.status === 'running') {
        if (event.outcome.status === 'success') jobs.completeJob(origin.itemId);
        else jobs.clearJob(origin.itemId);
      }
    }

    if (event.outcome.status === 'failure') {
      if (event.outcome.background && event.outcome.notifyFailure) {
        toast.error(event.outcome.message, { duration: 10000 });
      }
      return;
    }
    const outcome = event.outcome;

    // Foreground generation retains the takeover's existing landing and
    // feedback ceremony. The app owner steps in only after that surface has
    // closed, which prevents a second fill/version row on normal close.
    if (event.operation.kind !== 'newCast' || !outcome.background) return;

    void (async () => {
      const currentUtils = utilsRef.current;
      let landed = false;
      if (origin && origin.boardId > 0 && origin.itemId > 0) {
        try {
          // Same-tab safety: a deleted or repurposed origin must never be
          // overwritten by a late cast. The generating job makes that state
          // unreachable through the normal UI; this read is the final guard.
          const items = await currentUtils.boards.getItems.fetch({ boardId: origin.boardId });
          const item = items.find((candidate) => candidate.id === origin.itemId);
          const stillEmpty = !!item && !item.imageUrl && !item.sourceModelId;
          if (stillEmpty) {
            await fillFromLibraryRef.current({
              boardId: origin.boardId,
              itemId: origin.itemId,
              modelId: outcome.modelId,
            });
            landed = true;
            await Promise.all([
              currentUtils.boards.getItems.invalidate({ boardId: origin.boardId }),
              currentUtils.generation.packageState.invalidate({ modelId: outcome.modelId }),
              currentUtils.boardOps.listCastableModels.invalidate(),
            ]);
          }
        } catch {
          // The draft remains durable in Models. A vanished/reassigned node
          // degrades to notice-only instead of risking the user's canvas.
        }
      }

      toast.success('Draft generated and saved to Drafts', {
        duration: 10000,
        action: landed && outcome.openDraft
          ? { label: 'Open Draft', onClick: () => outcome.openDraft?.(true) }
          : undefined,
      });
    })();
  }), []);
  return null;
}

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
          <CastingOperationOwner />
          <AnnouncementBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
