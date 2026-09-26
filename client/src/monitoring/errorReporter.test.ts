/**
 * THE PRE-PAINT WINDOW'S OWN ARMS (#509 part 1b).
 *
 * The thing this module exists for cannot be tested by asserting that a function
 * was called: it is an ORDER. The browser throws during the first render, no
 * transport exists yet, and the error has to still be in hand when one arrives.
 * So the arms drive the real sequence — install, throw, hand off, replay — and
 * the ones worth reading are the four that could each ship a reporter that looks
 * fine and reports nothing:
 *
 *   · a pre-paint error is REMEMBERED (not dropped, which is the naive wiring);
 *   · it is REPLAYED once a sink exists (not remembered forever);
 *   · the pre-paint listeners come DOWN at handoff (or every window error is
 *     reported twice, by us and by the SDK's own global handlers);
 *   · with no DSN nothing is installed and nothing is remembered, and the state
 *     says so rather than reading like a healthy reporter with no errors.
 *
 * ⚠ **NO MOCK OF A WINDOW.** `installGlobalErrorCapture` takes a target so the
 * arms can hand it a real `EventTarget` and dispatch real events through it — the
 * suite runs in a node environment (`vitest.config.ts`), so a DOM is not
 * available, but an event dispatcher is, and it is the dispatch that carries the
 * claim. A hand-rolled `{ addEventListener: vi.fn() }` would let a broken
 * listener pass.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRELOAD_BUFFER_CAP,
  SUPPRESSED_MESSAGE_SUBSTRINGS,
  clientErrorReporterState,
  clientSentryDsn,
  installGlobalErrorCapture,
  isSuppressedErrorMessage,
  registerClientErrorSink,
  reportClientError,
  resetClientErrorReporterForTests,
  startClientErrorReporting,
  type ClientErrorContext,
} from "./errorReporter";

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

/** A real dispatcher with the two events the reporter listens for. */
function realTarget(): EventTarget & { fireError(error: unknown): void; fireRejection(reason: unknown): void } {
  const target = new EventTarget();
  return Object.assign(target, {
    fireError(error: unknown) {
      const event = new Event("error") as Event & { error?: unknown };
      event.error = error;
      target.dispatchEvent(event);
    },
    fireRejection(reason: unknown) {
      const event = new Event("unhandledrejection") as Event & { reason?: unknown };
      event.reason = reason;
      target.dispatchEvent(event);
    },
  });
}

/** A sink that records what it was handed, standing in for the loaded SDK. */
function recordingSink(): { calls: { error: unknown; context: ClientErrorContext }[]; sink: (e: unknown, c: ClientErrorContext) => void } {
  const calls: { error: unknown; context: ClientErrorContext }[] = [];
  return { calls, sink: (error, context) => calls.push({ error, context }) };
}

beforeEach(() => {
  resetClientErrorReporterForTests();
  vi.stubEnv("VITE_SENTRY_DSN", DSN);
});

afterEach(() => {
  resetClientErrorReporterForTests();
  vi.unstubAllEnvs();
});

