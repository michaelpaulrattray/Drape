/**
 * THE PRODUCT EVENT STREAM — the transport, and only the transport (#509 part 2).
 *
 * The founder's card: *"nothing records what people do"*. Today a roll, a
 * refine and a Sign leave a receipt row apiece in the operations table and
 * nothing that answers *"how many people cast anything this week, and how often
 * did it not arrive?"* This is the wire that carries that out.
 *
 * `shared/productEventCatalogue.ts` is the CONTROL — what may leave the building
 * and what refuses. This file decides only whether to send at all, and attaches
 * the two facts every event carries (the world, the release). The two jobs are
 * two files for the same reason part 1 split them: the catalogue must stay
 * readable by the client if a browser half is ever built, and it must not be
 * reachable through an SDK upgrade.
 *
 * # WHAT HAPPENS WITH NO KEY, AND IT IS THE HALF WORTH READING (invariant 7)
 *
 * `POSTHOG_API_KEY` absent — which is every developer's laptop, and production
 * until the founder pastes his key — means **there is no event stream**: the SDK
 * is never imported, no client is constructed, and `captureProductEvent` is a
 * no-op. What it does NOT do is pretend. The boot line says nothing is being
 * recorded, and `productEventStreamStatus()` answers `configured: false` so no
 * surface can ever draw *"12 generations today"* over a stream that was never
 * switched on — that reading is the lying-control class this repository has paid
 * for three times (the Slack approval flow, the IP blocks, the in-memory audit
 * chain).
 *
 * # THE PRICE, NAMED BESIDE THE CAPABILITY (DT law, clause 3)
 *
 * PostHog Cloud's free tier is 1,000,000 events a month. This seam fires at most
 * three events per generation, and the volume was READ AT THE ROWS rather than
 * taken from a document (`scripts/_509p2-volume-read-disposable.mts`, production,
 * 2026-09-26):
 *
 *     all time       712 operations   ·  up to 2,136 events
 *     last 30 days   155 operations   ·  up to   465 events
 *     last 7 days     61 operations
 *
 * **465 events a month is 0.05% of the free tier** — the stream is free now and
 * stays free through roughly three hundred thousand generations a month. The
 * real cost is therefore not money: it is one outbound HTTPS batch every five
 * seconds from a process that is also serving requests, which is why the batch
 * is small and the flush is lazy rather than per-event.
 *
 * ⚠ The first draft of this paragraph cited *"295 rolls all time"* from
 * `PROGRAM.md`. It was four days old, it was a different population (rolls, not
 * operations), and the real figure is 712. Law 7c: a document is a report, the
 * rows are the artifact — and the read cost one query.
 *
 * # WHY THE IMPORT IS DYNAMIC AND CONDITIONAL
 *
 * Part 1 measured `import("@sentry/node")` at 593 ms and put it behind the DSN
 * for that reason. The same shape is used here on the same grounds, and the
 * number was MEASURED for this SDK rather than inherited from that one —
 * `scripts/_509b-import-cost-disposable.mts`, three runs on this machine:
 * **import 85.2 / 86.4 / 101.9 ms, construct 13.7 / 13.6 / 14.2 ms.** A sixth
 * of Sentry's, and still ~100 ms paid for nothing on every laptop boot and on
 * the deploy's healthcheck path when no key is set. It sits behind the key:
 * configured, it is paid once at boot; unconfigured, never.
 *
 * ⚠ The first draft of this paragraph said *"~120 ms"* before anything had been
 * run. It was a guess, it was wrong in the direction that flatters the decision,
 * and it is recorded here because the measurement took ninety seconds.
 *
 * # NO FEATURE FLAGS, NO SURVEYS, NO REMOTE CONFIG, NO TRACING
 *
 * Each of those is a separate PostHog product that this SDK will poll for on a
 * timer if it is not told otherwise, and each is a decision nobody has made. The
 * card asks for an event stream. `buildProductEventOptions` turns all of them
 * off explicitly and says so per line — the DT law's clause 4 read the other
 * way round: know what the engine does before you leave it doing it.
 */
