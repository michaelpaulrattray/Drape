/**
 * THE SIXTH AUTHENTICATED IMAGE ROUTE, DRIVEN (issue #75).
 *
 * The claim that matters most here is the ALLOWLIST: this route serves
 * exactly the keys the deployed briefing's `eyeItems` name and nothing else
 * under the prefix — so the arm that must exist is a key that is real in the
 * "bucket" (the double would happily serve it) and absent from the briefing,
 * refused 404. The rest are the standard doors in their standard order:
 * authentication, suspension/lockout, admin role, CREW_TAB_SCOPE (404, the
 * same does-not-exist the page gives), rate limit, name shape.
 */
import express from "express";
import { describe, expect, it } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import {
  createCrewEyeFrameRouter,
  type CrewEyeFrameRouteDependencies,
} from "./crewEyeFrames";

const FRAME_NAME = "3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";
const FRAME_KEY = `crew-eye/${FRAME_NAME}`;
const FRAME_BYTES = Buffer.from("png-bytes-stand-in");

const ADMIN = { id: 1, role: "admin", suspendedAt: null, lockedUntil: null } as const;

async function get(
  overrides: Partial<CrewEyeFrameRouteDependencies>,
  path = `/api/crew/eye-frame/${FRAME_NAME}`,
): Promise<{ status: number; headers: Headers; body: Buffer; json: unknown }> {
  const app = express();
  app.use(createCrewEyeFrameRouter({
    authenticate: async () => ({ ...ADMIN }),
    crewTabEnabled: () => true,
    rateLimit: () => ({ allowed: true }),
    servableKeys: () => new Set([FRAME_KEY]),
    readBytes: async (key) => {
      if (key !== FRAME_KEY) throw new Error(`unexpected key ${key}`);
      return { bytes: FRAME_BYTES, contentType: "image/png" };
    },
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
    server.close();
  }
}

describe("/api/crew/eye-frame — the doors, in order", () => {
  it("serves a briefing-named frame to an in-scope admin, as image bytes", async () => {
    const { status, headers, body } = await get({});
    expect(status).toBe(200);
    expect(headers.get("content-type")).toBe("image/png");
    expect(headers.get("cache-control")).toBe("private, max-age=3600");
    expect(body.equals(FRAME_BYTES)).toBe(true);
  });

  it("401 with no session", async () => {
    const { status } = await get({
      authenticate: async () => { throw new Error("no cookie"); },
    });
    expect(status).toBe(401);
  });

  it("403 for a suspended or locked account", async () => {
    expect((await get({
      authenticate: async () => ({ ...ADMIN, suspendedAt: new Date() }),
    })).status).toBe(403);
    expect((await get({
      authenticate: async () => ({ ...ADMIN, lockedUntil: new Date(Date.now() + 60_000) }),
    })).status).toBe(403);
  });

  it("403 for a non-admin — moderator included; the gallery is his briefing", async () => {
    expect((await get({ authenticate: async () => ({ ...ADMIN, role: "moderator" }) })).status).toBe(403);
    expect((await get({ authenticate: async () => ({ ...ADMIN, role: "user" }) })).status).toBe(403);
  });

  it("404 outside CREW_TAB_SCOPE — the surface does not exist, same as the page", async () => {
    const { status } = await get({ crewTabEnabled: () => false });
    expect(status).toBe(404);
  });

  it("429 over the rate limit", async () => {
    const { status } = await get({ rateLimit: () => ({ allowed: false }) });
    expect(status).toBe(429);
  });

  it("⚠ THE ALLOWLIST: a key the bucket holds but no briefing edition names is 404", async () => {
    /* The double's readBytes would serve this name happily — the refusal must
       come from the briefing-derived set, or the route is an open proxy over
       the prefix. */
    const otherName = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png";
    const { status } = await get({}, `/api/crew/eye-frame/${otherName}`);
    expect(status).toBe(404);
  });

  it("404 for a name outside the pinned shape — traversal shapes never reach storage", async () => {
    for (const bad of [
      "not-a-uuid.png",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301.svg",
      "..%2Fsecrets.png",
    ]) {
      const { status } = await get(
        { readBytes: async () => { throw new Error("must not be called"); } },
        `/api/crew/eye-frame/${bad}`,
      );
      expect(status, bad).toBe(404);
    }
  });

  it("502, said plainly, when a briefing-named frame is missing from storage", async () => {
    const { status, json } = await get({
      readBytes: async () => { throw new Error("NoSuchKey"); },
    });
    expect(status).toBe(502);
    expect((json as { error: string }).error).toContain("could not be read");
  });
});
