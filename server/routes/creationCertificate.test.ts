/**
 * THE CERTIFICATE'S DOOR — N2d-2 (#2312).
 *
 * A real listening server, driven over HTTP the way the character sheet's
 * suite drives its route. Everything here is an access-control assertion
 * first: the session's user — never the URL — scopes every read; a stranger's
 * cast, a deleted cast, a cast whose scope is off and a cast that never
 * existed all answer the SAME 404; the `HEAD` the room asks with answers 200
 * only when a download would succeed; and nothing from the recipe reaches the
 * file even when the loaded row carries it.
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import { buildCreationRecord, canonicalCreationRecordJson } from "../castingV2/creationRecord";
import { loadCreationRecordKey, signCreationRecord } from "../castingV2/creationRecordSigning";
import { createCreationCertificateRouter } from "./creationCertificate";

const SENTINEL = "SENTINEL-RECIPE-a-tall-figure-in-red";
const MASTER = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#777777" } }).png().toBuffer();
const MASTER_SHA = createHash("sha256").update(MASTER).digest("hex");
const KEY = loadCreationRecordKey(JSON.stringify(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" })));
const RECORD_JSON = canonicalCreationRecordJson(buildCreationRecord({
  kliegId: "KI-TEST",
  accountId: 7,
  makerName: "Mia Strom",
  createdAt: new Date("2026-09-03T10:00:00Z"),
  mintedAt: new Date("2026-09-03T10:06:00Z"),
  masterSha256: MASTER_SHA,
  rolledAt: null,
  rollsInSession: null,
  keptAt: null,
  refinements: { count: 0, firstAt: null, lastAt: null },
  recordedAt: new Date("2026-10-14T00:00:00Z"),
}));
const SIGNATURE = await signCreationRecord(KEY, RECORD_JSON);

const ROW = {
  id: 1, modelId: 42, userId: 7, recordVersion: "1", recordJson: RECORD_JSON, recordSha256: "x",
  signature: SIGNATURE, signingKeyId: KEY.kid, timestampToken: Buffer.from("token").toString("base64"),
  timestampAuthority: "internal", stampedAt: new Date("2026-10-14T04:31:00Z"), stampAttempts: 1,
  lastStampAttemptAt: null, publicAt: null, createdAt: new Date(),
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    authenticate: async () => ({ id: 7, suspendedAt: null, lockedUntil: null }),
    /* The row a careless loader would hand over — recipe and all. The route
       must use its id and name and nothing else. */
    loadCast: async () => ({ id: 42, name: "Jericho", masterPrompt: SENTINEL, technicalSchema: SENTINEL, preferences: SENTINEL }),
    ensureRecord: async () => ({ kind: "recorded" as const, recordId: 1, stamped: true, created: false }),
    loadRecord: async () => ROW,
    loadMasterKey: async () => "casting-v2/anchor.png",
    readBytes: async () => ({ bytes: MASTER }),
    publicKey: () => ({ kid: KEY.kid, publicJwk: KEY.publicJwk }),
    ...overrides,
  } as never;
}

