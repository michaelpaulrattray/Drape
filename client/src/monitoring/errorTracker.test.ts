/**
 * THE BROWSER TRACKER'S WIRE CONTRACT (#509 part 1b).
 *
 * Invariant 5 — *"Assert at the wire. Contracts about what gets sent are proven
 * on the outgoing request, not on a constant near it."* Every claim the module's
 * header makes is a claim about the object handed to `init`, so these arms drive
 * `buildClientTrackerOptions()` itself. The two that matter most are the ones
 * that would each ship a leak wearing a promise:
 *
 *   · **`BrowserSession` is dropped.** A session envelope does NOT pass
 *     `beforeSend` and on a browser it carries the real user agent. The server
 *     half found that class on its own `ProcessSession` and left a written
 *     instruction to RE-DECIDE it here rather than inherit the answer.
 *   · **`beforeSend` IS the scrub.** Not a function that resembles it — an arm
 *     that put a forbidden key through and watched the whole event refuse.
 *
 * ⚠ **`Console` IS DROPPED FOR COST, NOT FOR SAFETY, AND THE ARMS SAY WHICH.**
 * Everything it produces carries `category: "console"`, which the scrub discards
 * on the category alone — so there is an arm proving the crumb cannot travel
 * whether the integration runs or not, beside the arm proving we do not run it.
 * Conflating the two would make a cost decision look like a control.
 *
 * The suite runs in a node environment (`vitest.config.ts`), which is why nothing
 * here starts a real SDK: `startClientErrorTracker` needs a browser, and what it
 * would prove is the options object these arms already read. The envelope-level
 * reading — what the SDK stamps on after the gate returns — was taken once on the
 * server half through a fake transport and is recorded in both headers.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFUSING_KEYS } from "@shared/errorEventScrub";

import { resetClientErrorReporterForTests } from "./errorReporter";
import {
  DROPPED_DEFAULT_INTEGRATIONS,
  bootLineFor,
  buildClientTrackerOptions,
  captureClientError,
  clientErrorTrackerStatus,
  resetClientErrorTrackerForTests,
  setClientErrorUser,
} from "./errorTracker";

const DSN = "https://publickey@o1.ingest.de.sentry.io/2";

/** The twelve `@sentry/browser@11.0.0` ships, read off `getDefaultIntegrations({})`. */
const SDK_DEFAULTS = [
  "EventFilters",
  "FunctionToString",
  "ConversationId",
  "BrowserApiErrors",
  "Breadcrumbs",
  "Console",
  "GlobalHandlers",
  "LinkedErrors",
  "Dedupe",
  "HttpContext",
  "CultureContext",
  "BrowserSession",
].map((name) => ({ name }));

beforeEach(() => {
  resetClientErrorTrackerForTests();
  resetClientErrorReporterForTests();
  vi.stubEnv("VITE_SENTRY_DSN", DSN);
});

afterEach(() => {
  resetClientErrorTrackerForTests();
  resetClientErrorReporterForTests();
  vi.unstubAllEnvs();
});

describe("the options handed to the SDK — asserted on the object, not beside it", () => {
  it("carries the DSN from the one reader, and the build's own mode as the world", () => {
    const options = buildClientTrackerOptions();
    expect(options.dsn).toBe(DSN);
    expect(options.environment).toBe(import.meta.env.MODE);
  });

  it("traces nothing", () => {
    expect(buildClientTrackerOptions().tracesSampleRate).toBe(0);
  });

  it("collects no cookies, no headers, no query strings, no bodies and no frame locals", () => {
    const { dataCollection } = buildClientTrackerOptions();
    expect(dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      httpBodies: [],
      stackFrameVariables: false,
    });
  });

  it("⚠ sends no option the SDK stopped reading — `sendDefaultPii` is not here", () => {
    /* The server half shipped it for a day and the SDK read it never; the whole
       finding is in this module's header and in
       `server/errorTrackerOptionsDeclared.test.ts`, which holds both halves
       against the installed SDK's own code. */
    expect(buildClientTrackerOptions()).not.toHaveProperty("sendDefaultPii");
  });
});

