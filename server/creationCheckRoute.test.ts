/**
 * THE PUBLIC CHECK PAGE AND ITS TOGGLE, DRIVEN THROUGH THE REAL ROUTER (#2313).
 *
 * The two stores are doubled so these arms run on every `pnpm test` without a
 * database; what the STATEMENTS do is proven at the wire in
 * `server/db/castCreationCheck.test.ts`, and the live three arms were driven on
 * the dev database (the PR body). What only this file can show:
 *
 *   1. ⚠ NO EXISTENCE ORACLE — an unknown ID, a private ID and a deleted cast's
 *      ID (each a "no row" from the one public statement), plus a malformed ID,
 *      an ID whose OWNER's scope is off and a record that cannot be read, all
 *      come back DEEP-EQUAL and BYTE-EQUAL — with a positive control (a page
 *      that is on) that is different, so "identical" cannot be a broken caller.
 *   2. The public answer carries EXACTLY six fields — never the account id,
 *      the steps, a picture, an address or an email (the 2026-07-25 bound).
 *   3. The rate limit fires per IP before anything is read, as a real
 *      `TOO_MANY_REQUESTS` (invariant 6), and identically for every ID.
 *   4. Every input is `.strict()` (invariant 4), proven by PARSING.
 *   5. The toggle: the owner is the session's (invariant 3); turning ON makes
 *      the record first; OFF does not; outside the scope nothing is drawn and
 *      nothing is written.
 *   6. The preview is the public projection, byte for byte.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as Array<{ fn: string; args: unknown[] }>);
const store = vi.hoisted(() => ({
  publicRow: null as unknown,
  owned: { modelId: 907, name: "Ada" } as unknown,
  switchRow: null as unknown,
  setResult: { updated: true } as unknown,
  record: null as unknown,
  ensure: { kind: "recorded", recordId: 1, stamped: true, created: false } as unknown,
}));

vi.mock("./db/castCreationCheck", () => ({
  readPublicCreationCheck: async (...args: unknown[]) => {
    calls.push({ fn: "readPublicCreationCheck", args });
    return store.publicRow;
  },
  resolveOwnedSignedCast: async (...args: unknown[]) => {
    calls.push({ fn: "resolveOwnedSignedCast", args });
    return store.owned;
  },
  readCreationCheckSwitch: async (...args: unknown[]) => {
    calls.push({ fn: "readCreationCheckSwitch", args });
    return store.switchRow;
  },
  setCreationCheckPublic: async (...args: unknown[]) => {
    calls.push({ fn: "setCreationCheckPublic", args });
    return store.setResult;
  },
}));
vi.mock("./db/castCreationRecords", () => ({
  getCastCreationRecord: async (...args: unknown[]) => {
    calls.push({ fn: "getCastCreationRecord", args });
    return store.record;
  },
}));
vi.mock("./castingV2/creationRecordService", () => ({
  ensureCastCreationRecord: async (...args: unknown[]) => {
    calls.push({ fn: "ensureCastCreationRecord", args });
    return store.ensure;
  },
}));

process.env.CASTING_V2_SCOPE = "all";
process.env.CASTING_CREATION_RECORD_SCOPE = "users:41,52";

const { creationCheckRouter, CREATION_CHECK_LOOKUP_RATE } = await import("./routes/creationCheck");
const { NO_PUBLIC_RECORD, projectPublicCreationCheck } = await import("./castingV2/creationCheck");

const OWNER = 41;
const KI = "KI-AAAA-BBBB-CCCC-DDDD";
const SHA = "d837f90d".padEnd(64, "a");
const RECORD_JSON = JSON.stringify({
  recordVersion: "1",
  kliegId: KI,
  maker: { accountId: OWNER, displayName: "Ada Studio" },
  createdAt: "2026-09-03T10:00:00.000Z",
  mintedAt: "2026-09-03T10:04:00.000Z",
  master: { sha256: SHA },
  steps: [{ event: "signed", at: "2026-09-03T10:00:00.000Z" }],
  recordedAt: "2026-10-12T05:00:00.000Z",
});
const ON_ROW = {
  kliegId: KI,
  ownerId: OWNER,
  recordJson: RECORD_JSON,
  stampedAt: new Date("2026-10-12T05:00:01.000Z"),
};

let nextIp = 1;
function stranger() {
  const ip = `198.51.100.${(nextIp += 1) % 250}.${nextIp}`;
  return { ip, call: creationCheckRouter.createCaller({ user: null, req: { ip } } as never) };
}
const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });
function owner(id = OWNER) {
  return creationCheckRouter.createCaller({ user: customer(id), req: { ip: "203.0.113.9" } } as never);
}

beforeEach(() => {
  calls.length = 0;
  store.publicRow = null;
  store.owned = { modelId: 907 };
  store.switchRow = null;
  store.setResult = { updated: true };
  store.record = null;
  store.ensure = { kind: "recorded", recordId: 1, stamped: true, created: false };
});

describe("⚠ no existence oracle — every ID with no public page answers identically", () => {
  async function answerFor(setup: () => void, id = KI) {
    setup();
    const result = await stranger().call.lookup({ kliegId: id });
    return result;
  }

  it("unknown, private and deleted (each a no-row from the one statement) are deep- and byte-equal", async () => {
    const unknown = await answerFor(() => { store.publicRow = null; }, "KI-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
    const privateId = await answerFor(() => { store.publicRow = null; });
    const deleted = await answerFor(() => { store.publicRow = null; }, "KI-2222-3333-4444-5555");
    expect(unknown).toEqual({ found: false });
    expect(privateId).toEqual(unknown);
    expect(deleted).toEqual(unknown);
    expect(JSON.stringify(privateId)).toBe(JSON.stringify(unknown));
    expect(JSON.stringify(deleted)).toBe(JSON.stringify(unknown));
  });

  it("a malformed ID, an owner whose scope is off, and an unreadable record answer the SAME", async () => {
    const baseline = JSON.stringify(await answerFor(() => { store.publicRow = null; }));
    const malformed = await answerFor(() => {}, "not-an-id");
    expect(JSON.stringify(malformed)).toBe(baseline);
    /* A malformed ID never reaches the store: no cast can carry it. */
    expect(calls.filter((c) => c.fn === "readPublicCreationCheck").length).toBe(1);

    const ownerDark = await answerFor(() => { store.publicRow = { ...ON_ROW, ownerId: 99 }; });
    expect(JSON.stringify(ownerDark)).toBe(baseline);

    const unreadable = await answerFor(() => { store.publicRow = { ...ON_ROW, recordJson: "{not json" }; });
    expect(JSON.stringify(unreadable)).toBe(baseline);
    const otherId = await answerFor(() => {
      store.publicRow = { ...ON_ROW, recordJson: RECORD_JSON.replace(KI, "KI-9999-9999-9999-9999") };
    });
    expect(JSON.stringify(otherId)).toBe(baseline);
  });

  it("POSITIVE CONTROL — a page that is ON answers differently, so 'identical' is not a broken caller", async () => {
    const off = await answerFor(() => { store.publicRow = null; });
    const on = await answerFor(() => { store.publicRow = ON_ROW; });
    expect(on).not.toEqual(off);
    expect(on).toMatchObject({ found: true, kliegId: KI });
  });

  it("the one answer is the frozen constant, which nobody can decorate", () => {
    expect(Object.isFrozen(NO_PUBLIC_RECORD)).toBe(true);
  });

  it("the ID is normalised before the read — a lower-case paste finds the same page", async () => {
    store.publicRow = ON_ROW;
    await stranger().call.lookup({ kliegId: `  ${KI.toLowerCase()} ` });
    expect(calls.find((c) => c.fn === "readPublicCreationCheck")!.args[0]).toBe(KI);
  });
});