import { createModuleLogger } from "../logging/logger";
import { deployedCommitSha, deploymentTag } from "../_core/env";
import {
  projectProductEvent,
  type ProductEventName,
} from "../../shared/productEventCatalogue";

const log = createModuleLogger("productEvents");

/**
 * PostHog Cloud's US ingestion host. Overridable with `POSTHOG_HOST` for the EU
 * region (`https://eu.i.posthog.com`) or a self-hosted instance, which is the
 * card's own *"self-hostable if the data must not leave"*.
 */
const DEFAULT_HOST = "https://us.i.posthog.com";

/** The narrow shape this module uses, so an SDK upgrade cannot widen the call. */
export interface ProductEventClient {
  capture(payload: { distinctId: string; event: string; properties: Record<string, unknown> }): void;
  flush(): Promise<void>;
  shutdown(timeoutMs?: number): Promise<void>;
}

interface StreamState {
  /** A key is set, so this process intends to record. */
  configured: boolean;
  /** The SDK is imported and the client is constructed. */
  ready: boolean;
  /** How many events the catalogue refused — a wiring defect's own counter. */
  refused: number;
  /**
   * How many PROPERTIES were dropped as undeclared. Its own counter and not
   * folded into `refused`, because the two mean opposite things: a refusal is a
   * defect that lost a whole event, a drop is the allowlist doing its job on a
   * caller that passed something extra. One number answering both questions
   * would make the defect count lie.
   */
  droppedProperties: number;
  /** How many were handed to the SDK. */
  sent: number;
}

let client: ProductEventClient | null = null;
let starting: Promise<void> | null = null;
const state: StreamState = {
  configured: false,
  ready: false,
  refused: 0,
  droppedProperties: 0,
  sent: 0,
};

function apiKey(): string {
  return (process.env.POSTHOG_API_KEY ?? "").trim();
}

function host(): string {
  const raw = (process.env.POSTHOG_HOST ?? "").trim();
  return raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_HOST;
}

/**
 * EVERY OPTION THE SDK IS GIVEN, BUILT WHERE A TEST CAN READ IT.
 *
 * This is invariant 5 — *"Assert at the wire."* The claims that matter here (no
 * geo, no flags, no surveys, no remote config, person profiles carrying nothing)
 * are claims about the object handed to the constructor, so
 * `server/productEvents.test.ts` drives THIS function's result rather than
 * re-stating the same literals beside it and agreeing with itself.
 *
 * ⚠ **EVERY NAME BELOW WAS READ IN THE INSTALLED PACKAGE BEFORE IT WAS WRITTEN,
 * AND `server/productEventOptionsDeclared.test.ts` HOLDS IT THERE.** That guard
 * exists because of what part 1b found the night before this landed:
 * `sendDefaultPii: false` sat in the Sentry options with a confident comment and
 * a GREEN test arm asserting its value, and the option does not exist in that
 * SDK's major version at all — a spread into a constructor is not
 * excess-property-checked, so a dead option typechecks forever. An option this
 * file believes in and the package has never heard of is the same defect one
 * vendor over.
 */
