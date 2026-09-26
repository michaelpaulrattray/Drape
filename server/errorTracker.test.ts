/**
 * THE TRACKER'S ARMS — drives `server/monitoring/errorTracker.ts` (#509 part 1).
 *
 * Two things are proven here and they are different in kind.
 *
 * **1 · With no key there is no tracker, and it says so.** That is invariant 7's
 * honest direction: the failure this repository has paid for three times is a
 * control that looks switched on while doing nothing (the Slack approval flow,
 * the IP blocks, the in-memory audit chain). So the arms read the boot line and
 * the status, and a stub returning one string for both states cannot pass them.
 *
 * **2 · The scrub is wired AT THE WIRE.** Invariant 5: the claims that matter
 * are claims about the object handed to `init`, so these arms drive
 * `buildTrackerOptions()`'s own `beforeSend` and `beforeBreadcrumb` rather than
 * re-stating the same literals beside them.
 *
 * ⚠ **WHAT IS DELIBERATELY NOT DRIVEN HERE, AND WHERE IT WAS DRIVEN INSTEAD.**
 * A real `Sentry.init()` imports an OpenTelemetry stack that patches `http` and
 * `mysql2` process-wide; vitest reuses workers across suites, so installing that
 * from a unit arm would put a global patch under whatever suite ran next in the
 * same worker. The real SDK's real `init`, its real event shape and a real
 * refusal through the real `beforeSend` were driven once in a disposable and the
 * readings are quoted on PR and card (593 ms import, 34 ms init; the SDK's own
 * event carries `modules`, `server_name`, `sdkProcessingMetadata`, two
 * breadcrumbs before any code runs, and frames carrying `context_line`,
 * `pre_context` and `post_context` — every one of which the projection drops).
 * Saying which half a suite does not cover is the point; a suite implying it
 * covered the transport would be the claim.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resetErrorTrackerForTests,
  bootLineFor,
  buildTrackerOptions,
  captureServerError,
  errorTrackerBootLine,
  errorTrackerStatus,
  flushErrorTracker,
  initErrorTracker,
} from "./monitoring/errorTracker";

const ENV_KEYS = ["SENTRY_DSN", "R2_PUBLIC_URL", "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_GIT_COMMIT_SHA"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  resetErrorTrackerForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetErrorTrackerForTests();
});

describe("no key means no tracker, and the boot line says so", () => {
  it("does not configure itself, and never imports the SDK", async () => {
    const line = await initErrorTracker();
    expect(errorTrackerStatus().configured).toBe(false);
    expect(errorTrackerStatus().ready).toBe(false);
    expect(line).toContain("SENTRY_DSN is not set");
    expect(line).toContain("reported nowhere");
  });

  it("treats a blank variable as absent — a Railway variable made with no value is `\"\"`", async () => {
    process.env.SENTRY_DSN = "   ";
    const line = await initErrorTracker();
    expect(errorTrackerStatus().configured).toBe(false);
    expect(line).toContain("is not set");
  });

  it("capturing an error is a silent no-op rather than a second crash", async () => {
    await initErrorTracker();
    await expect(captureServerError(new Error("nothing is listening"))).resolves.toBeUndefined();
    await expect(flushErrorTracker(5)).resolves.toBeUndefined();
    expect(errorTrackerStatus().sent).toBe(0);
  });

  /* THE POSITIVE CONTROL ON THE LINE ITSELF, and it is the arm that needed the
     pure function to exist: without a branch it can reach, a module returning
     ONE string for every state would pass every arm above. The three lines are
     asserted distinct, not merely non-empty. */
  it("says three different things for three different states", () => {
    const off = bootLineFor({ configured: false, ready: false });
    const starting = bootLineFor({ configured: true, ready: false });
    const on = bootLineFor({ configured: true, ready: true }, "railway:production", "abc1234");

    expect(off).toContain("SENTRY_DSN is not set");
    expect(off).toContain("reported nowhere");
    expect(starting).toContain("starting");
    expect(on).toContain("reporting to Sentry");
    expect(on).toContain("railway:production");
    expect(on).toContain("release abc1234");
    expect(new Set([off, starting, on]).size).toBe(3);
  });

  it("never claims to be reporting while it is only configured", () => {
    /* The window between "a key exists" and "the SDK finished importing" is
       real (593 ms, measured) and a line that read `reporting to Sentry` across
       it would be a lie for half a second on every boot. */
    expect(bootLineFor({ configured: true, ready: false })).not.toContain("reporting to Sentry");
  });

  it("reads the module's own state through the no-argument form", () => {
    expect(errorTrackerBootLine()).toBe(bootLineFor({ configured: false, ready: false }));
  });
});

