/**
 * THE BROWSER'S ERROR REPORTER — the EAGER half, and it carries no SDK and no
 * scrub (#509 part 1b).
 *
 * The server half (`server/monitoring/errorTracker.ts`) reports a crash the
 * moment it happens, because a server process is already running when the error
 * arrives. A browser is not: the most valuable error this product can report is
 * the one thrown during the FIRST RENDER — a hook added under an early return,
 * which is React error #310 and has happened here — and at that moment no SDK
 * has loaded, because loading one before first paint is exactly what this file
 * exists to avoid.
 *
 * So the browser half is two modules, and the split is a measurement rather
 * than a preference:
 *
 *   · THIS file is imported by `main.tsx` and runs synchronously before the
 *     first render. It knows how to REMEMBER an error and nothing else — no
 *     `@sentry/browser`, no `shared/errorEventScrub`, no network. Its whole job
 *     is that the first-render crash is still in hand when a transport exists.
 *   · `./errorTracker.ts` is `import()`ed AFTER first paint and carries both the
 *     SDK and the scrub. It registers itself here as the sink, and everything
 *     remembered is replayed through it.
 *
 * # WHY THE SDK MAY NOT BE IN THE FIRST-PAINT CHUNK, WITH THE NUMBER
 *
 * ⚠ `FIRST_PAINT_JS_BUDGET_BYTES` is **290 kB** against a measured **260.3 kB**
 * (`server/bundleBudget.test.ts`), so there are **29.7 kB** of headroom, and
 * `@sentry/browser` gzips to about that on its own. A static import would spend
 * the entire remaining budget of the app's first download on a library that is
 * useful only after something has already gone wrong. The gate's
 * `bundle-budget` job would refuse it, and it would be right to.
 *
 * # WHAT THIS FILE COSTS, AND WHY IT IS NOT NOTHING
 *
 * It is a few hundred bytes and it is honest about being eager. What it is NOT
 * allowed to grow into is a second implementation of the scrub: everything about
 * what may LEAVE the building lives in `shared/errorEventScrub.ts` and is
 * reached only from the lazy half. This module never touches the network, so it
 * has nothing to decide about.
 *
 * # WITH NO DSN THERE IS NO REPORTER AT ALL (invariant 7)
 *
 * `VITE_SENTRY_DSN` absent — every developer's laptop, and production until the
 * founder pastes his key — means the lazy half is **never imported**, no
 * listener is installed, and nothing is remembered. What it does not do is
 * pretend: `clientErrorReporterState()` answers `configured: false`, so no
 * surface can ever draw a number over a reporter nobody switched on. That
 * reading is the lying-control class this repository has paid for three times
 * (the Slack approval flow, the IP blocks, the in-memory audit chain).
 */

/**
 * THE NOISE THIS APP ALREADY SWALLOWS, DECLARED ONCE (working law 4).
 *
 * `client/src/main.tsx` has suppressed `ResizeObserver loop` errors since React
 * Flow's `NodeResizer` landed: they are a benign browser-internal race, they
 * fire in bursts, and they are not a defect anybody can act on. **An error
 * tracker that reports them is a tracker nobody will read** — and in this
 * product they would arrive from the canvas by the hundred.
 *
 * ⚠ **The tempting implementation is to rely on the listener ORDER instead, and
 * it is the wrong one.** `main.tsx`'s handler calls `stopImmediatePropagation()`,
 * which does stop later listeners on the same target — so registering the
 * buffer's listener afterwards would suppress the noise for free. It would also
 * make a control out of a registration order that any future edit to `main.tsx`
 * can silently reverse, with the only symptom being a flooded error tracker
 * nobody is looking at yet. So the predicate is explicit, it is declared HERE,
 * and `main.tsx` reads it from here rather than keeping its own copy of the
 * string.
 */
export const SUPPRESSED_MESSAGE_SUBSTRINGS: readonly string[] = ["ResizeObserver loop"];

/** Does this message name noise the app deliberately swallows? */
export function isSuppressedErrorMessage(message: unknown): boolean {
  if (typeof message !== "string" || message.length === 0) return false;
  return SUPPRESSED_MESSAGE_SUBSTRINGS.some((fragment) => message.includes(fragment));
}

/** What a caller knows about the error beyond the throw itself. */
export interface ClientErrorContext {
  /** Where it happened, in the product's own terms — the page's path. */
  route?: string;
  /** `render`, `window.onerror`, `unhandledrejection` — how it reached us. */
  kind?: string;
}

/** The lazy half, once it has loaded, seen through the only door it needs. */
export type ClientErrorSink = (error: unknown, context: ClientErrorContext) => void;

/**
 * How many errors are remembered before the transport exists.
 *
 * Small on purpose. The window this covers is one paint plus one idle callback,
 * and the errors in it are a handful at most — except in the one case that
 * matters, a render loop throwing on every attempt, where an unbounded buffer
 * would grow without limit inside a page that is already broken. The FIRST ones
 * are kept rather than the last: in a render loop they are all the same error,
 * and the first one is the one with the untruncated cause.
 */
export const PRELOAD_BUFFER_CAP = 20;

interface RememberedError {
  error: unknown;
  context: ClientErrorContext;
}

interface ReporterState {
  /** A DSN is set, so this page intends to report. */
  configured: boolean;
  /** The lazy half has registered itself; nothing is being remembered now. */
  handedOff: boolean;
  /** How many are waiting for a transport. */
  buffered: number;
  /** How many were remembered and then replayed — the pre-paint window's yield. */
  replayed: number;
  /** How many were dropped because the buffer was full. */
  overflowed: number;
  /** How many were recognised as suppressed noise and never remembered. */
  suppressed: number;
}

