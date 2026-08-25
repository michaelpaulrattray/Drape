/**
 * THE HERO ASSET ALLOWLIST IS AN OWN-PROPERTY LOOKUP (issue #33, the Warden's
 * first semgrep reading).
 *
 * `HERO_ASSETS` is a plain object. Before this test, `/api/hero/constructor`
 * read `Object`'s constructor out of the prototype — truthy — and passed the
 * "unknown asset" door with a FUNCTION for a storage key. The arm that
 * matters is the prototype name refused 404 before storage is asked at all;
 * the real key beside it proves the door still opens.
 */
import express from "express";
import { describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "./testing/fetchablePort";

const storageGet = vi.fn(async (key: unknown) => {
  throw new Error(`storage asked for ${String(key)}`);
});
vi.mock("./storage", () => ({ storageGet: (key: unknown) => storageGet(key) }));

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const { default: heroRouter } = await import("./heroProxy");
  const app = express();
  app.use(heroRouter);
  const server = await listenOnFetchablePort((bound) => app.listen(bound, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`);
    let json: unknown = null;
    try { json = await response.json(); } catch { /* bytes */ }
    return { status: response.status, json };
  } finally {
    server.close();
  }
}

describe("/api/hero/:asset — the allowlist is own properties only", () => {
  it("refuses a prototype name (constructor) 404 without touching storage", async () => {
    storageGet.mockClear();
    const { status, json } = await get("/api/hero/constructor");
    expect(status).toBe(404);
    expect(json).toEqual({ error: "Unknown asset" });
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("refuses an unknown name 404 without touching storage", async () => {
    storageGet.mockClear();
    const { status } = await get("/api/hero/nope");
    expect(status).toBe(404);
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("still asks storage for a real key (the door opens)", async () => {
    storageGet.mockClear();
    const { status } = await get("/api/hero/base");
    // the double throws, so the route answers 500 — the point is the ASK
    expect(status).toBe(500);
    expect(storageGet).toHaveBeenCalledWith("hero/base-v3.png");
  });
});