describe("what a stranger sees — six fields and nothing else", () => {
  it("projects exactly the six, never the account, the steps, a picture or an email", async () => {
    store.publicRow = ON_ROW;
    const answer = await stranger().call.lookup({ kliegId: KI });
    expect(Object.keys(answer).sort()).toEqual(
      ["createdAt", "fingerprint", "found", "kliegId", "makerName", "recordedAt", "stampedAt"].sort(),
    );
    expect(answer).toEqual({
      found: true,
      kliegId: KI,
      makerName: "Ada Studio",
      createdAt: "2026-09-03T10:00:00.000Z",
      recordedAt: "2026-10-12T05:00:00.000Z",
      stampedAt: "2026-10-12T05:00:01.000Z",
      fingerprint: SHA,
    });
    const wire = JSON.stringify(answer);
    expect(wire).not.toMatch(/accountId|steps|"41"|:41[,}]|http|\.png|\.jpg|@/);
  });

  it("⚠ NEVER THE CAST'S NAME — even when the row and the record both carry one (finding 1 on PR #2325)", async () => {
    /* A store that (wrongly) hands the name back, and a record that (wrongly)
       names the cast: neither may reach a stranger. The name is unsigned and
       customer-written, and it waits on #2323. */
    const leaky = {
      ...ON_ROW,
      castName: "Pigman",
      name: "Pigman",
      recordJson: RECORD_JSON.replace('"recordVersion"', '"castName":"Pigman","name":"Pigman","recordVersion"'),
    };
    store.publicRow = leaky;
    const answer = await stranger().call.lookup({ kliegId: KI });
    expect(answer).toMatchObject({ found: true });
    expect(answer).not.toHaveProperty("castName");
    expect(answer).not.toHaveProperty("name");
    expect(JSON.stringify(answer)).not.toContain("Pigman");
    /* And the preview, through the same projector. */
    store.record = { recordJson: leaky.recordJson, stampedAt: null };
    const preview = await owner().preview({ castId: KI });
    expect(preview).not.toHaveProperty("castName");
    expect(JSON.stringify(preview)).not.toContain("Pigman");
  });

  it("a display name that is an address is dropped, even though the record signed it", () => {
    const projected = projectPublicCreationCheck({
      ...ON_ROW,
      recordJson: RECORD_JSON.replace("Ada Studio", "ada@example.com"),
    });
    expect(projected?.makerName).toBeNull();
  });

  it("a record that cannot back a field is not half-shown", () => {
    expect(projectPublicCreationCheck({ ...ON_ROW, recordJson: RECORD_JSON.replace(SHA, "nothex") })).toBeNull();
    expect(projectPublicCreationCheck({ ...ON_ROW, recordJson: RECORD_JSON.replace("2026-09-03T10:00:00.000Z\",\"mintedAt", "yesterday\",\"mintedAt") })).toBeNull();
  });
});

