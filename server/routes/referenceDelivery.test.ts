import { createHash } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { REFERENCE_IMAGE_PATH_PREFIX, referenceImagePath } from "../../shared/referenceDelivery";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import {
  createReferenceDeliveryRouter,
  type ReferenceDeliveryDependencies,
} from "./referenceDelivery";

/**
 * THE DOOR ONTO A PICTURE SHE ATTACHED — the fifth authenticated image route.
 *
 * Two families of assertion live here and they are not the same thing.
 *
 * The first is ACCESS CONTROL, and it is the reason this route exists at all
 * rather than a public address: a customer's photograph is never at one
 * (`askReference`'s own rule), so the invariants this codebase has broken
 * elsewhere are what stand in for that — ownership re-proved in the statement
 * that loads (invariant 1), the user id from the session and never from the URL
 * (invariant 3), and a refusal that tells a probe nothing.
 *
 * The second is what the chip promises. It shows her the picture she gave, so
 * the route refuses rather than serving an object whose bytes are not the ones
 * the row describes, and refuses rather than serving a type its own attach door
 * cannot write — **both driven with a row that would pass every other check**,
 * because a refusal nobody can make fire is a comment.
 */

const OWNER = 7;
const REFERENCE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

async function pictureBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 240, height: 240, channels: 3, background: { r: 20, g: 90, b: 160 } },
  }).png().toBuffer();
}

function rowFor(bytes: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    storageKey: "casting-v2/reference/whatever.png",
    digest: createHash("sha256").update(bytes).digest("hex"),
    mime: "image/png",
    ...overrides,
  };
}

async function get(
  overrides: Partial<ReferenceDeliveryDependencies>,
  path: string = referenceImagePath(REFERENCE_ID),
): Promise<{ status: number; headers: Headers; body: Buffer; json: unknown }> {
  const bytes = await pictureBytes();
  const app = express();
  app.use(createReferenceDeliveryRouter({
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

describe("who may look at a picture she attached", () => {
  it("refuses an unauthenticated request", async () => {
    expect((await get({ authenticate: async () => null })).status).toBe(401);
  });

  it("refuses when authentication itself throws, rather than serving", async () => {
    const response = await get({
      authenticate: async () => { throw new Error("no session"); },
    });
    expect(response.status).toBe(401);
  });

  it("refuses a suspended account", async () => {
    const response = await get({
      authenticate: async () => ({ id: OWNER, suspendedAt: new Date(), lockedUntil: null }),
    });
    expect(response.status).toBe(403);
  });

  it("refuses a locked account until the lock expires", async () => {
    const locked = await get({
      authenticate: async () => ({
        id: OWNER, suspendedAt: null, lockedUntil: new Date(Date.now() + 60_000),
      }),
    });
    expect(locked.status).toBe(403);
    /* CONTROL — an expired lock is not a lock, or the arm above would pass for
       every account that had ever been locked. */
    const expired = await get({
      authenticate: async () => ({
        id: OWNER, suspendedAt: null, lockedUntil: new Date(Date.now() - 60_000),
      }),
    });
    expect(expired.status).toBe(200);
  });

  it("answers a rate-limited account with a real 429 and a Retry-After", async () => {
    /* A real status, never a 200 carrying an error field the client cannot tell
       from a validation failure (invariant 6). */
    const response = await get({ rateLimit: () => ({ allowed: false, resetIn: 30_000 }) });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("gives a stranger's picture the same answer as one that never existed", async () => {
    /* Both 404, byte for byte, so the response cannot be used to discover that
       an id is real. */
    const stranger = await get({ load: async () => null });
    const missing = await get({ load: async () => null });
    expect(stranger.status).toBe(404);
    expect(stranger.json).toEqual(missing.json);
  });

  it("⚠ PASSES THE AUTHENTICATED USER'S ID TO THE LOOKUP, never the URL's", async () => {
    /* Invariant 3, at the one call that decides whose picture this is. */
    const load = vi.fn().mockResolvedValue(rowFor(await pictureBytes()));
    await get({ load, authenticate: async () => ({ id: 99, suspendedAt: null, lockedUntil: null }) });
    expect(load).toHaveBeenCalledWith({ userId: 99, attachmentPublicId: REFERENCE_ID });
  });

  it("never reaches the database for an id that is not an attachment id", async () => {
    /* A malformed id is answered exactly as a stranger's is, and the statement
       is not reached at all — so a probe cannot use the shape of the id to
       learn anything either. */
    const load = vi.fn();
    const response = await get({ load }, `${REFERENCE_IMAGE_PATH_PREFIX}/not-a-uuid`);
    expect(response.status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("what it serves, and what it refuses to serve", () => {
  it("serves her own bytes, under the row's content type", async () => {
    const bytes = await pictureBytes();
    const response = await get({ readBytes: async () => ({ bytes }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.body.equals(bytes)).toBe(true);
  });

  it("is never cached by a shared cache and never sniffed", async () => {
    /* One person's photograph behind an authenticated route: there is no shared
       cache it may sit in, and the type is the row's rather than a browser's
       guess. */
    const response = await get({});
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("is reached at the address the shared builder spells", async () => {
    /* One spelling of this address in the product (working law 4): if the route
       and the builder ever disagree, this is what says so. */
    const response = await get({}, referenceImagePath(REFERENCE_ID));
    expect(response.status).toBe(200);
  });

  it("refuses a row naming a content type the attach door cannot write", async () => {
    /* Driven with a row that would otherwise serve perfectly — a refusal nobody
       can make fire is a comment. */
    const bytes = await pictureBytes();
    const response = await get({ load: async () => rowFor(bytes, { mime: "image/svg+xml" }) });
    expect(response.status).toBe(500);
    expect(response.body.toString("utf8")).not.toContain("svg");
  });

  it("⚠ REFUSES when the object at the key is not the object the row describes", async () => {
    /*
      The bytes are the fact. Showing her a different object and captioning it
      as the picture she gave is exactly what this chip exists to prevent, and
      the repaint road already refuses a reference whose bytes have moved.
    */
    const other = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 250, g: 0, b: 0 } },
    }).png().toBuffer();
    const response = await get({ readBytes: async () => ({ bytes: other }) });
    expect(response.status).toBe(500);
  });

  it("CONTROL — serves those same substituted bytes when the row describes THEM", async () => {
    /* Without this the arm above could be passing because the substitute is
       malformed rather than because the digests differ. */
    const other = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 250, g: 0, b: 0 } },
    }).png().toBuffer();
    const response = await get({
      load: async () => rowFor(other),
      readBytes: async () => ({ bytes: other }),
    });
    expect(response.status).toBe(200);
    expect(response.body.equals(other)).toBe(true);
  });

  it("refuses rather than half-serving when the bytes cannot be read at all", async () => {
    const response = await get({ readBytes: async () => { throw new Error("R2 said no"); } });
    expect(response.status).toBe(500);
  });

  it("answers a failed lookup with a retryable 503, not a 404", async () => {
    /* A database that is down is not a picture that does not exist, and telling
       her it is would be the product lying about her own upload. */
    const response = await get({ load: async () => { throw new Error("db down"); } });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("2");
  });
});
