/**
 * ⚠ THE BOUNDARY REPORTS, AND THE ENTRY POINT CALLS THE REPORTER (#509 part 1b).
 *
 * These two claims are the whole difference between this change working and being
 * dead code, and neither was covered by the wire-contract arms next door:
 *
 *   1. **`ErrorBoundary.componentDidCatch` hands the error to the reporter.** This
 *      is the most valuable line in the browser half. React sends an error it
 *      could NOT give to a boundary through `window.onerror`, where the SDK's own
 *      global handler sees it; one a boundary DOES catch goes to `onCaughtError`,
 *      whose default is a console line. `App.tsx` wraps the whole app in this
 *      component, so until this change every render crash in the product — React
 *      #310 among them, which has happened here — reached nobody at all.
 *      ⚠ **And since #1420 it hands over the COMPONENT STACK with it**, which is
 *      the only thing in the report that says which part of the tree was
 *      rendering — the error's own stack names React's internals. The arm below
 *      asserted the exact opposite until that card, correctly, and carries the
 *      reason the answer moved.
 *   2. **`main.tsx` actually calls `startClientErrorReporting`.** Invariant 7: a
 *      control that is not invoked does not exist, and this repository has paid
 *      for that four times on the Crew page alone.
 *
 * ⚠ **THE BOUNDARY IS DRIVEN, NOT GREPPED.** Component RENDERING is deliberately
 * outside `pnpm test` (`vitest.config.ts`), but `componentDidCatch` is an ordinary
 * method: the arm constructs the real component and calls the real method with the
 * real arguments React passes. No DOM is needed because nothing is rendered.
 *
 * `main.tsx` is the one claim here that IS a text read, because it is a module
 * whose whole body is side effects — importing it would build a React root. Its
 * weakness is bounded the only way a text arm's can be: the predicates are driven
 * over both answers first, so they are known to tell them apart.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clientErrorReporterState,
  registerClientErrorSink,
  resetClientErrorReporterForTests,
  startClientErrorReporting,
  type ClientErrorContext,
} from "../monitoring/errorReporter";

import ErrorBoundary from "./ErrorBoundary";

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

/** What React hands `componentDidCatch` as its second argument. */
const REACT_ERROR_INFO = {
  componentStack: "\n    at CastingV2 (/src/pages/CastingV2.tsx:41:7)\n    at App",
} as React.ErrorInfo;

let restoreWindow: (() => void) | null = null;

beforeEach(() => {
  resetClientErrorReporterForTests();
  vi.stubEnv("VITE_SENTRY_DSN", DSN);
  /* The boundary reads `window.location.pathname` for the route. A node worker
     has no window, so one is provided for the duration of the arm — a real
     object, not a mock of the code under test. */
  const had = "window" in globalThis;
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { pathname: "/casting" } };
  restoreWindow = () => {
    if (had) (globalThis as { window?: unknown }).window = previous;
    else delete (globalThis as { window?: unknown }).window;
  };
  /* Silence the boundary's own console line; the arms are about the report. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  restoreWindow?.();
  restoreWindow = null;
  resetClientErrorReporterForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("⚠ a render crash the boundary catches reaches the tracker", () => {
  function catchOne(error: Error): { error: unknown; context: ClientErrorContext }[] {
    const calls: { error: unknown; context: ClientErrorContext }[] = [];
    startClientErrorReporting(new EventTarget(), vi.fn(), vi.fn() as never);
    registerClientErrorSink((thrown, context) => calls.push({ error: thrown, context }));

    const boundary = new ErrorBoundary({ children: null });
    boundary.componentDidCatch(error, REACT_ERROR_INFO);
    return calls;
  }

  it("hands over the error itself, tagged as a render with the page it was on", () => {
    const error = new Error("Rendered more hooks than during the previous render.");
    const calls = catchOne(error);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.error).toBe(error);
    expect(calls[0]?.context).toEqual({
      kind: "render",
      route: "/casting",
      componentStack: REACT_ERROR_INFO.componentStack,
    });
  });

  /**
   * ⚠ **THIS ARM READ `does NOT pass React's component stack` UNTIL #1420, AND
   * THE REVERSAL IS THE POINT OF THAT CARD.**
   *
   * It was right when it was written: `shared/errorEventScrub.ts`'s projection
   * had no field for the component stack, so passing one could not have
   * travelled — and giving it a field is a widening of what leaves the building,
   * which #1418 filed rather than smuggled in beside a wiring change. The field
   * exists now (`contexts.react.componentStack`, the key Sentry's own React
   * integration uses), with its own arms in `server/errorEventScrub.test.ts`
   * proving what it redacts, caps and refuses.
   *
   * So this is now the arm that holds the link NOTHING ELSE covers: the scrub
   * proves the stack MAY travel and `client/src/monitoring/errorTracker.test.ts`
   * proves `captureClientError` puts it on the scope, but neither can see
   * whether the one call site that HAS the stack passes it. Invariant 7 pointed
   * at a data path instead of a protection.
   */
  it("⚠ passes React's component stack — the field this call site exists for", () => {
    const calls = catchOne(new Error("boom"));
    expect(calls[0]?.context.componentStack).toBe(REACT_ERROR_INFO.componentStack);
    /* The error's own stack names React's internals and no component of ours;
       this is the only thing that says WHICH PART OF THE TREE was rendering. */
    expect(calls[0]?.context.componentStack).toContain("CastingV2");
  });

  it("⚠ sends `undefined` rather than `null` when React has no stack to give", () => {
    /* `ErrorInfo.componentStack` is typed `string | null`, and a `null` would
       reach the scope as a react context carrying nothing. The scrub drops it
       either way; the honest shape is never to set it, which is what the
       `?? undefined` at the call site is for. */
    const calls: { error: unknown; context: ClientErrorContext }[] = [];
    startClientErrorReporting(new EventTarget(), vi.fn(), vi.fn() as never);
    registerClientErrorSink((thrown, context) => calls.push({ error: thrown, context }));

    new ErrorBoundary({ children: null }).componentDidCatch(new Error("boom"), {
      componentStack: null,
    } as React.ErrorInfo);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.context.componentStack).toBeUndefined();
    expect(calls[0]?.context).toMatchObject({ kind: "render", route: "/casting" });
  });

  it("still logs to the console — the existing behaviour is added to, not replaced", () => {
    catchOne(new Error("boom"));
    expect(console.error).toHaveBeenCalled();
  });

  it("buffers the crash when the transport has not loaded — the first-render case", () => {
    startClientErrorReporting(new EventTarget(), vi.fn(), vi.fn() as never);
    new ErrorBoundary({ children: null }).componentDidCatch(new Error("first render"), REACT_ERROR_INFO);
    expect(clientErrorReporterState().buffered).toBe(1);
  });

  it("reports nothing at all with no DSN, and does not throw", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    startClientErrorReporting(new EventTarget(), vi.fn(), vi.fn() as never);
    expect(() =>
      new ErrorBoundary({ children: null }).componentDidCatch(new Error("boom"), REACT_ERROR_INFO),
    ).not.toThrow();
    expect(clientErrorReporterState()).toMatchObject({ configured: false, buffered: 0 });
  });
});

