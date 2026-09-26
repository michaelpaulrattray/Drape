/**
 * THE BROWSER'S ERROR TRACKER — the LAZY half: the SDK, the scrub, and the
 * options handed to `init` (#509 part 1b).
 *
 * Nothing imports this module statically. `./errorReporter.ts` reaches it with
 * `import()` after first paint, which is what keeps `@sentry/browser` out of the
 * app's first download — see that file's header for the budget number. The
 * scrub is imported normally HERE, because here it is already in a lazy chunk.
 *
 * `shared/errorEventScrub.ts` is the CONTROL — what may leave the building and
 * what refuses — and it is the SAME module the server half uses, not a second
 * copy of the same rules (working law 4). This file decides only whether to
 * report at all, and what to attach.
 *
 * # WHAT IS DIFFERENT ABOUT A BROWSER, AND ALL THREE COST A DECISION
 *
 * **1 · RELEASE HEALTH IS OFF, AND IT IS OFF FOR A READING RATHER THAN BY
 * INHERITANCE.** The server half found, by driving the real SDK through a fake
 * transport and reading the ENVELOPE BYTES, that a `session` envelope goes out
 * beside every event and does NOT pass `beforeSend`; it dropped the
 * `ProcessSession` integration rather than qualify its promise. Its own note
 * says the browser must **re-decide** rather than inherit, so this was read at
 * the SDK's bytes rather than assumed:
 * `node_modules/@sentry/browser/…/integrations/browsersession.js` calls
 * `core.captureSession()` on load and again on every user change, and the
 * session it captures carries the browser's real `user_agent`. Sessions are
 * their own envelope type, so `beforeSend` never sees one. **`BrowserSession` is
 * therefore dropped from the defaults, and the answer is the same as the
 * server's for a stronger reason than the server had.**
 *
 * **2 · THE `Console` DEFAULT INTEGRATION IS DROPPED, AND NOT FOR SAFETY.** Read
 * at `@sentry/core/…/integrations/console.js`: everything it produces is a
 * breadcrumb with `category: "console"`, and `BREADCRUMB_CATEGORIES` does not
 * name that category, so **the scrub already discards every one of them** — this
 * page cannot leak through it. What it does is patch `console.*` globally and
 * build a crumb object on every call, and this product's client runs
 * `console.error("[API Query Error]", error)` on EVERY failed query. So it is
 * pure cost on a path that is already unhappy, in exchange for output that is
 * thrown away. ⚠ The scrub's own docblock says `console` is absent from that
 * list permanently and why (it carries the server's words back to us with no
 * field name near them), so this is not a channel that reopens later.
 *
 * **3 · `dataCollection`, NOT `sendDefaultPii` — AND THE SERVER HALF HAD THIS
 * WRONG.** See the law-7 note at the foot of this header.
 *
 * # NO TRACING, AS ON THE SERVER
 *
 * `tracesSampleRate: 0`. The card asks for errors; tracing is a second product
 * with its own quota and its own bill (the DT law's clause 3: name the price
 * beside the capability). On a browser it would also pull `browserTracing`'s
 * instrumentation of every fetch and every navigation into the chunk.
 *
 * # NO `release`, AND IT IS AN ABSENCE RATHER THAN AN OVERSIGHT
 *
 * The server tags events with `RAILWAY_GIT_COMMIT_SHA`, read at runtime. A
 * browser has no runtime access to it: it would have to be baked in at build
 * time, and **whether Railway's build step has that variable is a fact this
 * shift did not read**, so wiring a `release` from it would be a guess in the
 * one place a guess is least visible. It is also worth little alone — this
 * bundle is minified, so a stack trace is unreadable until SOURCE MAPS are
 * uploaded, and that is the change a release tag pays for. Both together are
 * one follow-up card, not a line here.
 *
 * # THE CHANNELS THAT DO NOT PASS THE SCRUB, ENUMERATED (the server's practice)
 *
 *   · `sendClientReports: true` — a count and a reason from Sentry's own fixed
 *     vocabulary (`{ reason: "before_send", category: "error", quantity: 1 }`).
 *     It carries nothing of ours and it is the only way a refusal is visible on
 *     Sentry's side as well as in our own console.
 *   · The SDK stamps its own `sdk` block onto the envelope AFTER `beforeSend`
 *     returns. It is the SDK naming itself; the server half measured it.
 *   · Sessions — closed, by dropping `BrowserSession` above.
 *   · Logs — there is no such option in this build: `enableLogs` has **0**
 *     declarations in `@sentry/core`'s `options.d.ts` at 11.0.0, so no log
 *     envelope exists to declare.
 *
 * # ⚠ THE LAW-7 SWEEP THAT CAME OUT OF WRITING THIS, AND IT IS THE PART TO READ
 *
 * The obvious move here was to copy the server's `sendDefaultPii: false`. Read
 * at the installed SDK first: **`sendDefaultPii` appears NOWHERE in `@sentry/core`,
 * `@sentry/node` or `@sentry/browser` at 11.0.0** — not in the implementation, and
 * **0 declarations** in `options.d.ts`. It was replaced by `dataCollection`,
 * whose defaults are all PERMISSIVE (`userInfo: true`, `cookies: true`,
 * `httpHeaders: { request: true, response: true }`, `urlQueryParams: true`,
 * `stackFrameVariables: true`). So the server's option is read by nothing, its
 * comment describing what it switches off is false, and
 * `server/errorTracker.test.ts` had a green arm asserting its value — a control
 * that is not invoked does not exist (invariant 7), with an instrument agreeing
 * with a constant beside it rather than with the SDK (working law 2).
 *
 * **Nothing leaked, and that is the projection earning its keep**: the scrub
 * REBUILDS the event from an allowlist, so cookies, headers, `user.email` and
 * frame `vars` were never in the outgoing bytes whatever the SDK collected. What
 * was lost was the SECOND of two independent reasons the server's docblock
 * claims for one outcome. Both halves now set `dataCollection` and neither sets
 * `sendDefaultPii`, and the class — **an SDK option carried over from an older
 * major version and believed to be a control** — is swept in the same commit.
 */