const state: ReporterState = {
  configured: false,
  handedOff: false,
  buffered: 0,
  replayed: 0,
  overflowed: 0,
  suppressed: 0,
};

let buffer: RememberedError[] = [];
let sink: ClientErrorSink | null = null;
let uninstallCapture: (() => void) | null = null;

/**
 * The DSN, read in ONE place so the eager half's "should I even import the lazy
 * half" question and the lazy half's `init` cannot disagree about whether this
 * page reports.
 *
 * `import.meta.env` rather than `process.env`: this is client code, the value is
 * baked in at build time by Vite, and a `process` reference here would break the
 * bundle.
 */
export function clientSentryDsn(): string {
  const raw = (import.meta.env.VITE_SENTRY_DSN ?? "") as string;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Hand an error to the tracker, or remember it until there is one.
 *
 * Never throws: every call site is already handling something that went wrong,
 * and a reporting path that can fail is a second crash on top of the first.
 */
export function reportClientError(error: unknown, context: ClientErrorContext = {}): void {
  try {
    if (!state.configured) return;

    const message = error instanceof Error ? error.message : String(error);
    if (isSuppressedErrorMessage(message)) {
      state.suppressed += 1;
      return;
    }

    if (sink) {
      sink(error, context);
      return;
    }

    if (buffer.length >= PRELOAD_BUFFER_CAP) {
      state.overflowed += 1;
      return;
    }
    buffer.push({ error, context });
    state.buffered = buffer.length;
  } catch {
    /* Reporting an error must never become one. */
  }
}

/**
 * The lazy half announcing itself. Everything remembered is replayed through it,
 * oldest first, and the pre-paint listeners come down — from here the SDK's own
 * global handlers are the road, and leaving ours installed would report every
 * window error twice.
 */
export function registerClientErrorSink(next: ClientErrorSink): void {
  sink = next;
  state.handedOff = true;

  uninstallCapture?.();
  uninstallCapture = null;

  const pending = buffer;
  buffer = [];
  state.buffered = 0;
  for (const remembered of pending) {
    try {
      next(remembered.error, remembered.context);
      state.replayed += 1;
    } catch {
      /* One unreplayable error must not cost the rest of the trail. */
    }
  }
}

/**
 * The minimum surface this module needs of a window, so the arms can drive the
 * real code path against a real `EventTarget` in a node test rather than against
 * a mock of themselves.
 */
export interface ErrorCaptureTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

/**
 * Watch for uncaught errors during the window before the SDK exists.
 *
 * ⚠ **`error` AND `unhandledrejection` ONLY — `window.onerror` IS DELIBERATELY
 * NOT PATCHED HERE.** `main.tsx` already owns that property (it chains to a
 * previous handler to swallow the ResizeObserver burst), and the SDK's own
 * `GlobalHandlers` integration patches it again at `init`. A third writer to one
 * property, installed and removed on a timer, is how a chain loses a link.
 * Listening is additive; patching is not.
 *
 * Returns the uninstaller, which `registerClientErrorSink` calls at handoff.
 */
export function installGlobalErrorCapture(target: ErrorCaptureTarget): () => void {
  const onError = (event: unknown): void => {
    const detail = event as { error?: unknown; message?: unknown } | null;
    reportClientError(detail?.error ?? detail?.message ?? "uncaught error", {
      kind: "window.error",
    });
  };
  const onRejection = (event: unknown): void => {
    const detail = event as { reason?: unknown } | null;
    reportClientError(detail?.reason ?? "unhandled rejection", { kind: "unhandledrejection" });
  };

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);

  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}

/**
 * Bring the reporter up: arm the pre-paint buffer now, and fetch the transport
 * once the browser is idle.
 *
 * ⚠ **THE ORDER IS THE WHOLE POINT.** The listeners go on SYNCHRONOUSLY, before
 * `createRoot().render()` is reached, because the error this exists for is
 * thrown inside that call. The `import()` is scheduled for after first paint,
 * because that is the cost this file was written to avoid.
 *
 * `requestIdleCallback` where the browser has it (every current engine but
 * Safari), a `setTimeout` otherwise. Either way it is a MACROTASK, so the first
 * paint has happened before the chunk is even requested.
 */
export function startClientErrorReporting(
  target: ErrorCaptureTarget,
  schedule: (task: () => void) => void,
  load: () => Promise<{ startClientErrorTracker: () => Promise<string> }>,
): void {
  if (clientSentryDsn().length === 0) return;
  if (state.configured) return;

  state.configured = true;
  uninstallCapture = installGlobalErrorCapture(target);

  schedule(() => {
    void load()
      .then((mod) => mod.startClientErrorTracker())
      .then((line) => {
        if (import.meta.env.DEV) console.info(line);
      })
      .catch(() => {
        /* A transport that cannot be fetched leaves the page working and the
           buffer held. It must not look started, which is what `handedOff`
           staying false is — and the listeners stay up, so a later error is
           still remembered rather than lost. */
      });
  });
}

/**
 * What a surface must ask before it draws a number, and what the arms read.
 * `configured: false` is the answer that forbids "no errors today".
 */
export function clientErrorReporterState(): Readonly<ReporterState> {
  return { ...state };
}

/**
 * Test seam only: forget everything this module remembers between arms. Named
 * the way this repository's other such seams are named, because
 * `scripts/check-cleanup-dispositions.mts` reads that convention off the NAME.
 */
export function resetClientErrorReporterForTests(): void {
  uninstallCapture?.();
  uninstallCapture = null;
  sink = null;
  buffer = [];
  state.configured = false;
  state.handedOff = false;
  state.buffered = 0;
  state.replayed = 0;
  state.overflowed = 0;
  state.suppressed = 0;
}