describe("the noise the app already swallows is one declaration (working law 4)", () => {
  it("recognises the ResizeObserver burst, wherever it sits in the message", () => {
    expect(isSuppressedErrorMessage("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isSuppressedErrorMessage("Uncaught Error: ResizeObserver loop limit exceeded")).toBe(true);
  });

  it("does not recognise anything else, including the near miss", () => {
    expect(isSuppressedErrorMessage("ResizeObserver is not defined")).toBe(false);
    expect(isSuppressedErrorMessage("Cannot read properties of null")).toBe(false);
    expect(isSuppressedErrorMessage("")).toBe(false);
    expect(isSuppressedErrorMessage(undefined)).toBe(false);
    expect(isSuppressedErrorMessage(new Error("ResizeObserver loop"))).toBe(false);
  });

  it("is the same string `main.tsx` suppresses — one list, non-empty", () => {
    expect(SUPPRESSED_MESSAGE_SUBSTRINGS).toContain("ResizeObserver loop");
    expect(SUPPRESSED_MESSAGE_SUBSTRINGS.length).toBeGreaterThan(0);
  });
});

describe("the DSN is read in one place", () => {
  it("trims it, and reads absent and blank alike as no DSN", () => {
    vi.stubEnv("VITE_SENTRY_DSN", `  ${DSN}  `);
    expect(clientSentryDsn()).toBe(DSN);
    vi.stubEnv("VITE_SENTRY_DSN", "   ");
    expect(clientSentryDsn()).toBe("");
    vi.stubEnv("VITE_SENTRY_DSN", "");
    expect(clientSentryDsn()).toBe("");
  });
});

describe("⚠ WITH NO DSN THERE IS NO REPORTER, AND IT SAYS SO (invariant 7)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
  });

  it("installs no listener and never imports the transport", () => {
    const target = realTarget();
    const load = vi.fn();
    const schedule = vi.fn();

    startClientErrorReporting(target, schedule, load as never);

    expect(schedule).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    /* And the listener is genuinely absent, proven by dispatching through the
       real target rather than by trusting the flag. */
    target.fireError(new Error("nobody is listening"));
    expect(clientErrorReporterState().buffered).toBe(0);
  });

  it("answers `configured: false`, so no surface may draw a number over it", () => {
    startClientErrorReporting(realTarget(), vi.fn(), vi.fn() as never);
    expect(clientErrorReporterState().configured).toBe(false);
  });

  it("makes `reportClientError` inert rather than a growing buffer", () => {
    reportClientError(new Error("from a boundary, with no tracker configured"));
    expect(clientErrorReporterState()).toMatchObject({ buffered: 0, suppressed: 0, overflowed: 0 });
  });
});

describe("the pre-paint window — remembered, then replayed", () => {
  it("⚠ REMEMBERS an uncaught error thrown before the transport exists", () => {
    const target = realTarget();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    target.fireError(new Error("thrown inside the first render"));
    target.fireRejection(new Error("a promise nobody caught"));

    expect(clientErrorReporterState().buffered).toBe(2);
  });

  it("⚠ REPLAYS them through the sink, oldest first, and empties the buffer", () => {
    const target = realTarget();
    const { calls, sink } = recordingSink();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    target.fireError(new Error("first"));
    target.fireError(new Error("second"));
    registerClientErrorSink(sink);

    expect(calls.map((call) => (call.error as Error).message)).toEqual(["first", "second"]);
    expect(calls.map((call) => call.context.kind)).toEqual(["window.error", "window.error"]);
    expect(clientErrorReporterState()).toMatchObject({ buffered: 0, replayed: 2, handedOff: true });
  });

  it("carries a rejection's reason, not the event", () => {
    const target = realTarget();
    const { calls, sink } = recordingSink();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    target.fireRejection("a string rejection, which this app does receive");
    registerClientErrorSink(sink);

    expect(calls[0]?.error).toBe("a string rejection, which this app does receive");
    expect(calls[0]?.context.kind).toBe("unhandledrejection");
  });

  it("⚠ TAKES THE LISTENERS DOWN at handoff — or every window error is reported twice", () => {
    const target = realTarget();
    const { calls, sink } = recordingSink();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);
    registerClientErrorSink(sink);

    /* From here the SDK's own GlobalHandlers owns `window.onerror`. Ours must be
       gone, so this dispatch must reach the sink ZERO times. */
    target.fireError(new Error("after the SDK took over"));

    expect(calls).toEqual([]);
  });

  it("routes a later boundary report straight to the sink, with no buffering", () => {
    const { calls, sink } = recordingSink();
    startClientErrorReporting(realTarget(), vi.fn(), vi.fn() as never);
    registerClientErrorSink(sink);

    reportClientError(new Error("render crash after the tracker loaded"), {
      kind: "render",
      route: "/casting",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.context).toEqual({ kind: "render", route: "/casting" });
    expect(clientErrorReporterState().buffered).toBe(0);
  });

  it("never remembers the suppressed burst, before or after handoff", () => {
    const target = realTarget();
    const { calls, sink } = recordingSink();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    target.fireError(new Error("ResizeObserver loop completed with undelivered notifications."));
    expect(clientErrorReporterState()).toMatchObject({ buffered: 0, suppressed: 1 });

    registerClientErrorSink(sink);
    reportClientError(new Error("ResizeObserver loop limit exceeded"));
    expect(calls).toEqual([]);
    expect(clientErrorReporterState().suppressed).toBe(2);
  });

  it("⚠ is BOUNDED — a render loop throwing forever must not grow the page's memory", () => {
    const target = realTarget();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    for (let i = 0; i < PRELOAD_BUFFER_CAP + 5; i += 1) target.fireError(new Error(`throw ${i}`));

    expect(clientErrorReporterState()).toMatchObject({
      buffered: PRELOAD_BUFFER_CAP,
      overflowed: 5,
    });
  });

  it("keeps the FIRST errors rather than the last — in a loop they are the same one", () => {
    const target = realTarget();
    const { calls, sink } = recordingSink();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    for (let i = 0; i < PRELOAD_BUFFER_CAP + 3; i += 1) target.fireError(new Error(`throw ${i}`));
    registerClientErrorSink(sink);

    expect((calls[0]?.error as Error).message).toBe("throw 0");
    expect(calls).toHaveLength(PRELOAD_BUFFER_CAP);
  });

  it("survives a sink that throws, and keeps replaying the rest", () => {
    const target = realTarget();
    const seen: string[] = [];
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);

    target.fireError(new Error("poison"));
    target.fireError(new Error("good"));
    registerClientErrorSink((error) => {
      const message = (error as Error).message;
      if (message === "poison") throw new Error("the sink broke");
      seen.push(message);
    });

    expect(seen).toEqual(["good"]);
    expect(clientErrorReporterState().replayed).toBe(1);
  });
});