import { ASSETS_BASE_URL } from "@shared/const";
import {
  scrubBreadcrumb,
  scrubErrorEvent,
  type IncomingBreadcrumb,
  type IncomingEvent,
  type ScrubbedBreadcrumb,
} from "@shared/errorEventScrub";

import {
  clientSentryDsn,
  registerClientErrorSink,
  type ClientErrorContext,
} from "./errorReporter";

/**
 * ⚠ THE FOUR FUNCTIONS THIS MODULE USES, HELD ONE BY ONE RATHER THAN AS A
 * NAMESPACE — AND IT IS WORTH 105 kB OF EVERY CUSTOMER'S BANDWIDTH.
 *
 * The server half holds `typeof import("@sentry/node")` and calls through it,
 * which is right there: a server's bundle size is nobody's download. Copied here
 * it was measured as **142.5 kB gzip** in the lazy chunk, against an expectation
 * of about 30 — and the chunk carried `rrweb`, `recordCanvas`, `createWidget`
 * and `Report a Bug`, which is Session Replay and the User Feedback widget, two
 * products this app does not run.
 *
 * `@sentry/browser` declares `sideEffects: false`, so it is shakeable. What
 * defeats it is `const mod = await import("@sentry/browser")`: binding the whole
 * NAMESPACE means every export has to exist on that object, so the bundler must
 * keep all of them. Destructuring the four named functions at the import lets
 * Rollup shake the rest — measured, and the number is in this file's own arm.
 *
 * Typed structurally rather than as `typeof import(...)`: a namespace type would
 * re-introduce the whole surface as a TYPE, which is harmless at runtime and is
 * exactly the shape somebody would later "simplify" the destructuring back into.
 */
interface SentryFunctions {
  withScope: (callback: (scope: { setTag: (key: string, value: string) => void }) => void) => void;
  captureException: (error: unknown) => void;
  setUser: (user: { id: string } | null) => void;
}

