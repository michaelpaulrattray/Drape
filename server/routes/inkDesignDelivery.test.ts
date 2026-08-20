import { createHash } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { inkDesignImagePath } from "../../shared/inkDesignDelivery";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";
import {
  createInkDesignDeliveryRouter,
  type InkDesignDeliveryDependencies,
} from "./inkDesignDelivery";

/**
 * THE SHOWN CUT'S DOOR.
 *
 * Two families of assertion live here and they are not the same thing.
 *
 * The first is access control — the invariants this codebase has broken before
 * elsewhere: ownership re-proved in the statement that loads (invariant 1), the
 * user id taken from the session and never from the URL (invariant 3), and a
 * refusal that tells a probe nothing.
 *
 * The second is the one this route exists for. `CASTING_INK_CUT_SCOPE` changes
 * what a customer's stored design IS, and the whole point of showing it to her
 * is that what she looks at is what we hold. So the route refuses rather than
 * serving an object whose bytes are not the ones the row describes, and refuses
 * rather than serving a type its own upload door cannot write — **both arms are
 * driven with a row that would pass every other check**, because a refusal
 * nobody can make fire is a comment.
 */

const OWNER = 7;
const DESIGN_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

async function designBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
}

function rowFor(bytes: Buffer, overrides: Partial<StoredInkDesign> = {}): StoredInkDesign {
  return {
    publicId: DESIGN_ID,
    candidateId: 91,
    placement: "upperArm",
    side: "right",
    provenance: "synthetic",
    intents: ["tattoo"],
    storageKey: "casting-v2/ink/designs/whatever.png",
    digest: createHash("sha256").update(bytes).digest("hex"),
    mime: "image/png",
    byteSize: bytes.byteLength,
    width: 300,
    height: 300,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  } as StoredInkDesign;
}

