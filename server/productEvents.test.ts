/**
 * THE PRODUCT EVENT STREAM'S TRANSPORT (#509 part 2).
 *
 * What this asks that `productEventWire.test.ts` does not: the half that runs
 * when there is NO key. That is the state this product is in on every laptop and
 * on production until the founder pastes his — so it is the state most of this
 * file is about, and the one where a mistake is invisible.
 *
 * ⚠ The boot line is driven as a PURE function of the state it describes,
 * because part 1 recorded the trap: an arm that reads the module's own state can
 * only ever reach ONE branch, and a line saying "recording to PostHog" while
 * nothing is is exactly the defect worth catching (working law 2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildProductEventOptions,
  captureProductEvent,
  initProductEvents,
  productEventStreamStatus,
  productEventsBootLineFor,
  resetProductEventsForTests,
  setProductEventClientForTests,
  shutdownProductEvents,
  type ProductEventClient,
} from "./monitoring/productEvents";

interface Captured {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}

function recorder(): { client: ProductEventClient; sent: Captured[]; shutdowns: number } {
  const sent: Captured[] = [];
  const box = { shutdowns: 0 };
  return {
    sent,
    get shutdowns() {
      return box.shutdowns;
    },
    client: {
      capture: (payload) => {
        sent.push(payload as Captured);
      },
      flush: async () => undefined,
      shutdown: async () => {
        box.shutdowns += 1;
      },
    },
  };
}

const KEYS = ["POSTHOG_API_KEY", "POSTHOG_HOST", "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_GIT_COMMIT_SHA"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  for (const key of KEYS) delete process.env[key];
  resetProductEventsForTests();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetProductEventsForTests();
  vi.restoreAllMocks();
});

describe("with no key there is NO stream, and the boot line says so (invariant 7)", () => {
  it("never imports the SDK and never constructs a client", async () => {
    const line = await initProductEvents();
    expect(line).toBe(
      "[Events] POSTHOG_API_KEY is not set — what people do in the product is recorded nowhere",
    );
    expect(productEventStreamStatus()).toMatchObject({ configured: false, ready: false });
  });

  it("⚠ an empty-string key is the same as no key — a blank Railway variable is one careless click", async () => {
    process.env.POSTHOG_API_KEY = "   ";
    await initProductEvents();
    expect(productEventStreamStatus().configured).toBe(false);
  });

  it("capturing is a no-op and cannot throw", () => {
    expect(() => captureProductEvent("generation started", 1, { action: "roll" })).not.toThrow();
    expect(productEventStreamStatus().sent).toBe(0);
  });

  it("flushing and shutting down are no-ops rather than faults", async () => {
    await expect(shutdownProductEvents(10)).resolves.toBeUndefined();
  });

  it("⚠ no surface can read a number out of a stream that was never switched on", () => {
    /* The lying-control class: `configured: false` is the answer that forbids
       "12 generations today" being drawn over a stream nobody turned on. */
    const status = productEventStreamStatus();
    expect(status.configured).toBe(false);
    expect(status.sent).toBe(0);
  });
});

describe("the boot line tells the two states apart", () => {
  it("says nothing is recorded when it is not configured", () => {
    expect(productEventsBootLineFor({ configured: false, ready: false })).toContain("recorded nowhere");
  });

  it("says it is starting while it is starting", () => {
    expect(productEventsBootLineFor({ configured: true, ready: false })).toContain("starting");
  });

  it("names the world and the host once it is recording", () => {
    const line = productEventsBootLineFor({ configured: true, ready: true }, "railway:production", "https://eu.i.posthog.com");
    expect(line).toContain("recording to PostHog");
    expect(line).toContain("railway:production");
    expect(line).toContain("https://eu.i.posthog.com");
  });

  it("⚠ never prints the key", () => {
    process.env.POSTHOG_API_KEY = "phc_a_real_looking_secret_value";
    const lines = [
      productEventsBootLineFor({ configured: false, ready: false }),
      productEventsBootLineFor({ configured: true, ready: false }),
      productEventsBootLineFor({ configured: true, ready: true }),
    ];
    for (const line of lines) expect(line).not.toContain("phc_a_real_looking_secret_value");
  });
});