interface TrackerState {
  /** The SDK is imported and `init` has returned. */
  ready: boolean;
  /** How many events the scrub refused — a wiring defect's own counter. */
  refused: number;
  /** How many BREADCRUMBS were refused, counted apart because they lose different amounts. */
  refusedBreadcrumbs: number;
  /** How many were handed to the SDK. */
  sent: number;
}

let sentry: SentryFunctions | null = null;
let starting: Promise<void> | null = null;
const state: TrackerState = { ready: false, refused: 0, refusedBreadcrumbs: 0, sent: 0 };

/**
 * The image bucket's origin, so the scrub can redact a customer's picture out of
 * an error message.
 *
 * DERIVED from `ASSETS_BASE_URL` rather than read from a second variable: that
 * constant is `R2_PUBLIC_URL` plus `/assets` by its own declaration in
 * `shared/const.ts` ("*the bucket in `R2_PUBLIC_URL`, so a mismatched bucket
 * gets blocked by the browser*"), so its origin IS the bucket's origin, and a
 * `VITE_` twin of the server's variable would be the parallel copy working law 4
 * is about.
 *
 * ⚠ Its limit, stated rather than left to be found: with no
 * `VITE_ASSETS_BASE_URL` set, that constant falls back to a hard-coded DEV
 * bucket, so on such a build this returns the wrong origin and the picture-URL
 * redaction does nothing. The other two redactions (a `data:` payload, a URL's
 * query string) are unaffected, and the scrub's own docblock already says the
 * whole of `redactFreeText` is a BOUND and not a proof.
 */
function imageOrigin(): string | undefined {
  try {
    return new URL(ASSETS_BASE_URL).origin;
  } catch {
    return undefined;
  }
}

/**
 * The scrub, wired as the SDK's last gate. `null` means the event never leaves
 * the browser — Sentry's own contract for a dropped event.
 *
 * A refusal is COUNTED and reported with the key's NAME and its path, never its
 * value: it means our own code attached a recipe field to an error report, which
 * is a defect to fix rather than an incident to hide.
 */
function gate(event: IncomingEvent): IncomingEvent | null {
  const verdict = scrubErrorEvent(event, imageOrigin());
  if (verdict.verdict === "refuse") {
    state.refused += 1;
    console.error(
      "[Errors] report REFUSED before send — a customer's recipe field was attached to it",
      { refusedKey: verdict.key, refusedPath: verdict.path },
    );
    return null;
  }
  state.sent += 1;
  return verdict.event as IncomingEvent;
}

/** The same gate for one crumb of the trail, wired as the SDK's retention hook. */
function breadcrumbGate(breadcrumb: IncomingBreadcrumb): ScrubbedBreadcrumb | null {
  const verdict = scrubBreadcrumb(breadcrumb, imageOrigin());
  if (verdict.verdict === "refuse") {
    state.refusedBreadcrumbs += 1;
    console.error(
      "[Errors] breadcrumb REFUSED before retention — a customer's recipe field was attached to it",
      { refusedKey: verdict.key, refusedPath: verdict.path },
    );
    return null;
  }
  return verdict.verdict === "keep" ? verdict.breadcrumb : null;
}

/** The integrations this product will not run, each with its reason in the header. */
export const DROPPED_DEFAULT_INTEGRATIONS: readonly string[] = ["BrowserSession", "Console"];

/**
 * EVERY OPTION THE SDK IS GIVEN, BUILT WHERE A TEST CAN READ IT.
 *
 * Invariant 5 — *"Assert at the wire. Contracts about what gets sent are proven
 * on the outgoing request, not on a constant near it."* The claims that matter
 * (the scrub IS the last gate; nothing is collected that the projection would
 * only drop later; no session envelope; nothing traced) are claims about the
 * object handed to `init`, so `client/src/monitoring/errorTracker.test.ts`
 * drives THIS function's result rather than restating the literals beside it.
 */
