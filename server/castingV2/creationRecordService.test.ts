/**
 * THE TWO MINT ROADS, DRIVEN WITH EVERY DEPENDENCY INJECTED (#2311).
 *
 * What the card's "done when" asks of a record, asserted on what the road
 * actually STORES rather than on what it built in memory (law 5, at the wire):
 *
 *   - its signature verifies against the public key;
 *   - its token is the one the authority granted, stored as given, for a hash
 *     that is the SHA-256 of the stored record JSON;
 *   - its JSON carries no key from the refused family — driven with a SOURCE
 *     that misbehaves and hands the road the whole recipe (law 3);
 *   - an authority that refuses costs the stamp and nothing else: the record
 *     is signed and stored, and the Sign road never throws;
 *   - dark is dark: no statement, no read, no key.
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CastCreationRecordRow } from "../../drizzle/schema";
import type { CreationRecordSource } from "../db/castCreationRecords";
import { CREATION_RECORD_REFUSED_KEYS } from "./creationRecord";
import {
  ensureCastCreationRecord,
  mintCreationRecordOnSign,
  type CreationRecordDependencies,
} from "./creationRecordService";
import { loadCreationRecordKey, verifyCreationRecord } from "./creationRecordSigning";
import type { TimestampToken } from "./creationRecordTimestamp";

vi.mock("../logging/logger", () => {
  const quiet = () => undefined;
  const shape = { error: quiet, warn: quiet, info: quiet, debug: quiet, fatal: quiet, trace: quiet, child: () => shape };
  return { logger: shape, createModuleLogger: () => shape };
});

const SECRET = "SECRET-RECIPE-MARKER-2311";
const USER_ID = 41;
const MODEL_ID = 907;
const ANCHOR_BYTES = Buffer.from("the master picture's bytes");
const KEY = loadCreationRecordKey(JSON.stringify(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" })));
const TOKEN: TimestampToken = {
  tokenDer: Buffer.from("3082token", "utf8"),
  stampedAt: new Date("2026-10-12T03:11:42Z"),
  authority: "digicert",
};

const source: CreationRecordSource = {
  modelId: MODEL_ID,
  kliegId: "KI-AAAA-BBBB-CCCC-DDDD",
  createdAt: new Date("2026-09-03T10:00:00Z"),
  mintedAt: new Date("2026-09-03T10:04:00Z"),
  makerDisplayName: "Ada Maker",
  anchorStorageKey: "casting-v2/casts/op/anchor/x.png",
  rolledAt: new Date("2026-09-03T09:40:00Z"),
  rollsInSession: 2,
  keptAt: null,
  refinements: { count: 1, firstAt: new Date("2026-09-03T09:50:00Z"), lastAt: new Date("2026-09-03T09:50:00Z") },
};

/** An in-memory table, so a stored row can be read back the way the road reads it. */
let rows: CastCreationRecordRow[];
let stamps: Array<Parameters<NonNullable<CreationRecordDependencies["recordStamp"]>>[0]>;

function row(overrides: Partial<CastCreationRecordRow> = {}): CastCreationRecordRow {
  return {
    id: 1, modelId: MODEL_ID, userId: USER_ID, recordVersion: "1", recordJson: "{}", recordSha256: "a".repeat(64),
    signature: "h..s", signingKeyId: KEY.kid, timestampToken: null, timestampAuthority: null, stampedAt: null,
    stampAttempts: 0, lastStampAttemptAt: null, publicAt: null, createdAt: new Date(), ...overrides,
  };
}

function dependencies(overrides: Partial<CreationRecordDependencies> = {}): CreationRecordDependencies {
  return {
    enabled: () => true,
    getRecord: vi.fn(async (userId: number, modelId: number) =>
      rows.find((entry) => entry.userId === userId && entry.modelId === modelId) ?? null),
    readSource: vi.fn(async () => source),
    readBytes: vi.fn(async () => ({ bytes: ANCHOR_BYTES, contentType: "image/png" })),
    insertRecord: vi.fn(async (input) => {
      rows.push(row({ ...input, id: rows.length + 1 }));
      return { stored: true };
    }),
    recordStamp: vi.fn(async (input) => {
      stamps.push(input);
      const target = rows.find((entry) => entry.id === input.recordId && entry.userId === input.userId);
      if (target && !target.timestampToken && input.token) {
        target.timestampToken = input.token.tokenBase64;
        target.timestampAuthority = input.token.authority;
        target.stampedAt = input.token.stampedAt;
      }
    }),
    loadKey: () => KEY,
    stamp: vi.fn(async () => ({ token: TOKEN, refusals: [] })),
    now: () => new Date("2026-10-12T03:11:40Z"),
    ...overrides,
  };
}