export function buildProductEventOptions(): {
  host: string;
  flushAt: number;
  flushInterval: number;
  disableGeoip: boolean;
  disableRemoteFeatureFlags: boolean;
  disableSurveys: boolean;
  preloadFeatureFlags: boolean;
  sendFeatureFlagEvent: boolean;
  personProfiles: "identified_only";
} {
  return {
    host: host(),
    /*
      A small batch and a lazy timer, on purpose. This is a web process, not a
      worker: twenty events buffered for five seconds costs one request, and the
      shutdown path below drains whatever is left so a deploy mid-batch loses
      nothing. Both are the SDK's own defaults re-stated rather than inherited,
      because a default that changes under us changes how much a crash loses.
    */
    flushAt: 20,
    flushInterval: 5000,
    /*
      ⚠ GEO IS OFF BECAUSE ON A SERVER IT WOULD BE A LIE, not because it is
      sensitive. PostHog derives a country from the IP of whoever POSTs the
      event; server-side capture means that IP is RAILWAY'S, so every customer
      in the product would appear to be in one datacentre. A dashboard nobody
      can trust is worse than a dashboard that does not answer. (The customer's
      own IP is never sent: nothing in this file reads one.)
    */
    disableGeoip: true,
    /*
      THE OTHER POSTHOG PRODUCTS THIS ONE IS NOT. Feature flags would be a
      second flag system beside this repository's own scope flags — working law
      4 at the scale of a whole mechanism, and a founder decision besides.
      Surveys would put a third party's UI in front of a customer. Neither was
      asked for; both are off, and turning one on is its own card.

      ⚠ **`disableRemoteConfig: true` WAS THE FOURTH LINE HERE AND IT WAS
      REMOVED THE HOUR IT WAS WRITTEN, BY THE GUARD BUILT FOR EXACTLY THIS.**
      `server/productEventOptionsDeclared.test.ts` failed on its first run:
      the option is declared in `@posthog/core`'s `types.d.ts` and appears in
      **no shipped JavaScript file of either package** — read at the bytes, not
      inferred. It is the `sendDefaultPii` specimen one vendor over, found one
      day after part 1b found that one, and it typechecked perfectly because a
      spread is not excess-property-checked.

      **Nothing is lost by its removal, and that was checked rather than
      assumed**: remote config in this SDK is `getRemoteConfigPayload(flagKey)`,
      a method a caller invokes, not a poll that runs by itself — so the node
      client has no background remote-config request for an option to disable.
      The browser SDK is where that option means something.
    */
    disableRemoteFeatureFlags: true,
    disableSurveys: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    /*
      A PERSON PROFILE IS AN ACCOUNT ID AND NOTHING ELSE. Every event this
      module sends carries a real account id as its distinct id, so
      `identified_only` and `always` behave the same way here; the narrower one
      is written down so that an event without an id could never silently mint
      an anonymous profile. Nothing is ever `$set`, so no name, no email and no
      plan ever reaches a profile — the metadata-only boundary applies to a
      third party exactly as it applies to staff.
    */
    personProfiles: "identified_only",
  };
}

/**
 * Start the stream. Safe to call twice; the second call returns the first
 * call's promise rather than constructing again.
 *
 * Returns the line to print at boot either way, because a reader of the boot log
 * must be able to tell "recording to PostHog" from "not recording" without
 * knowing which variables exist.
 */
export async function initProductEvents(): Promise<string> {
  if (starting) {
    await starting;
    return bootLine();
  }
  if (apiKey().length === 0) {
    return bootLine();
  }

  state.configured = true;
  starting = (async () => {
    try {
      const mod = await import("posthog-node");
      client = new mod.PostHog(apiKey(), buildProductEventOptions()) as unknown as ProductEventClient;
      state.ready = true;
    } catch (error) {
      /* A stream that cannot start must not take the server with it — but it
         must not look started either, which is what `ready` staying false is. */
      log.error(
        { err: error },
        "the product event stream failed to start — nothing is being recorded",
      );
      state.configured = false;
    }
  })();

  await starting;
  return bootLine();
}

/**
 * The boot line, as a PURE function of the state it describes — so both of its
 * branches can be driven without constructing a real client in a shared test
 * worker. Part 1's own note applies unchanged: the first arm written for that
 * file's boot line took the state from the module and could therefore only ever
 * read ONE branch, which is precisely the shape working law 2 exists to catch.
 */
export function productEventsBootLineFor(
  stream: Pick<StreamState, "configured" | "ready">,
  world = deploymentTag(),
  where = host(),
): string {
  if (!stream.configured) {
    return "[Events] POSTHOG_API_KEY is not set — what people do in the product is recorded nowhere";
  }
  if (!stream.ready) return "[Events] the product event stream is starting";
  return `[Events] recording to PostHog · ${world} · ${where}`;
}

function bootLine(): string {
  return productEventsBootLineFor(state);
}

/**
 * THE ONLY FUNCTION IN THIS PRODUCT THAT MAY SEND A PRODUCT EVENT, and the
 * reason it is the only one is in the catalogue's header: `posthog-node` has no
 * `before_send` hook, so there is no gate under this one. Everything that leaves
 * is composed here, from the allowlist, out of the caller's declared input.
 *
 * Never throws and never rejects. A measurement path that can fail is a second
 * fault on top of whatever it was measuring, and every call site here sits on
 * the money path.
 *
 * ⚠ It does NOT await the send, and that is deliberate: `capture` buffers, and a
 * roll's receipt must not wait on an analytics batch. What that costs is stated
 * rather than hidden — a process killed between a capture and the next flush
 * loses up to five seconds of events, which is the right thing to lose. The
 * shutdown path drains the buffer on an orderly exit.
 */
