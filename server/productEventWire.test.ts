/**
 * WHAT ACTUALLY LEAVES THE PROCESS — read on the outgoing request, not on a
 * return value (#509 part 2, invariant 5).
 *
 * `server/productEvents.test.ts` drives the transport against a recording fake
 * and proves what `capture` was HANDED. That is necessary and it is not
 * sufficient: between `capture` and the network sits a real SDK that composes a
 * batch, adds its own properties, and compresses the result. The claim this
 * product makes about the event stream is a claim about BYTES —
 *
 *   *no property that the catalogue does not declare ever leaves this process*
 *
 * — and the only honest place to read it is the request.
 *
 * ⚠ **AND IT MATTERS MORE HERE THAN IT DID FOR THE ERROR TRACKER.** Sentry
 * offers `beforeSend`, so part 1 could hang its scrub on the SDK's own last gate
 * and know that even an event the SDK invented passed through it. `posthog-node`
 * removes `before_send` from the options it accepts — proven at the declaration
 * in `server/productEventOptionsDeclared.test.ts` — so there is NO gate under
 * ours. This suite is what stands in for the one the SDK does not provide.
 *
 * # HOW IT DRIVES
 *
 * A REAL `PostHog`, constructed with the REAL `buildProductEventOptions()`, with
 * only its `fetch` replaced. Nothing about the payload path is faked: the same
 * batching, the same envelope, the same gzip. The body is decompressed here
 * because the node client compresses it, and a reader that gave up at the
 * compression would be reading nothing while reporting success.
 */
import { gunzipSync, inflateSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildProductEventOptions,
  captureProductEvent,
  resetProductEventsForTests,
  setProductEventClientForTests,
  type ProductEventClient,
} from "./monitoring/productEvents";

interface SeenRequest {
  url: string;
  method: string;
  body: string;
}

const seen: SeenRequest[] = [];

/**
 * The real client this suite installed, held so its buffer can be drained
 * directly. The transport exports no `flush` — see its own note on why an
 * exported drain with no production caller was deleted rather than kept.
 */
let installed: ProductEventClient | null = null;

/** Drain whatever the installed client is holding. */
async function flushProductEvents(): Promise<void> {
  await installed?.flush();
}

/** Every byte the SDK tried to send, as text — gzip, deflate or plain. */
function readBody(body: unknown): string {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) {
    for (const decompress of [gunzipSync, inflateSync]) {
      try {
        return Buffer.from(decompress(body)).toString("utf8");
      } catch {
        /* Try the next shape; a plain buffer falls through to the raw read. */
      }
    }
    return Buffer.from(body).toString("utf8");
  }
  return String(body ?? "");
}

async function realClientThroughAFakeWire(): Promise<ProductEventClient> {
  const mod = await import("posthog-node");
  return new mod.PostHog("phc_wire_suite_key_never_sent_anywhere", {
    ...buildProductEventOptions(),
    /* One event per batch, so an arm does not have to wait out a timer. It is
       the ONLY option this suite overrides, and it changes when the SDK sends,
       never what it sends. */
    flushAt: 1,
    fetch: async (url: string, options): Promise<{ status: number; text: () => Promise<string>; json: () => Promise<unknown> }> => {
      seen.push({ url, method: options.method, body: readBody(options.body) });
      return { status: 200, text: async () => "{}", json: async () => ({ status: 1 }) };
    },
  }) as unknown as ProductEventClient;
}

beforeEach(async () => {
  seen.length = 0;
  resetProductEventsForTests();
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  process.env.RAILWAY_GIT_COMMIT_SHA = "0123456789abcdef0123456789abcdef01234567";
  installed = await realClientThroughAFakeWire();
  setProductEventClientForTests(installed);
});

afterEach(() => {
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  resetProductEventsForTests();
});

describe("the suite's own controls, before it believes anything it reads (working law 2)", () => {
  it("POSITIVE: an ordinary event does reach the wire, and the reader can read it", async () => {
    captureProductEvent("generation started", 1, { action: "roll" });
    await flushProductEvents();

    expect(seen.length, "nothing was sent — this suite would pass every arm below for the wrong reason").toBeGreaterThan(0);
    const bodies = seen.map((request) => request.body).join("\n");
    expect(bodies).toContain("generation started");
    expect(bodies).toContain("roll");
  });

  it("⚠ NEGATIVE: the reader would SEE a forbidden word if one were there", async () => {
    /* The arms below are worth nothing unless a leak would actually be visible
       to this reader. So: send one through the SDK by hand, around the gate, and
       prove it shows up. If this ever goes quiet, every arm below is a green
       light over an unread wire. */
    const smuggled = await realClientThroughAFakeWire();
    smuggled.capture({
      distinctId: "1",
      event: "generation started",
      properties: { masterPrompt: "a tall woman in a red coat" },
    });
    await smuggled.flush();

    expect(seen.map((request) => request.body).join("\n")).toContain("a tall woman in a red coat");
  });
});

