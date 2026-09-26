/**
 * THE ERROR TRACKER — the transport, and only the transport (#509 part 1).
 *
 * The founder's card: *"No error tracking and no product analytics are wired …
 * A customer's crash reaches nobody."* Today a crash writes one `log.fatal`
 * line into a container log nobody watches and one audit row that says a crash
 * happened, with no stack and no route. This is the wire that carries it out.
 *
 * `shared/errorEventScrub.ts` is the CONTROL — what may leave the building and
 * what refuses. This file decides only whether to send at all, and attaches the
 * three facts the card asks for: the request id, the account, the route. Keeping
 * those two jobs in two files is deliberate: the scrub has to be readable by the
 * client too, and it must not be reachable through an SDK upgrade.
 *
 * # WHAT HAPPENS WITH NO KEY, AND IT IS THE HALF WORTH READING (invariant 7)
 *
 * `SENTRY_DSN` absent — which is every developer's laptop, and production until
 * the founder pastes his key — means **there is no tracker**: the SDK is never
 * imported, `init` is never called, and `captureServerError` is a no-op. What it
 * does NOT do is pretend. The boot line says errors are not being reported, and
 * `errorTrackerStatus()` answers `configured: false` so no surface can ever draw
 * *"0 errors in 24 hours"* over a tracker that was never switched on — that
 * reading is the lying-control class this repository has paid for three times
 * (the Slack approval flow, the IP blocks, the in-memory audit chain).
 *
 * # WHY THE IMPORT IS DYNAMIC AND CONDITIONAL, WITH THE NUMBER
 *
 * ⚠ **`import("@sentry/node")` costs 593 ms on this machine, measured before a
 * line of this file was written** (`init` itself is 34 ms). The SDK pulls an
 * OpenTelemetry stack whether or not tracing is on, so a static import would put
 * that 593 ms on every boot of every laptop and on the deploy's healthcheck
 * path, in exchange for nothing when no key is set. So the import sits behind
 * the DSN: configured, it is paid once at boot; unconfigured, it is never paid.
 *
 * # NO TRACING, AND THAT IS A DECISION RATHER THAN AN OMISSION
 *
 * `tracesSampleRate: 0`. The card asks for errors; tracing is a second product
 * with its own quota, its own bill and its own breadcrumb surface, and the DT
 * law's clause 3 says the price is named beside the capability. It also removes
 * this file's one ordering hazard: OpenTelemetry auto-instrumentation only
 * patches modules imported AFTER `init`, so a tracing setup would have to move
 * ahead of `express` in `_core/index.ts` or silently under-report. Error capture
 * has no such requirement, so `init` can sit where it reads well.
 */
import { requestContext } from "../logging/logger";
import { createModuleLogger } from "../logging/logger";
import { deployedCommitSha, deploymentTag } from "../_core/env";
import {
  scrubBreadcrumb,
  scrubErrorEvent,
  type IncomingBreadcrumb,
  type IncomingEvent,
  type ScrubbedBreadcrumb,
} from "../../shared/errorEventScrub";

const log = createModuleLogger("errorTracker");

/** What a caller knows about the error beyond the throw itself. */
export interface ErrorContext {
  /** Where it happened, in the product's own terms — a tRPC path or a route. */
  route?: string;
  /** `uncaughtException`, `unhandledRejection`, `trpc` — how it reached us. */
  kind?: string;
  /** tRPC's own error code, when there is one. */
  trpcCode?: string;
  /** tRPC's `query` / `mutation`, when there is one. */
  trpcType?: string;
}

type SentryModule = typeof import("@sentry/node");

interface TrackerState {
  /** A DSN is set, so this process intends to report. */
  configured: boolean;
  /** The SDK is imported and `init` has returned. */
  ready: boolean;
  /** How many events the scrub refused — a wiring defect's own counter. */
  refused: number;
  /**
   * How many BREADCRUMBS were refused for the same reason. Its own counter and
   * not folded into `refused`, because the two lose different amounts: a
   * refused event is a whole report gone, a refused crumb is one line of a
   * trail. One number answering both questions would make the event count lie.
   */
  refusedBreadcrumbs: number;
  /** How many were handed to the SDK. */
  sent: number;
}

let sentry: SentryModule | null = null;
let starting: Promise<void> | null = null;
const state: TrackerState = {
  configured: false,
  ready: false,
  refused: 0,
  refusedBreadcrumbs: 0,
  sent: 0,
};

function dsn(): string {
  return (process.env.SENTRY_DSN ?? "").trim();
}