beforeEach(() => {
  rows = [];
  stamps = [];
});

describe("a new record — signed, stored, stamped", () => {
  it("stores a record whose signature verifies and whose token is for the stored bytes", async () => {
    const deps = dependencies();
    const outcome = await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID });
    expect(outcome).toEqual({ kind: "recorded", recordId: 1, stamped: true, created: true });

    const stored = rows[0]!;
    expect(stored.userId).toBe(USER_ID);
    expect(await verifyCreationRecord(KEY.publicJwk, stored.recordJson, stored.signature)).toBe(true);
    expect(stored.recordSha256).toBe(createHash("sha256").update(stored.recordJson, "utf8").digest("hex"));
    /* The authority was asked for the hash of THE STORED JSON, not of something else. */
    const asked = vi.mocked(deps.stamp!).mock.calls[0]![0].digest;
    expect(asked.toString("hex")).toBe(stored.recordSha256);
    expect(stored.timestampToken).toBe(TOKEN.tokenDer.toString("base64"));
    expect(stored.timestampAuthority).toBe("digicert");

    const record = JSON.parse(stored.recordJson);
    expect(record.master.sha256).toBe(createHash("sha256").update(ANCHOR_BYTES).digest("hex"));
    expect(record.kliegId).toBe("KI-AAAA-BBBB-CCCC-DDDD");
    expect(record.maker).toEqual({ accountId: USER_ID, displayName: "Ada Maker" });
    expect(vi.mocked(deps.readBytes!)).toHaveBeenCalledWith(source.anchorStorageKey);
  });

  it("⚠ THE BOUND — a source that hands over the whole recipe stores none of it", async () => {
    const leaky = {
      ...source,
      masterPrompt: `${SECRET} prompt`,
      technicalSchema: { secret: SECRET },
      preferences: { secret: SECRET },
      briefText: `${SECRET} brief`,
      identityText: `${SECRET} identity`,
      instructions: [`${SECRET} refine`],
      makerDisplayName: "ada@example.com",
      makerName: "Ada Lovelace REAL-NAME-2311",
    } as unknown as CreationRecordSource;
    await ensureCastCreationRecord(dependencies({ readSource: vi.fn(async () => leaky) }), {
      userId: USER_ID, modelId: MODEL_ID,
    });
    const stored = rows[0]!.recordJson;
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain("example.com");
    expect(stored).not.toContain("REAL-NAME-2311");
    for (const key of CREATION_RECORD_REFUSED_KEYS) expect(stored).not.toContain(`"${key}"`);
    /* CONTROL — the arm can see a value when one is there: the Klieg ID is. */
    expect(stored).toContain("KI-AAAA-BBBB-CCCC-DDDD");
  });
});

describe("⚠ a cast deleted mid-flight leaves nothing behind (the relay's finding 1 on PR #2317)", () => {
  it("deleted between the read and the insert: nothing stored, nothing stamped, refused", async () => {
    /* The store behaves the way the gated SQL does (castCreationRecords.test.ts
       holds the SQL): the insert copies out of the LIVE cast or writes nothing,
       and the reader joins the live cast. The cast dies while the road is
       reading its picture — after the facts were read, before the insert. */
    let live = true;
    const deps = dependencies({
      readBytes: vi.fn(async () => {
        live = false;
        return { bytes: ANCHOR_BYTES, contentType: "image/png" };
      }),
      insertRecord: vi.fn(async (input) => {
        if (!live) return { stored: false };
        rows.push(row({ ...input, id: rows.length + 1 }));
        return { stored: true };
      }),
      getRecord: vi.fn(async (userId: number, modelId: number) =>
        (live ? rows.find((entry) => entry.userId === userId && entry.modelId === modelId) : undefined) ?? null),
    });
    const outcome = await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID });
    expect(outcome).toEqual({ kind: "refused", reason: "not_a_signed_cast" });
    expect(rows).toEqual([]);
    expect(deps.stamp).not.toHaveBeenCalled();
    expect(deps.recordStamp).not.toHaveBeenCalled();
  });
});