export function buildClientTrackerOptions(): {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  sendClientReports: boolean;
  dataCollection: {
    userInfo: boolean;
    cookies: boolean;
    httpHeaders: boolean;
    urlQueryParams: boolean;
    httpBodies: never[];
    stackFrameVariables: boolean;
  };
  integrations: (defaults: { name: string }[]) => { name: string }[];
  beforeBreadcrumb: (breadcrumb: IncomingBreadcrumb) => ScrubbedBreadcrumb | null;
  beforeSend: (event: IncomingEvent) => IncomingEvent | null;
} {
  return {
    dsn: clientSentryDsn(),
    /*
      THE BUILD'S MODE, NOT THE DEPLOY'S TAG, and the difference is real. The
      server reports `railway:production` because it reads the deploy's own
      environment at runtime; a bundle cannot, so this says what it honestly
      knows — which build produced it. Sentry groups on it either way.
    */
    environment: import.meta.env.MODE,
    /* Errors, not tracing — see the header. */
    tracesSampleRate: 0,
    /* Declared in the header as a channel that does not pass the gate. */
    sendClientReports: true,
    /*
      THE REAL v11 CONTROL (see the law-7 note in the header). Each of these is
      something the projection would drop at the wire anyway; switching them off
      here means it is never COLLECTED into this page's memory in the first
      place, which is the same argument `beforeBreadcrumb` makes for gating the
      trail at retention rather than only at send. Two independent reasons for
      one outcome is the point.
    */
    dataCollection: {
      /* `user.*` filled from instrumentation — the id is set deliberately below. */
      userInfo: false,
      /* Every cookie on this document, including `app_session_id`. */
      cookies: false,
      /* `User-Agent` and `Referer`, which `HttpContext` attaches by default. */
      httpHeaders: false,
      /* A query string is where ids, tokens and signatures travel. */
      urlQueryParams: false,
      /* Request and response BODIES. On this page the outgoing body of a tRPC
         call IS the customer's brief, so this is the one that matters most here
         even though nothing attaches a body with tracing off. */
      httpBodies: [],
      /* Every local in scope at the throw — on this product's roll path, the
         composed prompt itself. */
      stackFrameVariables: false,
    },
    integrations: (defaults) =>
      defaults.filter((it) => !DROPPED_DEFAULT_INTEGRATIONS.includes(it.name)),
    /*
      THE TRAIL, ALLOWED BY CATEGORY. It runs HERE so a customer's sentence is
      never held in this page's memory waiting for a crash, and again inside the
      projection so nothing depends on it having run.

      ⚠ The SDK also hands this hook a `hint` carrying the crumb's raw source —
      the DOM event, the XHR object, the console arguments. It is deliberately
      not a parameter: there is nothing in it this product wants, and a signature
      that cannot see it cannot come to read it.
    */
    beforeBreadcrumb: (breadcrumb) => breadcrumbGate(breadcrumb),
    beforeSend: (event) => gate(event),
  };
}

/**
 * Start the tracker and take over from the buffer. Safe to call twice; the
 * second call returns the first call's promise rather than initialising again.
 *
 * Returns the line describing what is now true, because a reader must be able to
 * tell "reporting" from "not reporting" without knowing which variables exist.
 * `errorReporter` prints it in dev only — a console line on every production
 * load would be noise in the one place customers can see it.
 */