describe("⚠ the entry point invokes the reporter (invariant 7)", () => {
  const mainSource = (): string =>
    readFileSync(fileURLToPath(new URL("../main.tsx", import.meta.url)), "utf8");

  const callsStart = (source: string): boolean => /\bstartClientErrorReporting\s*\(/.test(source);
  const importsPredicate = (source: string): boolean =>
    /isSuppressedErrorMessage/.test(source) && /monitoring\/errorReporter/.test(source);

  it("POSITIVE and NEGATIVE control: the predicates tell a wired file from an unwired one", () => {
    const wired =
      'import { isSuppressedErrorMessage, startClientErrorReporting } from "@/monitoring/errorReporter";\nstartClientErrorReporting(window, s, l);';
    const unwired = 'const RO_MSG = "ResizeObserver loop";\ncreateRoot(el).render(<App />);';
    expect(callsStart(wired)).toBe(true);
    expect(importsPredicate(wired)).toBe(true);
    expect(callsStart(unwired)).toBe(false);
    expect(importsPredicate(unwired)).toBe(false);
  });

  it("calls it, and schedules the transport rather than loading it inline", () => {
    const source = mainSource();
    expect(callsStart(source)).toBe(true);
    /* The load is a thunk handed to the scheduler — `() => import(...)`. A bare
       `import('./monitoring/errorTracker')` in the body would put the SDK's fetch
       on the first-paint path, which is the one thing this design forbids. */
    expect(source).toMatch(/\(\)\s*=>\s*import\(['"]\.\/monitoring\/errorTracker['"]\)/);
  });

  it("⚠ schedules on the PAINT, not on a bare idle callback", () => {
    /* Measured on the production build: a bare `requestIdleCallback` fired 1.8 s
       BEFORE this app's first contentful paint, because the app waits on its own
       API and the main thread is idle during that wait. The scheduler that gets
       this right lives in `errorReporter.ts` with its own arms; what this holds
       is that the entry point uses IT rather than reaching for idle directly. */
    const source = mainSource();
    expect(source).toContain("afterFirstContentfulPaint");
    expect(source).not.toMatch(/window\s*\.\s*requestIdleCallback/);
    expect(source).not.toMatch(/requestIdleCallback\s*\(/);
  });

  it("⚠ reads the suppression list from the one declaration, and keeps no copy of the string", () => {
    const source = mainSource();
    expect(importsPredicate(source)).toBe(true);
    /* The literal lived here as `const RO_MSG = 'ResizeObserver loop'`. Two
       copies of one rule is the drift working law 4 is about, and the copy that
       would go stale is the tracker's — a tracker reporting that burst is a
       tracker nobody reads. */
    expect(source).not.toMatch(/RO_MSG\s*=/);
    expect(source).not.toContain("'ResizeObserver loop'");
    expect(source).not.toContain('"ResizeObserver loop"');
  });
});
