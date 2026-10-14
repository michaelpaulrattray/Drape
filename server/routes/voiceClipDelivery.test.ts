import { createHash } from "node:crypto";
import express from "express";
import { describe, expect, it, vi } from "vitest";

import {
  VOICE_CLIP_CONTENT_TYPE,
  VOICE_CLIP_PATH_LEAF,
  VOICE_CLIP_PATH_PREFIX,
  VOICE_CLIP_ROUTE_PATTERN,
  voiceClipPath,
} from "../../shared/voiceClipDelivery";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import {
  createVoiceClipDeliveryRouter,
  type VoiceClipDeliveryDependencies,
} from "./voiceClipDelivery";

/**
 * THE OWNER-ONLY CLIP ROUTE, DRIVEN — N4b-2 (#2470).
 *
 * Every arm goes through a REAL Express app and a real HTTP request, because
 * the thing under test is a request path: a unit test calling the handler
 * directly cannot see a middleware order, a header that was never set, or a
 * body that went out beside a 500.
 *
 * ⚠ **THE ARMS THAT MATTER MOST ARE THE REFUSALS, AND EACH IS DRIVEN FROM THE
 * SHAPE THAT WOULD SHIP IT BROKEN**: a stranger's cast answering 404 rather
 * than 403 (so the response cannot be used to discover which ids are real), a
 * digest mismatch refusing rather than serving, and — the one a reviewer should
 * look for — **the storage key never appearing in anything that leaves this
 * route**, which is a security rule on a public bucket and not tidiness.
 */

const CLIP = Buffer.from("not really an mp3, but these exact bytes", "utf8");
const DIGEST = createHash("sha256").update(CLIP).digest("hex");

const OWNED = {
  modelId: 300,
  clipStorageKey: "casting/voices/1/300/3f1e9c62-0000-4000-8000-aaaaaaaaaaaa.mp3",
  clipSha256: DIGEST,
  clipBytes: CLIP.byteLength,
  clipContentType: VOICE_CLIP_CONTENT_TYPE,
};

function appWith(overrides: Partial<VoiceClipDeliveryDependencies> = {}) {
  const dependencies: VoiceClipDeliveryDependencies = {
    authenticate: async () => ({ id: 1, suspendedAt: null, lockedUntil: null }),
    rateLimit: () => ({ allowed: true, resetIn: 0 }),
    load: async () => OWNED,
    readBytes: async () => ({ bytes: CLIP }),
    touch: async () => {},
    ...overrides,
  };
  const app = express();
  app.use(createVoiceClipDeliveryRouter(dependencies));
  return app;
}

/**
 * ⚠ **THE PORT COMES FROM `listenOnFetchablePort`, NEVER FROM A BARE
 * `listen(0)`.** `server/testing/fetchablePort.ts` carries the measurement: on
 * this machine the dynamic port range starts at 1024, so an OS-chosen port can
 * land on one of the Fetch standard's *bad ports* and `fetch` refuses before a
 * packet leaves — roughly one bind in seven hundred, which reads as a timing
 * flake and is not one. The first draft of this file bound directly and
 * `server/testing/fetchablePort.test.ts` caught it on the gate, which is that
 * guard doing exactly its job.
 */