describe("the public read is rate-limited per IP, before anything is read (invariants 5 and 6)", () => {
  it("the request past the limit is a real TOO_MANY_REQUESTS, for an unknown ID and a real one alike", async () => {
    const { call } = stranger();
    store.publicRow = ON_ROW;
    for (let index = 0; index < CREATION_CHECK_LOOKUP_RATE.maxRequests; index += 1) {
      await call.lookup({ kliegId: index % 2 ? KI : "KI-ZZZZ-ZZZZ-ZZZZ-ZZZZ" });
    }
    calls.length = 0;
    await expect(call.lookup({ kliegId: KI })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(call.lookup({ kliegId: "KI-ZZZZ-ZZZZ-ZZZZ-ZZZZ" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(calls).toHaveLength(0);
    /* CONTROL: another visitor is unaffected. */
    await expect(stranger().call.lookup({ kliegId: KI })).resolves.toMatchObject({ found: true });
  });
});

describe("every input is .strict() (invariant 4)", () => {
  it("lookup: the valid input parses, an undeclared field is refused before the store", async () => {
    await expect(stranger().call.lookup({ kliegId: KI })).resolves.toBeDefined();
    calls.length = 0;
    await expect(stranger().call.lookup({ kliegId: KI, userId: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toHaveLength(0);
  });

  it("status, preview and setPublic: the same, and an input naming a userId is refused", async () => {
    store.record = { recordJson: RECORD_JSON, stampedAt: ON_ROW.stampedAt };
    await expect(owner().status({ castId: KI })).resolves.toBeDefined();
    await expect(owner().preview({ castId: KI })).resolves.toBeDefined();
    await expect(owner().setPublic({ castId: KI, public: false })).resolves.toBeDefined();
    calls.length = 0;
    await expect(owner().status({ castId: KI, userId: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner().preview({ castId: KI, userId: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(owner().setPublic({ castId: KI, public: true, userId: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toHaveLength(0);
  });
});

describe("the owner's toggle", () => {
  it("is anonymous-proof: every owner procedure needs a session", async () => {
    await expect(stranger().call.status({ castId: KI })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(stranger().call.setPublic({ castId: KI, public: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(calls).toHaveLength(0);
  });

  it("status reads the switch for the SESSION's owner and makes nothing", async () => {
    store.switchRow = { publicAt: new Date() };
    await expect(owner().status({ castId: KI })).resolves.toEqual({ available: true, isPublic: true });
    expect(calls.map((c) => c.fn)).toEqual(["resolveOwnedSignedCast", "readCreationCheckSwitch"]);
    expect(calls.every((c) => c.args[0] === OWNER)).toBe(true);
  });

  it("a cast with no record yet is simply off", async () => {
    store.switchRow = null;
    await expect(owner().status({ castId: KI })).resolves.toEqual({ available: true, isPublic: false });
  });

  it("turning ON makes the record FIRST, then writes the switch, both for the session's owner", async () => {
    await expect(owner().setPublic({ castId: KI, public: true })).resolves.toEqual({ isPublic: true });
    expect(calls.map((c) => c.fn)).toEqual(["resolveOwnedSignedCast", "ensureCastCreationRecord", "setCreationCheckPublic"]);
    expect(calls[1]!.args[1]).toEqual({ userId: OWNER, modelId: 907 });
    expect(calls[2]!.args[0]).toMatchObject({ userId: OWNER, modelId: 907, on: true });
  });

  it("turning OFF makes nothing and nulls the switch", async () => {
    await expect(owner().setPublic({ castId: KI, public: false })).resolves.toEqual({ isPublic: false });
    expect(calls.map((c) => c.fn)).toEqual(["resolveOwnedSignedCast", "setCreationCheckPublic"]);
    expect(calls[1]!.args[0]).toMatchObject({ on: false });
  });

  it("a cast that is not the owner's signed cast is refused before anything is written", async () => {
    store.owned = null;
    await expect(owner().setPublic({ castId: KI, public: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(calls.map((c) => c.fn)).toEqual(["resolveOwnedSignedCast"]);
  });

  it("a cast whose record cannot be made yet is refused in the customer's words, and the switch is untouched", async () => {
    store.ensure = { kind: "refused", reason: "not_minted" };
    await expect(owner().setPublic({ castId: KI, public: true })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.not.stringMatching(/mint|record_|scope|sha|hash/i),
    });
    expect(calls.some((c) => c.fn === "setCreationCheckPublic")).toBe(false);
  });

  it("DARK — outside the scope the room draws nothing, and nothing is read or written", async () => {
    await expect(owner(77).status({ castId: KI })).resolves.toEqual({ available: false, isPublic: false });
    await expect(owner(77).preview({ castId: KI })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(owner(77).setPublic({ castId: KI, public: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(calls).toHaveLength(0);
  });
});

describe("the preview IS the public page — one projector, so it cannot show something the page does not", () => {
  it("is byte-equal to what a stranger gets for the same record", async () => {
    store.record = { recordJson: RECORD_JSON, stampedAt: ON_ROW.stampedAt };
    const preview = await owner().preview({ castId: KI });
    store.publicRow = ON_ROW;
    const { found, ...page } = (await stranger().call.lookup({ kliegId: KI })) as { found: true } & Record<string, unknown>;
    expect(found).toBe(true);
    expect(JSON.stringify(preview)).toBe(JSON.stringify(page));
  });

  it("makes the record on first request (the backfill entrance) before reading it", async () => {
    store.record = { recordJson: RECORD_JSON, stampedAt: null };
    await owner().preview({ castId: KI });
    expect(calls.map((c) => c.fn)).toEqual(["resolveOwnedSignedCast", "ensureCastCreationRecord", "getCastCreationRecord"]);
  });
});