/** The image bucket's origin, so the scrub can redact a picture's URL. */
function imageOrigin(): string | undefined {
  const raw = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  return raw.length > 0 ? raw : undefined;
}

/**
 * The scrub, wired as the SDK's last gate. Returning `null` here means the event
 * never leaves the process — Sentry's own contract for a dropped event.
 *
 * A refusal is COUNTED and LOGGED with the key's name and its path, never its
 * value: a refused event means our own code attached a recipe field to an error
 * report, which is a defect to fix rather than an incident to hide, and a silent
 * drop would make the tracker look healthy while a whole class of error went
 * missing.
 */
function gate(event: IncomingEvent): IncomingEvent | null {
  const verdict = scrubErrorEvent(event, imageOrigin());
  if (verdict.verdict === "refuse") {
    state.refused += 1;
    log.error(
      { refusedKey: verdict.key, refusedPath: verdict.path },
      "error report REFUSED before send — a customer's recipe field was attached to it",
    );
    return null;
  }
  state.sent += 1;
  return verdict.event as IncomingEvent;
}

/**
 * The same gate for one crumb of the trail, wired as the SDK's retention hook.
 *
 * A refusal is logged and counted exactly as an event's is, and for the reason
 * `scrubBreadcrumb`'s docblock gives: without this the mis-wiring it exists to
 * report would be trimmed away silently, because retention runs before the
 * event gate and there would be nothing left in the event to find.
 */
function breadcrumbGate(breadcrumb: IncomingBreadcrumb): ScrubbedBreadcrumb | null {
  const verdict = scrubBreadcrumb(breadcrumb, imageOrigin());
  if (verdict.verdict === "refuse") {
    state.refusedBreadcrumbs += 1;
    log.error(
      { refusedKey: verdict.key, refusedPath: verdict.path },
      "breadcrumb REFUSED before retention — a customer's recipe field was attached to it",
    );
    return null;
  }
  return verdict.verdict === "keep" ? verdict.breadcrumb : null;
}

/**
 * EVERY OPTION THE SDK IS GIVEN, BUILT WHERE A TEST CAN READ IT.
 *
 * This is invariant 5 — *"Assert at the wire. Contracts about what gets sent are
 * proven on the outgoing request, not on a constant near it."* The claims that
 * matter here (the scrub IS the last gate; PII is off; nothing is traced; a
 * breadcrumb is retained only if its category is allowed) are claims about the object handed to
 * `init`, so `server/errorTracker.test.ts` drives THIS function's result rather
 * than re-stating the same literals beside it and agreeing with itself.
 */