async function get(
  app: express.Express,
  path = voiceClipPath("KI-WHGH-MQQ8-D7MV-8V8G"),
  method = "GET",
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`, { method });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    return { status: response.status, body: await response.text(), headers };
  } finally {
    server.close();
  }
}

describe("the voice clip route — the path spelling", () => {
  it("builds its pattern and its path from the same parts", () => {
    /* The guard the literal's docblock promises: the pattern is a literal for
       the Atlas reader's sake, so nothing but this holds it to the parts. */
    expect(VOICE_CLIP_ROUTE_PATTERN).toBe(`${VOICE_CLIP_PATH_PREFIX}/:castId/${VOICE_CLIP_PATH_LEAF}`);
    expect(voiceClipPath("KI-ABCD")).toBe(`${VOICE_CLIP_PATH_PREFIX}/KI-ABCD/${VOICE_CLIP_PATH_LEAF}`);
  });

  it("escapes a cast id rather than pasting it into a path", () => {
    expect(voiceClipPath("a/b?c")).toBe("/api/cast/a%2Fb%3Fc/voice-clip");
  });
});

describe("the voice clip route — who may hear it", () => {
  it("serves the owner the exact bytes the row describes", async () => {
    const answer = await get(appWith());
    expect(answer.status).toBe(200);
    expect(answer.body).toBe(CLIP.toString("utf8"));
    expect(answer.headers["content-type"]).toContain(VOICE_CLIP_CONTENT_TYPE);
    expect(answer.headers["cache-control"]).toBe("private, no-store");
    expect(answer.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuses a request with no session", async () => {
    const answer = await get(appWith({ authenticate: async () => null }));
    expect(answer.status).toBe(401);
  });

  it("answers 503 when the session check could not finish, never 401", async () => {
    /* #1997: a lookup that failed is not "not signed in". */
    const answer = await get(appWith({
      authenticate: async () => { throw new Error("db down"); },
    }));
    expect(answer.status).toBe(503);
  });

  it("refuses a suspended account", async () => {
    const answer = await get(appWith({
      authenticate: async () => ({ id: 1, suspendedAt: new Date(), lockedUntil: null }),
    }));
    expect(answer.status).toBe(403);
  });

  it("refuses a locked account and lets a lapsed lock through", async () => {
    const future = new Date(Date.now() + 60_000);
    expect((await get(appWith({
      authenticate: async () => ({ id: 1, suspendedAt: null, lockedUntil: future }),
    }))).status).toBe(403);
    const past = new Date(Date.now() - 60_000);
    expect((await get(appWith({
      authenticate: async () => ({ id: 1, suspendedAt: null, lockedUntil: past }),
    }))).status).toBe(200);
  });

  it("returns a real 429 with Retry-After, never a 200 carrying a message", async () => {
    const answer = await get(appWith({ rateLimit: () => ({ allowed: false, resetIn: 4_000 }) }));
    expect(answer.status).toBe(429);
    expect(answer.headers["retry-after"]).toBe("4");
  });

  it("gives a stranger's cast and a cast that never existed the same 404", async () => {
    const answer = await get(appWith({ load: async () => null }));
    expect(answer.status).toBe(404);
    /* Nothing about WHICH of the two it was may reach the caller. */
    expect(answer.body).toBe(JSON.stringify({ error: "Not found" }));
  });

  it("passes the AUTHENTICATED user id to the statement, never anything from the URL", async () => {
    const load = vi.fn(async () => OWNED);
    await get(appWith({
      authenticate: async () => ({ id: 77, suspendedAt: null, lockedUntil: null }),
      load,
    }), voiceClipPath("KI-WHGH-MQQ8-D7MV-8V8G"));
    expect(load).toHaveBeenCalledWith(77, "KI-WHGH-MQQ8-D7MV-8V8G");
  });

  it("answers 503 when the lookup itself fails, so a fault is not a missing voice", async () => {
    const answer = await get(appWith({
      load: async () => { throw new Error("lookup exploded"); },
    }));
    expect(answer.status).toBe(503);
    expect(answer.headers["retry-after"]).toBe("2");
  });
});

describe("the voice clip route — what it refuses about the bytes", () => {
  it("refuses a row naming a content type the Keep road cannot write", async () => {
    const answer = await get(appWith({
      load: async () => ({ ...OWNED, clipContentType: "audio/wav" }),
    }));
    expect(answer.status).toBe(500);
  });

  it("refuses when the object is a different SIZE from the row's", async () => {
    const answer = await get(appWith({
      readBytes: async () => ({ bytes: Buffer.concat([CLIP, Buffer.from("x")]) }),
    }));
    expect(answer.status).toBe(500);
  });

  it("refuses when the object is not the object the row describes", async () => {
    /* Same length, different bytes: only the digest can catch this one, which
       is why the size check above is not a substitute for it. */
    const swapped = Buffer.from(CLIP);
    swapped[0] = swapped[0] === 0 ? 1 : 0;
    const answer = await get(appWith({ readBytes: async () => ({ bytes: swapped }) }));
    expect(answer.status).toBe(500);
  });

  it("refuses when the bytes cannot be read at all", async () => {
    const answer = await get(appWith({
      readBytes: async () => { throw new Error("r2 down"); },
    }));
    expect(answer.status).toBe(500);
  });

  it("never lets the storage key reach the caller, on any road", async () => {
    /*
      ⚠ THE ONE ARM THIS ROUTE EXISTS FOR. On a public bucket the key IS the
      credential, and a cloning source's address must not travel — so it must
      not be in a body, a header, or an error on ANY of the roads, including the
      failure roads where an implementation is most tempted to be helpful.
    */
    const roads = [
      appWith(),
      appWith({ load: async () => null }),
      appWith({ readBytes: async () => { throw new Error("r2 down"); } }),
      appWith({ readBytes: async () => ({ bytes: Buffer.from("different") }) }),
      appWith({ load: async () => ({ ...OWNED, clipContentType: "audio/wav" }) }),
    ];
    for (const app of roads) {
      const answer = await get(app);
      const everything = answer.body + JSON.stringify(answer.headers);
      expect(everything).not.toContain(OWNED.clipStorageKey);
      expect(everything).not.toContain("casting/voices");
    }
  });
});

describe("the voice clip route — HEAD, and the cache's timestamp", () => {
  it("answers HEAD without reading the body", async () => {
    const readBytes = vi.fn(async () => ({ bytes: CLIP }));
    const answer = await get(appWith({ readBytes }), undefined, "HEAD");
    expect(answer.status).toBe(200);
    /* ~2.1 MB per room visit is what this saves; a HEAD that read the object
       would make the room pay for a download nobody plays. */
    expect(readBytes).not.toHaveBeenCalled();
  });

  it("answers HEAD 404 for a cast with no kept voice", async () => {
    const answer = await get(appWith({ load: async () => null }), undefined, "HEAD");
    expect(answer.status).toBe(404);
  });

  it("writes lastUsedAt on a served clip, with the authenticated owner", async () => {
    const touch = vi.fn(async () => {});
    await get(appWith({ touch }));
    expect(touch).toHaveBeenCalledWith({ userId: 1, modelId: OWNED.modelId });
  });

  it("still plays when the lastUsedAt write fails", async () => {
    /* Bookkeeping about OUR cache must never refuse a customer's press. */
    const answer = await get(appWith({
      touch: async () => { throw new Error("update failed"); },
    }));
    expect(answer.status).toBe(200);
    expect(answer.body).toBe(CLIP.toString("utf8"));
  });

  it("does not write lastUsedAt for a HEAD, which plays nothing", async () => {
    const touch = vi.fn(async () => {});
    await get(appWith({ touch }), undefined, "HEAD");
    expect(touch).not.toHaveBeenCalled();
  });
});