export function captureProductEvent(
  name: ProductEventName,
  userId: number,
  properties: Readonly<Record<string, unknown>> = {},
): void {
  try {
    if (!state.configured || !client || !state.ready) return;

    const verdict = projectProductEvent(name, {
      ...properties,
      world: deploymentTag(),
      release: deployedCommitSha(),
    });

    if (verdict.verdict === "refuse") {
      state.refused += 1;
      log.error(
        { event: name, refusedKey: verdict.key, reason: verdict.reason },
        "product event REFUSED before send — its payload did not match what the catalogue declares",
      );
      return;
    }

    if (verdict.dropped.length > 0) {
      state.droppedProperties += verdict.dropped.length;
      log.warn(
        { event: name, droppedKeys: verdict.dropped },
        "product event properties DROPPED — the catalogue does not declare them for this event",
      );
    }

    state.sent += 1;
    client.capture({
      distinctId: String(userId),
      event: name,
      properties: verdict.properties,
    });
  } catch (reportingError) {
    log.warn({ err: reportingError }, "the product event stream threw while recording an event");
  }
}

/*
  ⚠ THERE IS NO `flushProductEvents`, AND ITS ABSENCE IS THE POINT. One was
  written here beside part 1's `flushErrorTracker` and deleted the same hour:
  `shutdownProductEvents` below is the only drain this product needs, the
  cleanup sweep found the export had no production caller, and an exported
  drain nobody calls is the shape invariant 7 is about. The wire suite holds
  its own client and flushes that.
*/

/** Drain and stop. Called on an orderly exit so a deploy loses no buffered events. */
export async function shutdownProductEvents(timeoutMs = 2000): Promise<void> {
  try {
    if (!client || !state.ready) return;
    await client.shutdown(timeoutMs);
  } catch {
    /* Same reasoning as the flush above. */
  }
}

/**
 * What any surface must ask before it draws a number. `configured: false` is the
 * answer that forbids *"12 generations today"* — see the header.
 */
export function productEventStreamStatus(): Readonly<StreamState> {
  return { ...state };
}

/**
 * Is there a PostHog project to LINK to (#1441)?
 *
 * The twin of `errorReportingConfigured()` in `./errorTracker.ts`, and it is
 * deliberately NOT `productEventStreamStatus().configured` for the reason
 * written there: that field is written at boot, so it answers "has the stream
 * started" rather than "is there a project", and the two differ in every test
 * and for the whole of startup.
 */
export function productEventsConfigured(): boolean {
  return apiKey().length > 0;
}

/**
 * Test seam only: put a client in place without importing the SDK, so the
 * transport's own arms can read exactly what `capture` was handed.
 *
 * ⚠ **AND IT IS ALSO THE WIRE SEAM.** `server/productEventWire.test.ts`
 * constructs a REAL `PostHog` with `buildProductEventOptions()` and a fake
 * `fetch`, installs it here, and reads the outgoing HTTP BYTES — so the claim
 * *"no property that is not on the allowlist ever leaves this process"* is
 * proven on the request rather than on this module's return value. A seam that
 * only a fake could use would have made that suite impossible, which is why
 * this one takes the interface rather than a recorder.
 */
export function setProductEventClientForTests(next: ProductEventClient | null): void {
  client = next;
  state.configured = next !== null;
  state.ready = next !== null;
}

/**
 * Test seam only: forget everything this module remembers between arms. Named
 * the way this repository's other such seams are named, because
 * `scripts/check-cleanup-dispositions.mts` reads that convention off the NAME.
 */
export function resetProductEventsForTests(): void {
  client = null;
  starting = null;
  state.configured = false;
  state.ready = false;
  state.refused = 0;
  state.droppedProperties = 0;
  state.sent = 0;
}

export { bootLine as productEventsBootLine };