export function buildTrackerOptions(): {
  dsn: string;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
  dataCollection: {
    userInfo: boolean;
    cookies: boolean;
    httpHeaders: boolean;
    urlQueryParams: boolean;
    httpBodies: never[];
    stackFrameVariables: boolean;
  };
  sendClientReports: boolean;
  integrations: (defaults: { name: string }[]) => { name: string }[];
  beforeBreadcrumb: (breadcrumb: IncomingBreadcrumb) => ScrubbedBreadcrumb | null;
  beforeSend: (event: IncomingEvent) => IncomingEvent | null;
} {
  return {
    dsn: dsn(),
    environment: deploymentTag(),
    release: deployedCommitSha() ?? undefined,
    /* Errors, not tracing — see the header. */
    tracesSampleRate: 0,
    /*
      ⚠ THIS WAS `sendDefaultPii: false` UNTIL #509 PART 1b, AND THAT OPTION IS
      READ BY NOTHING IN v11 — read at the installed SDK, not assumed. It appears
      NOWHERE in `@sentry/core`, `@sentry/node` or `@sentry/browser` at 11.0.0,
      and `options.d.ts` carries **0** declarations of it; `dataCollection`
      replaced it, and ITS defaults are all permissive (`userInfo: true`,
      `cookies: true`, `httpHeaders: { request: true, response: true }`,
      `urlQueryParams: true`, `stackFrameVariables: true`).

      So the comment that used to sit here — "the SDK's own switch for attach the
      request's IP, cookies, headers and the user's email … two independent
      reasons for one outcome" — described a control that did not exist, and
      `server/errorTracker.test.ts` had a GREEN arm asserting its value. That is
      invariant 7 (a control that is not invoked does not exist) with working law
      2's failure beside it: the arm agreed with a constant in this file rather
      than with the SDK.

      ⚠ **NOTHING LEAKED, AND THAT IS THE PROJECTION EARNING ITS KEEP.** The
      scrub REBUILDS each event from an allowlist, so cookies, headers,
      `user.email` and frame `vars` were never in the outgoing bytes whatever the
      SDK collected — invariant 8's "by construction, not by callers remembering".
      What was actually lost was the SECOND of the two reasons. Both are real
      again below, and the browser half sets the same option for the same reason.
    */
    dataCollection: {
      /* `user.*` filled from instrumentation; the id is set deliberately in
         `captureServerError`. */
      userInfo: false,
      /* Every cookie on the request, including `app_session_id`. */
      cookies: false,
      /* Request and response headers — `Authorization` and `Cookie` among them. */
      httpHeaders: false,
      /* A query string is where ids, tokens and signatures travel. */
      urlQueryParams: false,
      /* Request and response BODIES. On this product's roll path an incoming
         body is the customer's brief. */
      httpBodies: [],
      /* Every local in scope at the throw — on the roll path, the composed
         prompt itself. The projection's own note on the absent `vars` field. */
      stackFrameVariables: false,
    },
    /*
      ⚠ RELEASE HEALTH IS OFF, AND IT IS OFF BECAUSE OF A READING RATHER THAN A
      PREFERENCE. Driving the real SDK through a fake transport and reading the
      ENVELOPE BYTES (`output/_509-wire-drive.mts`) showed a SECOND envelope
      going out beside every event — a `session` envelope from the default
      `ProcessSession` integration — and it does NOT pass through `beforeSend`.
      Its contents are harmless on a server (a random session id, a status, an
      error count, the release, `user_agent: "Node.js/24"`), so this is not a
      leak that was found. What was found is that this module's promise —
      *everything that leaves passes the scrub* — had an exception nobody had
      written down, and a true narrow promise is worth more than a true one with
      an asterisk. Release health is a deliberate widening with its own diff and
      its own arms; on the CLIENT it would carry a real browser's user agent,
      which is the reason not to inherit this decision there by accident.
    */
    integrations: (defaults) => defaults.filter((it) => it.name !== "ProcessSession"),
    /*
      THE ONE CHANNEL THAT STAYS AND DOES NOT PASS THE SCRUB, DECLARED RATHER
      THAN DISCOVERED. Sentry's client report is a count and a reason from its
      own fixed vocabulary — the drive read
      `discarded_events: [{ reason: "before_send", category: "error", quantity: 1 }]`
      after a refusal — so it carries nothing of ours, and it is the only way a
      refusal is visible on Sentry's side as well as in our own log.
    */
    sendClientReports: true,
    /*
      THE TRAIL, ALLOWED BY CATEGORY (#1405). Until this line the answer was
      `() => null` — nothing retained at all, which was right while the only
      alternative was retaining console arguments and clicked element text.
      `projectBreadcrumb` is the widening: navigation and http/xhr/fetch, their
      `data` cut to the few named fields, `message` never read, everything else
      dropped. It runs HERE so a customer's sentence is never held in this
      process's memory, and again in the projection so nothing depends on it
      having run — see the scrub's own note on why both.

      ⚠ The SDK also hands this hook a `hint` carrying the raw source of the
      crumb (the DOM event, the XHR object, the console arguments). It is
      deliberately not a parameter: there is nothing in it this product wants,
      and a signature that cannot see it cannot come to read it.
    */
    beforeBreadcrumb: (breadcrumb) => breadcrumbGate(breadcrumb),
    beforeSend: (event) => gate(event),
  };
}

/**
 * Start the tracker. Safe to call twice; the second call returns the first
 * call's promise rather than initialising again.
 *
 * Returns the line to print at boot either way, because a reader of the boot log
 * must be able to tell "reporting to Sentry" from "not reporting" without
 * knowing which variables exist.
 */
export async function initErrorTracker(): Promise<string> {
  if (starting) {
    await starting;
    return bootLine();
  }
  if (dsn().length === 0) {
    return bootLine();
  }

  state.configured = true;
  starting = (async () => {
    try {
      const mod = await import("@sentry/node");
      const options = buildTrackerOptions();
      mod.init({
        /* SPREAD, never re-listed field by field: an option added to
           `buildTrackerOptions` must reach the SDK without anybody remembering
           to copy it here, or the tested object and the sent object become two
           lists that drift (working law 4). */
        ...options,
        /* The casts in this file, and they are TYPE adapters and nothing else.
           Sentry's `ErrorEvent` and `Breadcrumb` have no index signature, so
           neither is assignable to the scrub's deliberately structural
           `IncomingEvent`/`IncomingBreadcrumb` — the scrub is typed against the
           CONTRACT rather than against the SDK precisely so an SDK upgrade
           cannot widen what travels. The functions called here are the same
           objects the suite drives; only their declared types move. */
        beforeSend: (event) =>
          options.beforeSend(event as unknown as IncomingEvent) as unknown as typeof event | null,
        beforeBreadcrumb: (breadcrumb) =>
          options.beforeBreadcrumb(
            breadcrumb as unknown as IncomingBreadcrumb,
          ) as unknown as typeof breadcrumb | null,
      });
      sentry = mod;
      state.ready = true;
    } catch (error) {
      /* A tracker that cannot start must not take the server with it — but it
         must not look started either, which is what `ready` staying false is. */
      log.error({ err: error }, "the error tracker failed to start — errors are NOT being reported");
      state.configured = false;
    }
  })();

  await starting;
  return bootLine();
}