describe("⚠ the maker's name is the DISPLAY name or none (the relay's finding 4 on PR #2317)", () => {
  it("with no display name the record signs NO name — never the account's real name", async () => {
    const noDisplay = { ...source, makerDisplayName: null, name: "Ada Lovelace REAL-NAME-2311" } as unknown as CreationRecordSource;
    await ensureCastCreationRecord(dependencies({ readSource: vi.fn(async () => noDisplay) }), {
      userId: USER_ID, modelId: MODEL_ID,
    });
    const record = JSON.parse(rows[0]!.recordJson);
    expect(record.maker).toEqual({ accountId: USER_ID, displayName: null });
    expect(rows[0]!.recordJson).not.toContain("REAL-NAME-2311");
  });
});

describe("an authority that says no costs the stamp and nothing else", () => {
  it("stores the signed record unstamped, counts the attempt, and does not throw", async () => {
    const deps = dependencies({ stamp: vi.fn(async () => ({ token: null, refusals: [{ reason: "transport" as const, authority: "digicert" }] })) });
    const outcome = await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID });
    expect(outcome).toEqual({ kind: "recorded", recordId: 1, stamped: false, created: true });
    expect(rows[0]!.timestampToken).toBeNull();
    expect(await verifyCreationRecord(KEY.publicJwk, rows[0]!.recordJson, rows[0]!.signature)).toBe(true);
    expect(stamps).toEqual([expect.objectContaining({ userId: USER_ID, recordId: 1, token: null })]);
  });

  it("retries ONLY the stamp on the next request — the record is not rebuilt or re-signed", async () => {
    rows.push(row({ id: 5, recordSha256: "b".repeat(64) }));
    const deps = dependencies();
    const outcome = await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID });
    expect(outcome).toEqual({ kind: "recorded", recordId: 5, stamped: true, created: false });
    expect(deps.readSource).not.toHaveBeenCalled();
    expect(deps.insertRecord).not.toHaveBeenCalled();
    expect(vi.mocked(deps.stamp!).mock.calls[0]![0].digest.toString("hex")).toBe("b".repeat(64));
  });

  it("asks nobody anything once a record is stamped", async () => {
    rows.push(row({ id: 5, timestampToken: "dG9rZW4=" }));
    const deps = dependencies();
    expect(await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID }))
      .toEqual({ kind: "recorded", recordId: 5, stamped: true, created: false });
    expect(deps.stamp).not.toHaveBeenCalled();
    expect(deps.readSource).not.toHaveBeenCalled();
  });
});

describe("dark is dark, and a refusal is a refusal", () => {
  it("off — not a statement, not a read, not a key", async () => {
    const explode = () => { throw new Error("nothing may run while dark"); };
    const outcome = await ensureCastCreationRecord({
      enabled: () => false,
      getRecord: explode, readSource: explode, readBytes: explode, insertRecord: explode,
      recordStamp: explode, loadKey: explode, stamp: explode,
    }, { userId: USER_ID, modelId: MODEL_ID });
    expect(outcome).toEqual({ kind: "dark" });
  });

  it("a cast that is not signed and minted is refused, and nothing is stored", async () => {
    const deps = dependencies({ readSource: vi.fn(async () => ({ refused: "not_minted" as const })) });
    expect(await ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID }))
      .toEqual({ kind: "refused", reason: "not_minted" });
    expect(deps.insertRecord).not.toHaveBeenCalled();
    expect(deps.readBytes).not.toHaveBeenCalled();
  });

  it("⚠ scoped on with no key REFUSES — the record road throws rather than storing an unsigned record", async () => {
    const deps = dependencies({ loadKey: () => loadCreationRecordKey(undefined) });
    await expect(ensureCastCreationRecord(deps, { userId: USER_ID, modelId: MODEL_ID }))
      .rejects.toThrow(/CREATION_RECORD_PRIVATE_KEY is not set/);
    expect(deps.insertRecord).not.toHaveBeenCalled();
  });
});

describe("the Sign's call never throws", () => {
  it("swallows every failure — the Sign it follows has already finished", async () => {
    const deps = dependencies({ insertRecord: vi.fn(async () => { throw new Error("connection lost"); }) });
    await expect(mintCreationRecordOnSign(deps, { userId: USER_ID, modelId: MODEL_ID, operationId: "op" }))
      .resolves.toBeNull();
  });

  it("CONTROL — and returns the outcome when nothing fails", async () => {
    await expect(mintCreationRecordOnSign(dependencies(), { userId: USER_ID, modelId: MODEL_ID, operationId: "op" }))
      .resolves.toEqual({ kind: "recorded", recordId: 1, stamped: true, created: true });
  });
});
