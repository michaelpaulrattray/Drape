import { trpc } from "@/lib/trpc";
import {
  afterFirstContentfulPaint,
  isSuppressedErrorMessage,
  startClientErrorReporting,
} from "@/monitoring/errorReporter";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Suppress benign ResizeObserver loop warnings (common with React Flow's NodeResizer).
// The string these three test against lives in `monitoring/errorReporter.ts`, which is
// also what the error tracker asks before reporting anything — one declaration, because
// a tracker that reported this burst is a tracker nobody would read (#509 part 1b).
window.addEventListener('error', (e) => {
  if (isSuppressedErrorMessage(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (isSuppressedErrorMessage(String(e.reason))) {
    e.preventDefault();
  }
});
// Also patch the global onerror for environments that fire it before addEventListener
const _origOnError = window.onerror;
window.onerror = function (msg, ...rest) {
  if (isSuppressedErrorMessage(msg)) return true;
  return _origOnError?.call(this, msg, ...rest) ?? false;
};

// Remember an uncaught error from here on; fetch the transport once the customer
// can actually see something. `afterFirstContentfulPaint` waits for the browser's
// own paint entry before going idle — measured, because a bare idle callback fired
// 1.8 s BEFORE this app's first contentful paint, while it waits on its own API.
// With no VITE_SENTRY_DSN this does nothing at all, and says so at boot.
startClientErrorReporting(
  window,
  (task) => afterFirstContentfulPaint(task, window),
  () => import('./monitoring/errorTracker'),
);

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    // Suppress rate-limit errors — they're transient and handled locally by mutations
    if (error instanceof TRPCClientError && error.data?.code === 'TOO_MANY_REQUESTS') return;
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