describe("no property the catalogue does not declare reaches the wire", () => {
  it("⚠ drops a recipe field a caller attached, and sends the rest", async () => {
    captureProductEvent("generation delivered", 42, {
      action: "sign",
      outcome: "complete",
      creditsCharged: 450,
      creditsRefunded: 0,
      /* Every one of these is a field the metadata-only boundary forbids
         leaving the building, and a caller could plausibly attach any of them. */
      masterPrompt: "a tall woman in a red coat",
      technicalSchema: { face: "oval" },
      preferences: { vibe: "editorial" },
      resultUrl: "https://pub-abc.r2.dev/casts/secret.png",
      email: "someone@example.com",
      publicMessage: "The engine refused: a tall woman in a red coat",
    });
    await flushProductEvents();

    const bodies = seen.map((request) => request.body).join("\n");
    /* What was asked for is there … */
    expect(bodies).toContain("generation delivered");
    expect(bodies).toContain("sign");
    expect(bodies).toContain("450");
    /* … and not one of the forbidden fields is, by key OR by value. */
    for (const forbidden of [
      "masterPrompt",
      "technicalSchema",
      "preferences",
      "resultUrl",
      "publicMessage",
      "a tall woman in a red coat",
      "oval",
      "editorial",
      "pub-abc.r2.dev",
      "someone@example.com",
    ]) {
      expect(bodies, `${forbidden} reached the wire`).not.toContain(forbidden);
    }
  });

  it("⚠ sends NOTHING AT ALL when a declared property has the wrong shape", async () => {
    /* A refusal is the whole event, not a trimmed one — our own code putting an
       unexpected value in a payload is a defect to read about in the log, and
       half an event would hide it. */
    captureProductEvent("generation delivered", 42, {
      action: "roll",
      outcome: "complete",
      creditsCharged: "a tall woman in a red coat" as unknown as number,
      creditsRefunded: 0,
    });
    await flushProductEvents();

    expect(seen.map((request) => request.body).join("\n")).not.toContain("a tall woman in a red coat");
    expect(seen.filter((request) => request.body.includes("generation delivered"))).toEqual([]);
  });
});

describe("what the SDK adds of its own accord", () => {
  it("⚠ posts to ONE host and ONE path, and never polls for anything else", async () => {
    /*
      The options turn off feature flags and surveys. This is the arm that reads
      whether that is TRUE of the wire rather than true of the options object:
      every request the SDK made, across a capture and a flush, must be the
      event batch. A `/flags`, `/decide` or `/surveys` call here would mean this
      product is talking to a third party on a timer nobody declared.
    */
    captureProductEvent("generation started", 7, { action: "refine" });
    await flushProductEvents();

    expect(seen.length).toBeGreaterThan(0);
    for (const request of seen) {
      expect(request.url, `unexpected outbound call to ${request.url}`).toContain("us.i.posthog.com");
      expect(request.url).not.toMatch(/\/flags|\/decide|\/surveys|remote_config/);
      expect(request.method).toBe("POST");
    }
  });

  it("⚠ carries no IP, and `disableGeoip` is proven ON THE WIRE rather than in the options", async () => {
    captureProductEvent("generation started", 7, { action: "refine" });
    await flushProductEvents();

    const bodies = seen.map((request) => request.body).join("\n");
    /*
      ⚠ THIS ARM WAS WRITTEN THE OTHER WAY ROUND AND THE WIRE CORRECTED IT.
      It first asserted the payload contained no `$geoip` at all, and failed:
      `disableGeoip: true` reaches the request as `"$geoip_disable": true`, which
      is the option WORKING — it is the instruction to PostHog's own ingestion
      not to resolve a country from the sender's address. Reading the bytes
      turned a guess about an option's name into proof that the option travels.
    */
    expect(bodies).toContain('"$geoip_disable":true');
    /* Nothing resolves an address, and no address is sent to resolve. */
    expect(bodies).not.toContain('"$ip"');
    expect(bodies).not.toMatch(/\$geoip_(city|country|latitude|longitude|subdivision)/);
    /*
      THE WHOLE PROPERTY SET THE SDK ADDS, READ RATHER THAN FORBIDDEN — it is
      the library identifying itself and carries nothing of this product's. An
      arm asserting the payload held ONLY our keys would fail on the next SDK
      release for a reason nobody would care about; this one tells a future
      reader exactly what to expect and reddens if that grows.

      Measured on this run, in full:
        {"event":"generation started",
         "properties":{"action":"refine","world":"railway:production",
                       "release":"<sha>","$lib":"posthog-node",
                       "$lib_version":"5.54.1","$is_server":true,
                       "$geoip_disable":true},
         "timestamp":…,"uuid":…,"distinct_id":"7"}
    */
    const payload = JSON.parse(seen[0].body) as {
      batch: { properties: Record<string, unknown>; distinct_id: string }[];
    };
    expect(Object.keys(payload.batch[0].properties).sort()).toEqual([
      "$geoip_disable",
      "$is_server",
      "$lib",
      "$lib_version",
      "action",
      "release",
      "world",
    ]);
    /* The distinct id is an account id and nothing else — no email, no name. */
    expect(payload.batch[0].distinct_id).toBe("7");
  });
});
