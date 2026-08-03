import express from "express";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { createCharacterSheetRouter } from "./characterSheet";

/**
 * The character sheet's door.
 *
 * Everything here is an access-control assertion. The sheet is a composite of
 * somebody's face, served over HTTP, and the invariants it has to satisfy are
 * the ones that have been broken before elsewhere in this codebase: ownership
 * re-proved in the statement that loads (invariant 1), a refusal that tells a
 * probe nothing, and no shared caching of a private image.
 */

const CAST = { id: 42, name: "Jericho", agencyId: "KI-TEST", userId: 7 } as never;

async function swatch(): Promise<Buffer> {
  return sharp({ create: { width: 100, height: 150, channels: 3, background: "#888888" } })
    .png()
    .toBuffer();
}

function routerWith(overrides: Record<string, unknown> = {}) {
  return createCharacterSheetRouter({
    authenticate: async () => ({ id: 7, suspendedAt: null, lockedUntil: null }),
    loadCast: async () => CAST,
    loadAssets: async () => [{
      id: 1, modelId: 42, viewType: "frontClose", resolution: "1K",
      storageKey: "casting-v2/anchor.png", storageUrl: "https://example/anchor.png",
      pointsCost: 0, pinned: false, status: null,
      provenance: { role: "anchor" }, createdAt: new Date(),
    }] as never,
    ...overrides,
  } as never);
}

/** A real listening server, the way every other route suite here drives one. */
async function get(
  overrides: Record<string, unknown>,
  path: string,
): Promise<{ status: number; headers: Headers; body: Buffer; json: unknown }> {
  const app = express();
  app.use(routerWith(overrides));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = Buffer.from(await response.arrayBuffer());
    let json: unknown = null;
    try { json = JSON.parse(body.toString("utf8")); } catch { /* an image */ }
    return { status: response.status, headers: response.headers, body, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/*
  The pack loader reaches R2 for bytes. These tests are about the DOOR, so the
  fetch is stubbed at the module seam — a route suite that quietly pulled real
  objects over the network would be a slow, flaky test of somebody else's
  uptime.
*/
vi.mock("../castingV2/characterSheetPack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../castingV2/characterSheetPack")>();
  return {
    ...actual,
    loadSheetCells: vi.fn(async (assets: readonly unknown[]) =>
      assets.length === 0
        ? []
        : [{ slot: "anchor" as const, bytes: await swatch(), label: "Signed" }]),
  };
});

describe("who may download a character sheet", () => {
  it("refuses an unauthenticated request", async () => {
    const response = await get({ authenticate: async () => null }, "/api/cast/KI-TEST/sheet");
    expect(response.status).toBe(401);
  });

  it("refuses a suspended account", async () => {
    const response = await get({ authenticate: async () => ({ id: 7, suspendedAt: new Date(), lockedUntil: null }), }, "/api/cast/KI-TEST/sheet");
    expect(response.status).toBe(403);
  });

  it("refuses a locked account until the lock expires", async () => {
    const response = await get({ authenticate: async () => ({
        id: 7, suspendedAt: null, lockedUntil: new Date(Date.now() + 60_000),
      }), }, "/api/cast/KI-TEST/sheet");
    expect(response.status).toBe(403);
  });

  /*
    THE ONE THAT MATTERS. A Cast belonging to somebody else, a deleted Cast and
    a Cast that never existed all return the SAME 404 — the lookup is
    owner-scoped and liveness-scoped in one statement, so the response cannot be
    used to discover that an id is real.
  */
  it("gives a stranger's Cast the same answer as a Cast that never existed", async () => {
    const foreign = await get({ loadCast: async () => null }, "/api/cast/KI-SOMEONE-ELSE/sheet");
    const missing = await get({ loadCast: async () => null }, "/api/cast/KI-NOT-REAL/sheet");

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.json).toEqual(missing.json);
  });

  it("passes the AUTHENTICATED user's id to the lookup, never the URL's", async () => {
    const loadCast = vi.fn(async () => CAST);
    await get({ loadCast }, "/api/cast/KI-TEST/sheet");
    expect(loadCast).toHaveBeenCalledWith(7, "KI-TEST");
  });
});

describe("what comes back", () => {
  it("serves a JPEG the browser will save rather than render", async () => {
    const response = await get({}, "/api/cast/KI-TEST/sheet");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).toContain("Jericho");
    const meta = await sharp(response.body).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("never lets a shared cache hold one owner's face", async () => {
    const response = await get({}, "/api/cast/KI-TEST/sheet");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  /*
    A Cast that is still building has no views yet. That is a real state, not an
    error, and it must not be answered with a blank image pretending to be a
    sheet.
  */
  it("says so plainly when there is nothing in the pack yet", async () => {
    const response = await get({ loadAssets: async () => [] as never }, "/api/cast/KI-TEST/sheet");
    expect(response.status).toBe(409);
  });

  it("sanitises a name before putting it in a header", async () => {
    const response = await get({ loadCast: async () => ({ ...CAST, name: 'ev"il\r\nX-Injected: yes' }) as never, }, "/api/cast/KI-TEST/sheet");
    expect(response.headers.get("content-disposition")).not.toContain('"il');
    expect(response.headers.get("x-injected")).toBeNull();
  });
});