describe("where it points", () => {
  it("defaults to PostHog Cloud US", () => {
    expect(buildProductEventOptions().host).toBe("https://us.i.posthog.com");
  });

  it("follows POSTHOG_HOST for the EU region or a self-hosted instance", () => {
    process.env.POSTHOG_HOST = "https://eu.i.posthog.com/";
    expect(buildProductEventOptions().host).toBe("https://eu.i.posthog.com");
  });

  it("turns off every PostHog product this one is not", () => {
    const options = buildProductEventOptions();
    expect(options.disableGeoip).toBe(true);
    expect(options.disableRemoteFeatureFlags).toBe(true);
    expect(options.disableSurveys).toBe(true);
    expect(options.preloadFeatureFlags).toBe(false);
    expect(options.sendFeatureFlagEvent).toBe(false);
    expect(options.personProfiles).toBe("identified_only");
  });
});

describe("with a client in place", () => {
  it("hands the SDK the account id and the projected properties, and nothing else", () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";
    process.env.RAILWAY_GIT_COMMIT_SHA = "0123456789abcdef0123456789abcdef01234567";
    const { client, sent } = recorder();
    setProductEventClientForTests(client);

    captureProductEvent("generation delivered", 7, {
      action: "roll",
      outcome: "partial",
      creditsCharged: 160,
      creditsRefunded: 40,
    });

    expect(sent).toEqual([
      {
        distinctId: "7",
        event: "generation delivered",
        properties: {
          action: "roll",
          outcome: "partial",
          creditsCharged: 160,
          creditsRefunded: 40,
          world: "railway:production",
          release: "0123456789abcdef0123456789abcdef01234567",
        },
      },
    ]);
    expect(productEventStreamStatus().sent).toBe(1);
  });

  it("⚠ counts a REFUSAL and sends nothing", () => {
    const { client, sent } = recorder();
    setProductEventClientForTests(client);

    captureProductEvent("generation delivered", 7, {
      action: "roll",
      outcome: "complete",
      creditsCharged: Number.NaN,
      creditsRefunded: 0,
    });

    expect(sent).toEqual([]);
    expect(productEventStreamStatus()).toMatchObject({ refused: 1, sent: 0 });
  });

  it("⚠ counts a DROP separately and still sends — they are different failures", () => {
    const { client, sent } = recorder();
    setProductEventClientForTests(client);

    captureProductEvent("generation started", 7, {
      action: "roll",
      masterPrompt: "a tall woman in a red coat",
      resultUrl: "https://pub-abc.r2.dev/x.png",
    });

    expect(sent.length).toBe(1);
    expect(sent[0].properties).not.toHaveProperty("masterPrompt");
    expect(sent[0].properties).not.toHaveProperty("resultUrl");
    expect(productEventStreamStatus()).toMatchObject({ refused: 0, droppedProperties: 2, sent: 1 });
  });

  it("⚠ never throws, even when the SDK does — a measurement must not become a second fault", () => {
    setProductEventClientForTests({
      capture: () => {
        throw new Error("the SDK exploded");
      },
      flush: async () => undefined,
      shutdown: async () => undefined,
    });

    expect(() => captureProductEvent("generation started", 1, { action: "roll" })).not.toThrow();
  });

  it("drains on shutdown, so a deploy mid-batch loses nothing", async () => {
    const recording = recorder();
    setProductEventClientForTests(recording.client);
    await shutdownProductEvents(100);
    expect(recording.shutdowns).toBe(1);
  });

  it("⚠ a shutdown that throws is swallowed — it runs on the exit path", async () => {
    setProductEventClientForTests({
      capture: () => undefined,
      flush: async () => undefined,
      shutdown: async () => {
        throw new Error("no network on the way out");
      },
    });
    await expect(shutdownProductEvents(10)).resolves.toBeUndefined();
  });
});