async function call(
  overrides: Record<string, unknown>,
  path = "/api/cast/KI-TEST/certificate",
  method: "GET" | "HEAD" = "GET",
): Promise<{ status: number; headers: Headers; body: Buffer; json: unknown }> {
  const app = express();
  app.use(createCreationCertificateRouter(dependencies(overrides)));
  const server = await listenOnFetchablePort((bound) => app.listen(bound, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}${path}`, { method });
    const body = Buffer.from(await response.arrayBuffer());
    let json: unknown = null;
    try { json = JSON.parse(body.toString("utf8")); } catch { /* a PDF */ }
    return { status: response.status, headers: response.headers, body, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/* A distinct user per rate-limit arm, so arms never share a bucket. */
let nextUser = 1000;

describe("who may download a certificate", () => {
  it("refuses an unauthenticated request", async () => {
    expect((await call({ authenticate: async () => null })).status).toBe(401);
  });

  it("refuses a suspended account and a locked one", async () => {
    expect((await call({ authenticate: async () => ({ id: 7, suspendedAt: new Date(), lockedUntil: null }) })).status).toBe(403);
    expect((await call({
      authenticate: async () => ({ id: 7, suspendedAt: null, lockedUntil: new Date(Date.now() + 60_000) }),
    })).status).toBe(403);
  });

  it("⚠ a stranger's cast, a deleted cast and a cast that never existed all answer the same 404", async () => {
    /* `getOwnedCastByPublicId` scopes owner + not deleted + not archived in one
       statement, so all three reach the route as "no cast". */
    const foreign = await call({ loadCast: async () => null }, "/api/cast/KI-SOMEONE-ELSE/certificate");
    const deleted = await call({ loadCast: async () => null }, "/api/cast/KI-DELETED/certificate");
    const missing = await call({ loadCast: async () => null }, "/api/cast/KI-NOT-REAL/certificate");
    for (const answer of [foreign, deleted, missing]) expect(answer.status).toBe(404);
    expect(foreign.json).toEqual(missing.json);
    expect(deleted.json).toEqual(missing.json);
  });

  it("⚠ a record that is gone (its cast deleted after the owner check) is the same 404", async () => {
    const gone = await call({ loadRecord: async () => null });
    const missing = await call({ loadCast: async () => null });
    expect(gone.status).toBe(404);
    expect(gone.json).toEqual(missing.json);
  });

  it("⚠ the scope off for this account is the same 404 — no button, no oracle", async () => {
    const dark = await call({ ensureRecord: async () => ({ kind: "dark" }) });
    const refused = await call({ ensureRecord: async () => ({ kind: "refused", reason: "not_minted" }) });
    const missing = await call({ loadCast: async () => null });
    expect(dark.status).toBe(404);
    expect(refused.status).toBe(404);
    expect(dark.json).toEqual(missing.json);
    expect(refused.json).toEqual(missing.json);
  });

  it("passes the SESSION's user to every read, never anything from the URL", async () => {
    const loadCast = vi.fn(async () => ({ id: 42, name: "Jericho" }));
    const ensureRecord = vi.fn(async () => ({ kind: "recorded" as const, recordId: 1, stamped: true, created: true }));
    const loadRecord = vi.fn(async () => ROW);
    const loadMasterKey = vi.fn(async () => "casting-v2/anchor.png");
    await call({ loadCast, ensureRecord, loadRecord, loadMasterKey }, "/api/cast/KI-TEST/certificate?userId=99");
    expect(loadCast).toHaveBeenCalledWith(7, "KI-TEST");
    expect(ensureRecord).toHaveBeenCalledWith({ userId: 7, modelId: 42 });
    expect(loadRecord).toHaveBeenCalledWith(7, 42);
    expect(loadMasterKey).toHaveBeenCalledWith(7, 42);
  });

  it("answers 429 with Retry-After once the user's allowance is spent", async () => {
    const id = nextUser++;
    const authenticate = async () => ({ id, suspendedAt: null, lockedUntil: null });
    const answers: number[] = [];
    for (let i = 0; i < 21; i += 1) answers.push((await call({ authenticate }, undefined, "HEAD")).status);
    expect(answers.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(answers[20]).toBe(429);
  });
});

describe("the room's question — HEAD", () => {
  it("answers 200 with no body when a download would succeed, without reading the picture", async () => {
    const readBytes = vi.fn(async () => ({ bytes: MASTER }));
    const answer = await call({ readBytes }, undefined, "HEAD");
    expect(answer.status).toBe(200);
    expect(answer.body.length).toBe(0);
    expect(readBytes).not.toHaveBeenCalled();
  });

  it("⚠ an unstamped record answers 409 to both — the row waits, the download never hands out an unchecked record", async () => {
    const unstamped = { loadRecord: async () => ({ ...ROW, timestampToken: null, stampedAt: null }) };
    expect((await call(unstamped, undefined, "HEAD")).status).toBe(409);
    expect((await call(unstamped)).status).toBe(409);
  });

  it("backfills on first request — an older cast's record is made by asking", async () => {
    const ensureRecord = vi.fn(async () => ({ kind: "recorded" as const, recordId: 1, stamped: true, created: true }));
    expect((await call({ ensureRecord }, undefined, "HEAD")).status).toBe(200);
    expect(ensureRecord).toHaveBeenCalledTimes(1);
  });
});

describe("what comes back", () => {
  it("a PDF the browser saves rather than renders, never held by a shared cache", async () => {
    const answer = await call({});
    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type")).toContain("application/pdf");
    expect(answer.headers.get("content-disposition")).toContain("attachment");
    expect(answer.headers.get("content-disposition")).toContain("Jericho-certificate-of-creation.pdf");
    expect(answer.headers.get("cache-control")).toContain("no-store");
    expect(answer.body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("⚠ POSITIVE + NEGATIVE: the file carries the cast's name and never a word of the recipe the loaded row held", async () => {
    const file = (await call({})).body.toString("latin1");
    expect(file).toContain("(Jericho) Tj");
    expect(file).not.toContain(SENTINEL);
    expect(file).not.toMatch(/masterPrompt|technicalSchema|preferences/);
  });

  it("⚠ a picture that is not the fingerprinted one is refused — the page never prints a fingerprint of something else", async () => {
    const other = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#123456" } }).png().toBuffer();
    const answer = await call({ readBytes: async () => ({ bytes: other }) });
    expect(answer.status).toBe(500);
    expect(answer.headers.get("content-type")).not.toContain("application/pdf");
  });

  it("a load that could not finish answers 503, never the 404 of a cast that is not there", async () => {
    const answer = await call({ loadCast: async () => { throw new Error("read ECONNRESET"); } });
    expect(answer.status).toBe(503);
  });
});
