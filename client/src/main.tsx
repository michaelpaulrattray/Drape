import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Suppress benign ResizeObserver loop warnings (common with React Flow's NodeResizer)
const RO_MSG = 'ResizeObserver loop';
window.addEventListener('error', (e) => {
  if (e.message?.includes(RO_MSG)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (String(e.reason)?.includes(RO_MSG)) {
    e.preventDefault();
  }
});
// Also patch the global onerror for environments that fire it before addEventListener
const _origOnError = window.onerror;
window.onerror = function (msg, ...rest) {
  if (typeof msg === 'string' && msg.includes(RO_MSG)) return true;
  return _origOnError?.call(this, msg, ...rest) ?? false;
};

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