describe("⚠ THE SESSION ENVELOPE IS CLOSED — the one channel that bypasses the scrub", () => {
  it("drops `BrowserSession` from the SDK's own default list", () => {
    const kept = buildClientTrackerOptions().integrations(SDK_DEFAULTS).map((it) => it.name);
    expect(kept).not.toContain("BrowserSession");
  });

  it("keeps everything it has no reason to drop — the filter is narrow, not a purge", () => {
    const kept = buildClientTrackerOptions().integrations(SDK_DEFAULTS).map((it) => it.name);
    for (const name of [
      "EventFilters",
      "FunctionToString",
      "BrowserApiErrors",
      "Breadcrumbs",
      "GlobalHandlers",
      "LinkedErrors",
      "Dedupe",
      "HttpContext",
      "CultureContext",
    ]) {
      expect(kept, `${name} should still run`).toContain(name);
    }
    expect(kept).toHaveLength(SDK_DEFAULTS.length - DROPPED_DEFAULT_INTEGRATIONS.length);
  });

  it("names exactly the two it drops, so a third cannot arrive unremarked", () => {
    expect([...DROPPED_DEFAULT_INTEGRATIONS].sort()).toEqual(["BrowserSession", "Console"]);
  });

  it("passes an unfamiliar future default straight through", () => {
    const kept = buildClientTrackerOptions()
      .integrations([{ name: "SomethingTheSdkAddsLater" }])
      .map((it) => it.name);
    expect(kept).toEqual(["SomethingTheSdkAddsLater"]);
  });
});

describe("`Console` is dropped for COST — and the crumb could not travel either way", () => {
  it("is not in the kept list", () => {
    expect(buildClientTrackerOptions().integrations(SDK_DEFAULTS).map((it) => it.name)).not.toContain(
      "Console",
    );
  });

  it("⚠ and its crumb is refused by CATEGORY, so running it would leak nothing", () => {
    /* The shape that integration produces, read at its source: a `console`
       category, the formatted message, and the raw arguments. This product's
       client logs `console.error("[API Query Error]", error)` on every failed
       query, so this is the exact crumb at stake. */
    const kept = buildClientTrackerOptions().beforeBreadcrumb({
      category: "console",
      level: "error",
      message: "[API Query Error] her brief was refused: <her words>",
      data: { arguments: ["[API Query Error]", { detail: "her words" }], logger: "console" },
    });
    expect(kept).toBeNull();
  });
});

describe("`beforeSend` IS the scrub, driven rather than believed", () => {
  it("refuses a whole event carrying ANY of the recipe keys", () => {
    const { beforeSend } = buildClientTrackerOptions();
    for (const key of REFUSING_KEYS) {
      const event = {
        event_id: "abc",
        exception: { values: [{ type: "Error", value: "broke" }] },
        extra: { [key]: "the customer's own work" },
      };
      expect(beforeSend(event), `an event carrying ${key} must refuse`).toBeNull();
    }
    expect(clientErrorTrackerStatus().refused).toBe(REFUSING_KEYS.length);
  });

  it("projects a clean event down to the allowlist and counts it sent", () => {
    const sent = buildClientTrackerOptions().beforeSend({
      event_id: "abc",
      level: "error",
      exception: { values: [{ type: "TypeError", value: "Cannot read properties of null" }] },
      user: { id: "1", email: "founder@example.com", ip_address: "203.0.113.4" },
      tags: { route: "/casting", world: "production", somethingElse: "dropped" },
      request: { method: "POST", url: "https://klieglabs.com/api/trpc?input=%7B%7D" },
      /* Two fields a future SDK version might attach. Neither is named by the
         projection, so neither can travel — that is invariant 8's whole point. */
      server_name: "a machine name",
      contexts: { culture: { locale: "en-AU" }, trace: { trace_id: "t1", span_id: "s1" } },
    });

    expect(sent).toEqual({
      event_id: "abc",
      level: "error",
      exception: { values: [{ type: "TypeError", value: "Cannot read properties of null" }] },
      user: { id: "1" },
      tags: { route: "/casting", world: "production" },
      request: { method: "POST", url: "https://klieglabs.com/api/trpc" },
      contexts: { trace: { trace_id: "t1", span_id: "s1" } },
    });
    expect(clientErrorTrackerStatus().sent).toBe(1);
  });

  it("keeps the two prose-carrying crumb categories out and the useful ones in", () => {
    const { beforeBreadcrumb } = buildClientTrackerOptions();
    expect(beforeBreadcrumb({ category: "ui.click", message: "her sentence, typed into the brief box" })).toBeNull();
    expect(beforeBreadcrumb({ category: "sentry.transaction" })).toBeNull();
    expect(
      beforeBreadcrumb({
        category: "navigation",
        message: "should not travel",
        data: { from: "/casting", to: "/boards" },
      }),
    ).toEqual({ category: "navigation", data: { from: "/casting", to: "/boards" } });
    expect(
      beforeBreadcrumb({
        category: "fetch",
        data: { method: "POST", url: "https://klieglabs.com/api/trpc?input=%7B%7D", status_code: 500 },
      }),
    ).toEqual({
      category: "fetch",
      data: { method: "POST", url: "https://klieglabs.com/api/trpc", status_code: 500 },
    });
  });

  it("counts a refused crumb apart from a refused event", () => {
    const { beforeBreadcrumb } = buildClientTrackerOptions();
    expect(beforeBreadcrumb({ category: "fetch", data: { url: "/api/trpc", brief: "her words" } })).toBeNull();
    expect(clientErrorTrackerStatus()).toMatchObject({ refusedBreadcrumbs: 1, refused: 0 });
  });
});