describe("the options handed to the SDK — asserted on the object, not beside it", () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";
    process.env.RAILWAY_GIT_COMMIT_SHA = "abc1234";
  });

  it("carries the DSN, the world and the release", () => {
    const options = buildTrackerOptions();
    expect(options.dsn).toBe("https://key@o1.ingest.de.sentry.io/2");
    expect(options.environment).toBe("railway:production");
    expect(options.release).toBe("abc1234");
  });

  it("traces nothing and sends no default PII", () => {
    const options = buildTrackerOptions();
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sendDefaultPii).toBe(false);
  });

  /* THE RETENTION HOOK IS THE ALLOWLIST (#1405). It read `() => null` until
     that card — nothing retained at all — and these arms are what tell the two
     positions apart: the widening is real only if a navigation crumb survives,
     and it is safe only if the two prose-carrying categories do not. */
  it("retains a navigation crumb and drops the two that carry her words", () => {
    const { beforeBreadcrumb } = buildTrackerOptions();
    expect(beforeBreadcrumb({ category: "console", message: "her sentence, logged" })).toBeNull();
    expect(beforeBreadcrumb({ category: "ui.click", message: "her sentence, typed" })).toBeNull();
    expect(beforeBreadcrumb({ category: "sentry.transaction" })).toBeNull();
    expect(
      beforeBreadcrumb({
        category: "navigation",
        message: "should not travel",
        data: { from: "/casting", to: "/boards" },
      }),
    ).toEqual({ category: "navigation", data: { from: "/casting", to: "/boards" } });
  });

  it("cuts a query string off a retained crumb's URL at the hook, not only at the send", () => {
    const kept = buildTrackerOptions().beforeBreadcrumb({
      category: "http",
      data: { method: "POST", url: "https://klieglabs.com/api/trpc?input=%7B%7D", status_code: 500 },
    });
    expect(kept).toEqual({
      category: "http",
      data: { method: "POST", url: "https://klieglabs.com/api/trpc", status_code: 500 },
    });
  });

  it("redacts a picture's URL in a crumb using the bucket origin the server is actually on", () => {
    process.env.R2_PUBLIC_URL = "https://pub-xyz.r2.dev/";
    const kept = buildTrackerOptions().beforeBreadcrumb({
      category: "xhr",
      data: { method: "GET", url: "https://pub-xyz.r2.dev/cast/9f.png", status_code: 404 },
    });
    expect(JSON.stringify(kept)).not.toContain("9f.png");
    expect(kept?.data?.status_code).toBe(404);
  });

  /* The envelope channels. Both arms exist because the wire drive found the
     first one going out beside every event without passing `beforeSend` — a
     unit arm reading the projected object could never have seen it. */
  it("drops the ProcessSession integration, so no envelope bypasses the scrub", () => {
    const kept = buildTrackerOptions().integrations([
      { name: "ProcessSession" },
      { name: "OnUncaughtException" },
      { name: "ContextLines" },
    ]);
    expect(kept.map((it) => it.name)).toEqual(["OnUncaughtException", "ContextLines"]);
  });

  it("keeps client reports — a count and a reason, and the only place a refusal shows on Sentry's side", () => {
    expect(buildTrackerOptions().sendClientReports).toBe(true);
  });

  it("puts the scrub on the outgoing event — a recipe field refuses the send", () => {
    const options = buildTrackerOptions();
    const refused = options.beforeSend({
      exception: { values: [{ type: "Error", value: "boom" }] },
      extra: { masterPrompt: "the whole recipe" },
    });
    expect(refused).toBeNull();
  });

  it("projects an ordinary event through, keeping the diagnosis", () => {
    const options = buildTrackerOptions();
    const sent = options.beforeSend({
      exception: { values: [{ type: "TRPCError", value: "fal returned 429" }] },
      server_name: "container-7f",
      breadcrumbs: [{ category: "console", message: "her sentence" }],
      transaction: "castingV2.createRoll",
    });
    expect(sent).not.toBeNull();
    const wire = JSON.stringify(sent);
    expect(wire).toContain("fal returned 429");
    expect(wire).toContain("castingV2.createRoll");
    expect(wire).not.toContain("container-7f");
    expect(wire).not.toContain("her sentence");
  });

  it("redacts a picture's URL using the bucket origin the server is actually on", () => {
    process.env.R2_PUBLIC_URL = "https://pub-xyz.r2.dev/";
    const sent = buildTrackerOptions().beforeSend({
      exception: { values: [{ type: "Error", value: "GET https://pub-xyz.r2.dev/cast/9f.png 404" }] },
    });
    expect(JSON.stringify(sent)).not.toContain("9f.png");
  });
});

