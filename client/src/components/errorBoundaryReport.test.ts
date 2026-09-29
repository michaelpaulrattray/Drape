/**
 * ⚠ THE BOUNDARY HANDS THE COMPONENT STACK ON (#1420) — THE LINK NOTHING ELSE
 * COVERS.
 *
 * Three things had to be true for a render crash to arrive readable, and each
 * is proven somewhere different, which is why this file exists rather than an
 * arm being bolted to one of the other two:
 *
 *   · the scrub ALLOWS it to travel — `server/errorEventScrub.test.ts`;
 *   · `captureClientError` puts it on the SDK's scope —
 *     `client/src/monitoring/errorTracker.test.ts`;
 *   · **the boundary actually passes it**, which is here. Invariant 7 pointed at
 *     a data path: a field the wire allows and the reporter forwards is still
 *     carried by nothing if the one call site that HAS it drops it — and that is
 *     precisely what the code did until this card, deliberately and with a
 *     comment saying so.
 *
 * ⚠ **`componentDidCatch` IS DRIVEN DIRECTLY, AND THAT IS NOT A SHORTCUT.**
 * `vitest.config.ts` runs the client's suites in a NODE environment with no
 * jsdom and no testing-library — *"component rendering stays out of `pnpm
 * test`"* is its own words — so React cannot be asked to crash a tree here.
 * What matters is not that React calls this method (React's contract, not
 * ours); it is what OUR method does with the `errorInfo` React hands it. So the
 * real class is instantiated and the real method is called with the real shape
 * React passes, and the assertion is taken at the reporter's own sink — the
 * next module along — rather than on a spy standing in for it.
 *
 * `window` is stubbed because the method reads `window.location.pathname` for
 * the route, and a node environment has no window. It is restored after.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "./ErrorBoundary";
import {
  registerClientErrorSink,
  resetClientErrorReporterForTests,
  startClientErrorReporting,
  type ClientErrorContext,
} from "@/monitoring/errorReporter";

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

/** What React hands `componentDidCatch` — the field, and nothing else of ours. */
const COMPONENT_STACK = "\n    at RollSheet\n    at CastingStudio\n    at ErrorBoundary";

interface Reported {
  error: unknown;
  context: ClientErrorContext;
}

/**
 * A boundary instance without a React tree. The constructor takes props and
 * sets state; neither touches the DOM, so this is the real object.
 */
function boundary(): {
  componentDidCatch: (error: Error, errorInfo: { componentStack?: string | null }) => void;
} {
  const Boundary = ErrorBoundary as unknown as new (props: unknown) => {
    componentDidCatch: (error: Error, errorInfo: { componentStack?: string | null }) => void;
  };
  return new Boundary({ children: null });
}

let reported: Reported[];
let previousWindow: unknown;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetClientErrorReporterForTests();
  vi.stubEnv("VITE_SENTRY_DSN", DSN);

  previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { pathname: "/casting" } };

  /* The method logs the crash before reporting it, which is correct and would
     otherwise print a wall of red under a passing suite. */
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  reported = [];
  /* The reporter is armed the way `main.tsx` arms it, then handed a sink in
     place of the lazy half — so what is read below is what the tracker would
     have been given. */
  startClientErrorReporting(
    { addEventListener: () => {}, removeEventListener: () => {} },
    () => {},
    (() => {}) as never,
  );
  registerClientErrorSink((error, context) => {
    reported.push({ error, context });
  });
});

afterEach(() => {
  consoleError.mockRestore();
  if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = previousWindow;
  resetClientErrorReporterForTests();
  vi.unstubAllEnvs();
});

describe("⚠ a boundary-caught render crash reports WHICH PART OF THE TREE was rendering", () => {
  it("passes React's component stack on, beside the route and the kind", () => {
    const error = new Error("Cannot read properties of null (reading 'name')");
    boundary().componentDidCatch(error, { componentStack: COMPONENT_STACK });

    expect(reported).toHaveLength(1);
    expect(reported[0]?.error).toBe(error);
    expect(reported[0]?.context).toEqual({
      kind: "render",
      route: "/casting",
      componentStack: COMPONENT_STACK,
    });
  });

  it("⚠ sends `undefined` rather than `null` when React has no stack to give", () => {
    /* React's `ErrorInfo.componentStack` is typed `string | null`, and `null`
       would reach the scope as a react context carrying nothing — the scrub
       drops it, but the honest shape is to never set it. The `?? undefined` in
       the call site is what this arm holds in place. */
    boundary().componentDidCatch(new Error("boom"), { componentStack: null });
    expect(reported[0]?.context.componentStack).toBeUndefined();
    expect(reported[0]?.context).toMatchObject({ kind: "render", route: "/casting" });
  });

  it("still reports the crash itself when there is no stack at all", () => {
    boundary().componentDidCatch(new Error("boom"), {});
    expect(reported).toHaveLength(1);
    expect(reported[0]?.context.kind).toBe("render");
  });

  it("names the page it was rendering, which a window error's route cannot be read from later", () => {
    (globalThis as { window?: unknown }).window = { location: { pathname: "/boards/17" } };
    boundary().componentDidCatch(new Error("boom"), { componentStack: COMPONENT_STACK });
    expect(reported[0]?.context.route).toBe("/boards/17");
  });
});