describe("the line a reader sees — both branches reachable (working law 2)", () => {
  it("says errors are reported nowhere when the tracker never came up", () => {
    expect(bootLineFor({ ready: false })).toContain("VITE_SENTRY_DSN is not set");
    expect(bootLineFor({ ready: false })).not.toContain("reporting to Sentry");
  });

  it("names Sentry and the world only once it is actually ready", () => {
    expect(bootLineFor({ ready: true }, "production")).toBe(
      "[Errors] browser errors reporting to Sentry · production",
    );
  });

  it("reads the module's own state as not-ready before anything starts", () => {
    expect(clientErrorTrackerStatus().ready).toBe(false);
  });
});

describe("nothing throws before the SDK exists", () => {
  it("reports and identifies as no-ops rather than crashes", () => {
    expect(() => captureClientError(new Error("too early"), { route: "/casting" })).not.toThrow();
    expect(() => captureClientError("a string reason")).not.toThrow();
    expect(() => setClientErrorUser("1")).not.toThrow();
    expect(() => setClientErrorUser(null)).not.toThrow();
    expect(clientErrorTrackerStatus().sent).toBe(0);
  });
});

/**
 * ⚠ THE 111 kB ARM — the one a later tidy-up would undo (#509 part 1b).
 *
 * MEASURED on the real build, both ways, before this arm existed:
 *
 * | how the SDK is imported | the lazy chunk, gzip | what it carried |
 * |---|---|---|
 * | `const mod = await import("@sentry/browser")` | **142.5 kB** | Session Replay (`rrweb`, `recordCanvas`), the Feedback widget (`createWidget`, "Report a Bug"), Tracing, Profiling |
 * | `const { init, … } = await import("@sentry/browser")` | **31.1 kB** | the twelve default integrations, the envelope, `discarded_events` — and none of the above |
 *
 * The package declares `sideEffects: false`, so it is shakeable; binding the
 * whole NAMESPACE is what stops the shaking, because every export then has to
 * exist on that object. The namespace form is also the tidier-looking one and it
 * is what the server half does — correctly, since a server's bundle is nobody's
 * download — so this is a change somebody will one day "simplify" back.
 *
 * **First paint is untouched either way (260.4 kB against a 290 kB budget), which
 * is exactly why the gate cannot see this**: `bundle-budget` measures what the
 * browser fetches BEFORE paint, and 111 kB of dead library in a chunk every
 * customer downloads AFTER paint is invisible to it. A post-paint chunk budget is
 * filed rather than built here.
 *
 * So the arm reads this module's own source. A text arm is a weak instrument and
 * its weakness is bounded here: the predicate is driven over both real forms
 * first, so it is known to tell them apart rather than merely to pass.
 */
describe("⚠ the SDK is imported DESTRUCTURED, which is worth 111 kB of every customer's bandwidth", () => {
  const NAMESPACE_FORM = 'const mod = await import("@sentry/browser");';
  const DESTRUCTURED_FORM = 'const { init, withScope } = await import("@sentry/browser");';

  /** Is a `@sentry/browser` dynamic import in this text bound as a namespace? */
  const bindsNamespace = (source: string): boolean =>
    /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+import\(\s*["']@sentry\/browser["']/.test(source);

  const bindsDestructured = (source: string): boolean =>
    /(?:const|let|var)\s*\{[^}]*\}\s*=\s*await\s+import\(\s*["']@sentry\/browser["']/.test(source);

  it("POSITIVE and NEGATIVE control: the predicates tell the two real forms apart", () => {
    expect(bindsNamespace(NAMESPACE_FORM)).toBe(true);
    expect(bindsDestructured(NAMESPACE_FORM)).toBe(false);
    expect(bindsNamespace(DESTRUCTURED_FORM)).toBe(false);
    expect(bindsDestructured(DESTRUCTURED_FORM)).toBe(true);
  });

  it("this module destructures, and binds no namespace", () => {
    /* A FIXED path that must exist — deliberately NOT `readListedSource`, whose
       ENOENT tolerance is for tree WALKS where a file can vanish between the
       list and the read. Here a missing file means the module moved, and this
       arm must go red rather than quiet. */
    const source = readFileSync(
      fileURLToPath(new URL("./errorTracker.ts", import.meta.url)),
      "utf8",
    );
    /* The header quotes the namespace form as the thing NOT to do, so the
       predicate is run over the code with comment lines removed. */
    const code = source
      .split(/\r?\n/)
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
      .join("\n");

    expect(code).toContain('await import("@sentry/browser")');
    expect(bindsDestructured(code)).toBe(true);
    expect(bindsNamespace(code)).toBe(false);
  });
});