describe("a refusal is counted and named, and never quotes the value", () => {
  /* Driven through `beforeSend` — the object the SDK is handed — rather than
     through a seam beside it. A seam here would let this arm pass while the wire
     carried something else, which is invariant 5's whole content; the first
     shape of this suite had one and the uncalled-export sweep is what asked why
     it existed. */
  it("counts refusals and sends separately", () => {
    const { beforeSend } = buildTrackerOptions();
    expect(beforeSend({ extra: { technicalSchema: {} } })).toBeNull();
    expect(beforeSend({ extra: { masterPrompt: "x" } })).toBeNull();
    expect(beforeSend({ level: "error" })).not.toBeNull();
    expect(errorTrackerStatus().refused).toBe(2);
    expect(errorTrackerStatus().sent).toBe(1);
  });

  /*
    ⚠ THE CRUMB'S OWN REFUSAL, AND THE ENVELOPE IS WHY IT EXISTS (#1405).
    Retention runs long before the event gate, so a recipe field wired into a
    crumb is projected away and the event arrives clean — the drive against the
    real SDK showed exactly that, a refusing key producing a spotless event and
    no refusal at all. The data never left; the MESSAGE did, and the message is
    what the refusal is for. Its own counter, because a refused crumb and a
    refused report do not cost the same thing.
  */
  it("refuses a kept crumb carrying a recipe field, on its own counter", () => {
    const { beforeBreadcrumb } = buildTrackerOptions();
    expect(
      beforeBreadcrumb({ category: "fetch", data: { method: "POST", brief: "her words" } }),
    ).toBeNull();
    expect(errorTrackerStatus().refusedBreadcrumbs).toBe(1);
    expect(errorTrackerStatus().refused).toBe(0);
  });

  it("does not count a dropped category as a refusal — nothing was ever going to travel", () => {
    const { beforeBreadcrumb } = buildTrackerOptions();
    expect(
      beforeBreadcrumb({ category: "console", message: "x", data: { brief: "her words" } }),
    ).toBeNull();
    expect(errorTrackerStatus().refusedBreadcrumbs).toBe(0);
  });
});

describe("the status is a reading nobody can write through", () => {
  it("hands back a copy — a caller cannot switch the tracker on by editing it", async () => {
    await initErrorTracker();
    const status = errorTrackerStatus() as { configured: boolean; sent: number };
    status.configured = true;
    status.sent = 99;
    expect(errorTrackerStatus().configured).toBe(false);
    expect(errorTrackerStatus().sent).toBe(0);
  });

  it("answers `configured: false` when there is no key — the reading a surface must ask before it draws a number", async () => {
    await initErrorTracker();
    expect(errorTrackerStatus()).toEqual({
      configured: false,
      ready: false,
      refused: 0,
      refusedBreadcrumbs: 0,
      sent: 0,
    });
  });
});