describe("the transport is fetched after first paint, and never before", () => {
  it("does not load it synchronously — the scheduler is handed the work", async () => {
    const load = vi.fn().mockResolvedValue({ startClientErrorTracker: vi.fn().mockResolvedValue("ok") });
    let scheduled: (() => void) | null = null;

    startClientErrorReporting(realTarget(), (task) => { scheduled = task; }, load);

    expect(load).not.toHaveBeenCalled();
    expect(scheduled).toBeTypeOf("function");

    scheduled!();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it("⚠ a transport that cannot be fetched leaves the buffer HELD and the listeners UP", async () => {
    const target = realTarget();
    const load = vi.fn().mockRejectedValue(new Error("chunk 404 — an old tab after a deploy"));

    startClientErrorReporting(target, (task) => task(), load);
    await vi.waitFor(() => expect(load).toHaveBeenCalled());

    target.fireError(new Error("thrown after the chunk failed"));

    const state = clientErrorReporterState();
    expect(state.handedOff).toBe(false);
    expect(state.buffered).toBe(1);
  });

  it("arms itself once, however many times it is called", () => {
    const target = realTarget();
    const schedule = vi.fn();
    startClientErrorReporting(target, schedule, vi.fn() as never);
    startClientErrorReporting(target, schedule, vi.fn() as never);

    expect(schedule).toHaveBeenCalledTimes(1);
    /* And the second call did not install a second listener, which would double
       every buffered error. */
    target.fireError(new Error("once"));
    expect(clientErrorReporterState().buffered).toBe(1);
  });
});

describe("installGlobalErrorCapture's uninstaller actually uninstalls", () => {
  it("stops reporting once called, proven through the real dispatcher", () => {
    const target = realTarget();
    startClientErrorReporting(target, vi.fn(), vi.fn() as never);
    const uninstall = installGlobalErrorCapture(target);

    target.fireError(new Error("two listeners now"));
    expect(clientErrorReporterState().buffered).toBe(2);

    uninstall();
    target.fireError(new Error("one listener now"));
    expect(clientErrorReporterState().buffered).toBe(3);
  });
});