/**
 * The boot line, as a PURE function of the state it describes — so both of its
 * branches can be driven without starting a real SDK in a shared test worker.
 *
 * ⚠ The first arm written for this took the state from the module and therefore
 * could only ever read ONE branch; it was titled as a positive control and
 * proved nothing, which is precisely the shape law 2 exists to catch. A line
 * that says "reporting to Sentry" while nothing is is the defect here, so the
 * arm that tells the two lines apart has to be able to reach both.
 */
export function bootLineFor(
  tracker: Pick<TrackerState, "configured" | "ready">,
  world = deploymentTag(),
  release = deployedCommitSha(),
): string {
  if (!tracker.configured) {
    return "[Errors] SENTRY_DSN is not set — uncaught errors are logged locally and reported nowhere";
  }
  if (!tracker.ready) return "[Errors] the tracker is starting";
  return `[Errors] reporting to Sentry · ${world}${release ? ` · release ${release}` : ""}`;
}

function bootLine(): string {
  return bootLineFor(state);
}

/**
 * Hand an error to the tracker. Never throws and never rejects: a reporting
 * path that can fail is a second crash on top of the first one, and every call
 * site here is already handling something that went wrong.
 *
 * Awaits an in-flight start rather than dropping the event, because the errors
 * worth the most are the ones thrown while the process is still coming up.
 */
export async function captureServerError(error: unknown, context: ErrorContext = {}): Promise<void> {
  try {
    if (!state.configured) return;
    if (starting) await starting;
    if (!sentry || !state.ready) return;

    const store = requestContext.getStore();
    sentry.withScope((scope) => {
      if (store?.userId !== undefined) scope.setUser({ id: String(store.userId) });
      if (store?.correlationId) scope.setTag("correlationId", store.correlationId);
      if (context.route) scope.setTag("route", context.route);
      if (context.kind) scope.setTag("kind", context.kind);
      if (context.trpcCode) scope.setTag("trpcCode", context.trpcCode);
      if (context.trpcType) scope.setTag("trpcType", context.trpcType);
      scope.setTag("world", deploymentTag());
      /* A non-Error reason (an unhandled rejection of a string, which this
         product's `unhandledRejection` handler does receive) is wrapped rather
         than stringified into a message, so it still carries a stack. */
      sentry?.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch (reportingError) {
    log.warn({ err: reportingError }, "the error tracker threw while reporting an error");
  }
}

/** Give the transport a moment to drain — used by the crash handler only. */
export async function flushErrorTracker(timeoutMs = 2000): Promise<void> {
  try {
    if (!sentry || !state.ready) return;
    await sentry.flush(timeoutMs);
  } catch {
    /* A flush that fails changes nothing a caller can act on. */
  }
}

/**
 * What any surface must ask before it draws a number. `configured: false` is the
 * answer that forbids "0 errors today" — see the header.
 */
export function errorTrackerStatus(): Readonly<TrackerState> {
  return { ...state };
}

/**
 * Test seam only: forget everything this module remembers between arms. Named
 * the way this repository's other five such seams are named, because
 * `scripts/check-cleanup-dispositions.mts` reads that convention off the NAME —
 * an export with no production importer is `unread` until a row dispositions it,
 * and it caught this one on its first preflight.
 */
export function resetErrorTrackerForTests(): void {
  sentry = null;
  starting = null;
  state.configured = false;
  state.ready = false;
  state.refused = 0;
  state.refusedBreadcrumbs = 0;
  state.sent = 0;
}

/* ⚠ THERE IS NO `gateForTests` SEAM, AND ITS ABSENCE IS THE POINT. One was
   written here and deleted the same hour: the arm that wanted it should drive
   `buildTrackerOptions().beforeSend`, which is the function the SDK is actually
   handed, and a seam beside it would have let the suite pass while the wire
   carried something else (invariant 5). The sweep asking why the export had no
   production caller is what prompted the re-read. */

export { bootLine as errorTrackerBootLine };