async function get(
  overrides: Partial<InkDesignDeliveryDependencies>,
  path: string = inkDesignImagePath(DESIGN_ID),
): Promise<{ status: number; headers: Headers; body: Buffer; json: unknown }> {
  const bytes = await designBytes();
  const app = express();
  app.use(createInkDesignDeliveryRouter({
    authenticate: async () => ({ id: OWNER, suspendedAt: null, lockedUntil: null }),
    rateLimit: () => ({ allowed: true, resetIn: 0 }),
    load: async () => rowFor(bytes),
    readBytes: async () => ({ bytes }),
    ...overrides,
  }));
  const server = await listenOnFetchablePort((bound) => app.listen(bound, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`);
    const body = Buffer.from(await response.arrayBuffer());
    let json: unknown = null;
    try { json = JSON.parse(body.toString("utf8")); } catch { /* an image */ }
    return { status: response.status, headers: response.headers, body, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("who may look at a stored design", () => {
  it("refuses an unauthenticated request", async () => {
    const response = await get({ authenticate: async () => null });
    expect(response.status).toBe(401);
  });

  it("refuses when authentication itself throws, rather than serving", async () => {
    const response = await get({ authenticate: async () => { throw new Error("no session"); } });
    expect(response.status).toBe(401);
  });

  it("refuses a suspended account", async () => {
    const response = await get({
      authenticate: async () => ({ id: OWNER, suspendedAt: new Date(), lockedUntil: null }),
    });
    expect(response.status).toBe(403);
  });

  it("refuses a locked account until the lock expires", async () => {
    const response = await get({
      authenticate: async () => ({
        id: OWNER,
        suspendedAt: null,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    });
    expect(response.status).toBe(403);
  });

  it("answers a rate-limited account with a real 429 and a Retry-After", async () => {
    const response = await get({ rateLimit: () => ({ allowed: false, resetIn: 4_000 }) });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("4");
  });

  /*
    THE ONE THAT MATTERS. A stranger's design and a design that never existed
    are the same 404 with the same body — the lookup is owner-scoped in one
    statement, so the response cannot be used to discover that an id is real.
  */
  it("gives a stranger's design the same answer as one that never existed", async () => {
    const foreign = await get({ load: async () => null });
    const missing = await get({ load: async () => null });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.json).toEqual(missing.json);
  });

  /*
    THE CONTRACT PROVEN AT THE WIRE (fable-1138 §2a). The arm above this one
    hands the route a `load` that simply answers `null`, which proves the route
    forwards a refusal — it does not prove the route ASKS as the right person.
    So this one plants an owner-scoped store: the design exists, and it belongs
    to somebody else. The assertion is on the RESPONSE, not on a spy.
  */
  it("answers a design belonging to somebody else with NOT_FOUND, at the route", async () => {
    const bytes = await designBytes();
    const ownedByAnother = async (input: { userId: number; designPublicId: string }) => (
      input.userId === OWNER && input.designPublicId === DESIGN_ID ? rowFor(bytes) : null
    );
    const stranger = await get({
      authenticate: async () => ({ id: OWNER + 2, suspendedAt: null, lockedUntil: null }),
      load: ownedByAnother,
    });
    expect(stranger.status).toBe(404);
    expect(stranger.body.equals(bytes)).toBe(false);

    /* POSITIVE CONTROL on the same store, so the 404 above is known to be the
       OWNERSHIP refusing rather than the fake refusing everything. */
    const owner = await get({ load: ownedByAnother });
    expect(owner.status).toBe(200);
    expect(owner.body.equals(bytes)).toBe(true);
  });

  it("passes the AUTHENTICATED user's id to the lookup, never the URL's", async () => {
    const bytes = await designBytes();
    const load = vi.fn(async () => rowFor(bytes));
    await get({ load });
    expect(load).toHaveBeenCalledWith({ userId: OWNER, designPublicId: DESIGN_ID });
  });

  it("never reaches the database for an id that is not a design id", async () => {
    const load = vi.fn(async () => null);
    const response = await get({ load }, "/api/ink-design/not-a-uuid");
    expect(response.status).toBe(404);
    /* Asserted rather than described: the malformed-id branch says the
       statement below it is never reached, and this is what proves it. */
    expect(load).not.toHaveBeenCalled();
  });
});

describe("what comes back", () => {
  it("serves the design's own bytes, under the row's content type", async () => {
    const bytes = await designBytes();
    const response = await get({});
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    /* The BYTES are the fact — not the length, not the type header. */
    expect(response.body.equals(bytes)).toBe(true);
  });

  it("is never cached by a shared cache and never sniffed", async () => {
    const response = await get({});
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe("inline");
  });

  it("is reached at the address the shared builder spells", async () => {
    /* The path exists in ONE place. If the route's mount and
       `inkDesignImagePath` ever drift, every other test in this file still
       passes and this one goes red. */
    const response = await get({}, inkDesignImagePath(DESIGN_ID));
    expect(response.status).toBe(200);
  });
});

describe("the refusals that are not about who is asking", () => {
  /*
    NEGATIVE CONTROL WITH A ROW THAT WOULD OTHERWISE PASS. The owner is right,
    the id is right, the bytes match their digest — only the recorded type is
    one the upload door cannot write. Nothing is served.
  */
  it("refuses a row naming a content type the upload door cannot write", async () => {
    const bytes = await designBytes();
    const response = await get({ load: async () => rowFor(bytes, { mime: "image/svg+xml" }) });
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.body.equals(bytes)).toBe(false);
  });

  /*
    THE MOVED-OBJECT REFUSAL. The row is entirely valid; the object at its key
    is a different one. The plate mint already refuses to draw from this, and a
    surface that showed it would be captioning somebody else's picture as her
    design.
  */
  it("refuses when the object at the key is not the object the row describes", async () => {
    const other = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
    const response = await get({ readBytes: async () => ({ bytes: other }) });
    expect(response.status).toBe(500);
    expect(response.body.equals(other)).toBe(false);
  });

  /*
    POSITIVE CONTROL FOR THE ARM ABOVE, so the digest comparison is known to be
    capable of passing as well as failing: the same route, the same shape of
    substituted read, but the row's digest taken off the substituted bytes.
  */
  it("serves those same substituted bytes when the row describes THEM", async () => {
    const other = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
    const response = await get({
      load: async () => rowFor(other),
      readBytes: async () => ({ bytes: other }),
    });
    expect(response.status).toBe(200);
    expect(response.body.equals(other)).toBe(true);
  });

  it("refuses rather than half-serving when the bytes cannot be read at all", async () => {
    const response = await get({ readBytes: async () => { throw new Error("gone"); } });
    expect(response.status).toBe(500);
  });

  it("answers a failed lookup with a retryable 503, not a 404", async () => {
    /* A database that is down is not a design that does not exist, and a 404
       here would teach a customer that her design had been deleted. */
    const response = await get({ load: async () => { throw new Error("db down"); } });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("2");
  });
});