export async function startClientErrorTracker(): Promise<string> {
  if (starting) {
    await starting;
    return bootLineFor(state);
  }
  if (clientSentryDsn().length === 0) return bootLineFor(state);

  starting = (async () => {
    /* DESTRUCTURED, never bound as a namespace — see `SentryFunctions` above for
       the 142.5 kB → 37.0 kB this is worth. */
    const { init, withScope, captureException, setUser } = await import("@sentry/browser");
    const options = buildClientTrackerOptions();
    init({
      /* SPREAD, never re-listed field by field: an option added to
         `buildClientTrackerOptions` must reach the SDK without anybody
         remembering to copy it here, or the tested object and the sent object
         become two lists that drift (working law 4). */
      ...options,
      /* TYPE adapters and nothing else. Sentry's `ErrorEvent` and `Breadcrumb`
         have no index signature, so neither is assignable to the scrub's
         deliberately structural `IncomingEvent`/`IncomingBreadcrumb` — the scrub
         is typed against the CONTRACT rather than against the SDK precisely so
         an SDK upgrade cannot widen what travels. The functions called here are
         the same objects the suite drives; only their declared types move. */
      beforeSend: (event) =>
        options.beforeSend(event as unknown as IncomingEvent) as unknown as typeof event | null,
      beforeBreadcrumb: (breadcrumb) =>
        options.beforeBreadcrumb(
          breadcrumb as unknown as IncomingBreadcrumb,
        ) as unknown as typeof breadcrumb | null,
    });
    sentry = { withScope, captureException, setUser } as unknown as SentryFunctions;
    state.ready = true;

    /* Only now, and this order matters: the sink replays the pre-paint buffer
       the moment it is registered, so registering before `init` returned would
       hand the first-render crash to an SDK that cannot send it. */
    registerClientErrorSink((error, context) => captureClientError(error, context));
  })();

  try {
    await starting;
  } catch (error) {
    /* A tracker that cannot start must not take the page with it — and must not
       look started either, which is what `ready` staying false is. The buffer
       keeps its contents and the pre-paint listeners stay up. */
    starting = null;
    console.warn("[Errors] the error tracker failed to start — errors are NOT being reported", error);
  }
  return bootLineFor(state);
}

/**
 * The line, as a PURE function of the state it describes, so both branches can
 * be driven. The server half's first attempt at this read the module's own state
 * and could therefore only ever reach ONE branch; it was titled as a control and
 * proved nothing, which is the shape working law 2 exists to catch.
 */
export function bootLineFor(tracker: Pick<TrackerState, "ready">, mode = import.meta.env.MODE): string {
  return tracker.ready
    ? `[Errors] browser errors reporting to Sentry · ${mode}`
    : "[Errors] VITE_SENTRY_DSN is not set — browser errors are logged locally and reported nowhere";
}

/**
 * Hand one error to the SDK with the two facts that make it actionable: which
 * account, and which page. Never throws.
 *
 * The route comes from the CALLER rather than from `window.location` here,
 * because by the time a render crash is reported the boundary knows the path it
 * was rendering and this module would be reading whatever the URL says now.
 */
export function captureClientError(error: unknown, context: ClientErrorContext = {}): void {
  try {
    if (!sentry || !state.ready) return;
    sentry.withScope((scope) => {
      if (context.route) scope.setTag("route", context.route);
      if (context.kind) scope.setTag("kind", context.kind);
      scope.setTag("world", import.meta.env.MODE);
      /* A non-Error reason (an unhandled rejection of a string, which this app
         does receive) is wrapped rather than stringified into a message, so it
         still carries a stack. */
      sentry?.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch (reportingError) {
    console.warn("[Errors] the tracker threw while reporting an error", reportingError);
  }
}

/**
 * Who is signed in, for the reports from here on. The scrub's projection keeps
 * `user.id` and nothing else — no email, no username, no IP — so this cannot
 * widen what travels however it is called.
 *
 * `null` clears it, which is what a sign-out must do: the next error belongs to
 * nobody, not to the account that used this tab before.
 */
export function setClientErrorUser(id: string | null): void {
  try {
    if (!sentry || !state.ready) return;
    sentry.setUser(id === null ? null : { id });
  } catch {
    /* Identifying a report must never break the page. */
  }
}

/** What any surface must ask before it draws a number. */
export function clientErrorTrackerStatus(): Readonly<TrackerState> {
  return { ...state };
}

/** Test seam only — see `errorReporter.ts`'s note on the naming convention. */
export function resetClientErrorTrackerForTests(): void {
  sentry = null;
  starting = null;
  state.ready = false;
  state.refused = 0;
  state.refusedBreadcrumbs = 0;
  state.sent = 0;
}
